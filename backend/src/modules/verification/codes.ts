/**
 * Codes à usage unique : confirmation de l'e-mail et du téléphone, mot de passe oublié.
 * - 6 chiffres tirés par crypto.randomInt ; seule leur empreinte HMAC-SHA256 est stockée ;
 * - valables 10 minutes, 5 essais au plus ; un nouvel envoi invalide le code précédent ;
 * - 60 s minimum entre deux envois et 5 envois par heure pour un même objet.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { CanalCode, ObjetCode } from '@prisma/client';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { ErreurApi } from '../../utils/erreurs';
import { canauxDisponibles, envoyer } from '../notifications/expediteur';
import { messageCode } from '../notifications/messages';

export const DUREE_MINUTES = 10;
export const ESSAIS_MAX = 5;
export const DELAI_RENVOI_S = 60;
export const ENVOIS_PAR_HEURE = 5;

const empreinte = (code: string) => createHmac('sha256', env.JWT_SECRET).update(`code:${code}`).digest('hex');

/** Numéro → format E.164 (+2250701020304), ou null s'il n'est pas valide. */
export function normaliserTelephone(brut: string, pays?: string): string | null {
  const n = parsePhoneNumberFromString(brut.trim(), (pays?.toUpperCase() as CountryCode) || undefined);
  return n && n.isValid() ? n.number : null;
}

export const masquerEmail = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_, a: string, b: string, c: string) => a + '•'.repeat(Math.max(2, Math.min(b.length, 6))) + c);
/** +2250708091011 → +225••••••1011 (indicatif et 4 derniers chiffres visibles). */
export const masquerTelephone = (t: string) => t.slice(0, 4) + '•'.repeat(Math.max(2, t.length - 8)) + t.slice(-4);

interface Cible {
  id: string;
  email: string;
  telephone: string | null;
  langue: string;
}

export interface Envoi {
  canal: CanalCode;
  destination: string;
  /** Code renvoyé seulement en mode démonstration. */
  codeDemo?: string;
}

/** Crée un code, l'envoie sur le canal demandé et invalide les précédents du même objet. */
export async function envoyerCode(u: Cible, objet: ObjetCode, canal: CanalCode): Promise<Envoi> {
  if (!canauxDisponibles()[canal]) throw new ErreurApi(503, 'CANAL_INDISPONIBLE', `L’envoi par ${canal === 'EMAIL' ? 'e-mail' : canal === 'SMS' ? 'SMS' : 'WhatsApp'} n’est pas configuré sur ce serveur.`);
  const destination = canal === 'EMAIL' ? u.email : u.telephone;
  if (!destination) throw new ErreurApi(422, 'TELEPHONE_ABSENT', 'Aucun numéro de téléphone n’est associé à ce compte.');

  const maintenant = Date.now();
  const recents = await prisma.codeVerification.findMany({ where: { utilisateurId: u.id, objet, creeLe: { gte: new Date(maintenant - 3600_000) } }, orderBy: { creeLe: 'desc' } });
  const dernier = recents[0];
  if (dernier && maintenant - dernier.creeLe.getTime() < DELAI_RENVOI_S * 1000) {
    const s = Math.ceil(DELAI_RENVOI_S - (maintenant - dernier.creeLe.getTime()) / 1000);
    throw new ErreurApi(429, 'PATIENTER', `Patientez ${s} s avant de demander un nouveau code.`, { secondes: s });
  }
  if (recents.length >= ENVOIS_PAR_HEURE) throw new ErreurApi(429, 'TROP_DE_CODES', 'Trop de codes demandés. Réessayez dans une heure.');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.$transaction([
    prisma.codeVerification.updateMany({ where: { utilisateurId: u.id, objet, utiliseLe: null }, data: { utiliseLe: new Date() } }),
    prisma.codeVerification.create({ data: { utilisateurId: u.id, objet, canal, destination, empreinte: empreinte(code), expireLe: new Date(maintenant + DUREE_MINUTES * 60_000) } }),
  ]);
  const m = messageCode(objet, code, u.langue === 'en' ? 'en' : 'fr', DUREE_MINUTES);
  try {
    await envoyer({ canal, destination, sujet: m.sujet, texte: canal === 'EMAIL' ? m.texte : m.court, html: canal === 'EMAIL' ? m.html : undefined });
  } catch (e) {
    throw new ErreurApi(502, 'ENVOI_ECHOUE', `Le message n’a pas pu être envoyé (${(e as Error).message.slice(0, 120)}).`);
  }
  return { canal, destination, ...(env.CODES_VISIBLES && { codeDemo: code }) };
}

/** Vérifie le dernier code actif de l'objet ; le consomme s'il est juste. */
export async function verifierCode(utilisateurId: string, objet: ObjetCode, saisi: string): Promise<{ canal: CanalCode; destination: string }> {
  const c = await prisma.codeVerification.findFirst({ where: { utilisateurId, objet, utiliseLe: null }, orderBy: { creeLe: 'desc' } });
  if (!c) throw new ErreurApi(422, 'CODE_INCORRECT', 'Code incorrect ou expiré. Demandez un nouveau code.', { champ: 'code' });
  if (c.expireLe.getTime() < Date.now()) throw new ErreurApi(422, 'CODE_EXPIRE', 'Ce code a expiré. Demandez un nouveau code.', { champ: 'code' });
  if (c.tentatives >= ESSAIS_MAX) throw new ErreurApi(422, 'CODE_EPUISE', 'Trop d’essais avec ce code. Demandez un nouveau code.', { champ: 'code' });
  const attendu = Buffer.from(c.empreinte, 'hex');
  const recu = Buffer.from(empreinte(saisi.replace(/\s/g, '')), 'hex');
  if (!timingSafeEqual(attendu, recu)) {
    const restants = ESSAIS_MAX - c.tentatives - 1;
    await prisma.codeVerification.update({ where: { id: c.id }, data: { tentatives: { increment: 1 } } });
    throw new ErreurApi(422, 'CODE_INCORRECT', restants > 0 ? `Code incorrect. ${restants} essai${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}.` : 'Code incorrect. Demandez un nouveau code.', { champ: 'code', restants });
  }
  await prisma.codeVerification.update({ where: { id: c.id }, data: { utiliseLe: new Date() } });
  return { canal: c.canal, destination: c.destination };
}
