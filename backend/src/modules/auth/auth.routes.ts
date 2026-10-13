import { Router, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { CanalCode, Utilisateur } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { authentifier, COOKIE_SESSION, Session, signer } from '../../middlewares/authentification';
import { limiteAuth } from '../../middlewares/limites';
import { ErreurApi } from '../../utils/erreurs';
import { valider } from '../../utils/validation';
import { journaliser } from '../audit';
import { defautsMotDePasse } from '../../utils/motDePasse';
import { DEVISES, LANGUES } from '../../config/preferences';
import { canauxDisponibles } from '../notifications/expediteur';
import { envoyerCode, masquerEmail, masquerTelephone, normaliserTelephone, verifierCode, type Envoi } from '../verification/codes';

const motDePasseRobuste = (nom: string, email: string, mdp: string, ctx: z.RefinementCtx) => {
  const defauts = defautsMotDePasse(mdp, nom, email);
  if (defauts.length) ctx.addIssue({ code: 'custom', path: ['motDePasse'], message: `Mot de passe trop faible : ${defauts.join(', ')}.` });
};

const schemaInscription = z
  .object({
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    nom: z.string().trim().min(2, 'Nom trop court').max(100),
    telephone: z.string().trim().min(4, 'Numéro de téléphone requis').max(30),
    /** Pays de l'indicatif (code ISO à deux lettres), pour lire un numéro saisi sans « + ». */
    pays: z.string().length(2).optional(),
    /** Canal du code de confirmation du téléphone. */
    canalTelephone: z.enum(['SMS', 'WHATSAPP']).default('SMS'),
    motDePasse: z.string().max(200),
    // Préférences choisies sur l'écran de connexion avant la création du compte.
    langue: z.enum(LANGUES).optional(),
    devise: z.enum(DEVISES).optional(),
  })
  .superRefine((d, ctx) => {
    if (!normaliserTelephone(d.telephone, d.pays)) ctx.addIssue({ code: 'custom', path: ['telephone'], message: 'Numéro de téléphone invalide' });
    motDePasseRobuste(d.nom, d.email, d.motDePasse, ctx);
  });

/** Identifiant de connexion : adresse e-mail ou numéro de téléphone. */
const identifiant = {
  identifiant: z.string().trim().min(3).max(200).optional(),
  email: z.string().trim().optional(), // ancien format des clients
  pays: z.string().length(2).optional(),
};
const schemaConnexion = z.object({ ...identifiant, motDePasse: z.string().min(1) });
const schemaOubli = z.object({ ...identifiant, canal: z.enum(['EMAIL', 'SMS', 'WHATSAPP']) });
const schemaReinitialisation = z.object({ ...identifiant, code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres'), motDePasse: z.string().max(200) });
const schemaVerifier = z.object({ jeton: z.string().min(10), cible: z.enum(['email', 'telephone']), code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres') });
const schemaRenvoyer = z.object({ jeton: z.string().min(10), cible: z.enum(['email', 'telephone']), canal: z.enum(['SMS', 'WHATSAPP']).optional() });

const optionsCookie = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: env.JWT_TTL_HEURES * 3600 * 1000,
  path: '/',
});

/** Contenu du jeton de session (sans les préférences, relues en base à chaque /moi). */
const session = (u: Utilisateur): Session => ({ id: u.id, email: u.email, nom: u.nom, role: u.role });
const publique = (u: Utilisateur) => ({ ...session(u), langue: u.langue, devise: u.devise, telephone: u.telephone });

/** Un compte est utilisable quand son e-mail et, s'il en a un, son téléphone sont confirmés. */
const estVerifie = (u: Utilisateur) => !!u.emailVerifieLe && (!u.telephone || !!u.telephoneVerifieLe);

// Jeton de vérification : distinct du jeton de session (émetteur différent), valable 30 minutes.
const EMETTEUR_VERIFICATION = 'comptapilot-verification';
const jetonVerification = (u: Utilisateur) => jwt.sign({ id: u.id }, env.JWT_SECRET, { expiresIn: '30m', issuer: EMETTEUR_VERIFICATION });
async function lireJeton(jeton: string): Promise<Utilisateur> {
  try {
    const p = jwt.verify(jeton, env.JWT_SECRET, { issuer: EMETTEUR_VERIFICATION }) as { id: string };
    const u = await prisma.utilisateur.findUnique({ where: { id: p.id } });
    if (u) return u;
  } catch {
    /* jeton expiré ou falsifié */
  }
  throw new ErreurApi(401, 'VERIFICATION_EXPIREE', 'La vérification a expiré. Reconnectez-vous pour recevoir un nouveau code.');
}

/** État de la vérification renvoyé au client (destinations masquées, codes en mode démonstration). */
function etatVerification(u: Utilisateur, envois: { email?: Envoi; telephone?: Envoi } = {}) {
  return {
    jeton: jetonVerification(u),
    email: masquerEmail(u.email),
    telephone: u.telephone ? masquerTelephone(u.telephone) : null,
    emailVerifie: !!u.emailVerifieLe,
    telephoneVerifie: !u.telephone || !!u.telephoneVerifieLe,
    canalTelephone: envois.telephone?.canal ?? null,
    ...((envois.email?.codeDemo || envois.telephone?.codeDemo) && { codesDemo: { email: envois.email?.codeDemo, telephone: envois.telephone?.codeDemo } }),
  };
}

/** Envoie les codes manquants (e-mail et/ou téléphone). Un envoi trop rapproché est ignoré : le code précédent reste valable. */
async function envoyerCodesManquants(u: Utilisateur, canalTelephone: CanalCode = 'SMS') {
  const envois: { email?: Envoi; telephone?: Envoi } = {};
  const tenter = async (f: () => Promise<Envoi>) => {
    try {
      return await f();
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'PATIENTER') return undefined;
      throw e;
    }
  };
  if (!u.emailVerifieLe) envois.email = await tenter(() => envoyerCode(u, 'VERIFICATION_EMAIL', 'EMAIL'));
  if (u.telephone && !u.telephoneVerifieLe) envois.telephone = await tenter(() => envoyerCode(u, 'VERIFICATION_TELEPHONE', canalTelephone));
  return envois;
}

async function trouverParIdentifiant(d: { identifiant?: string; email?: string; pays?: string }): Promise<Utilisateur | null> {
  const brut = (d.identifiant ?? d.email ?? '').trim();
  if (!brut) throw new ErreurApi(422, 'VALIDATION', 'Identifiant requis', [{ champ: 'identifiant', message: 'Indiquez votre e-mail ou votre numéro de téléphone' }]);
  if (brut.includes('@')) return prisma.utilisateur.findUnique({ where: { email: brut.toLowerCase() } });
  const tel = normaliserTelephone(brut, d.pays);
  return tel ? prisma.utilisateur.findUnique({ where: { telephone: tel } }) : null;
}

function ouvrirSession(res: Response, u: Utilisateur) {
  res.cookie(COOKIE_SESSION, signer(session(u)), optionsCookie());
}

export const routesAuth = Router();

/**
 * POST /api/auth/inscription — crée le compte (non utilisable tant qu'il n'est pas confirmé)
 * et envoie un code à l'adresse e-mail et un autre au téléphone (SMS ou WhatsApp).
 */
routesAuth.post('/inscription', limiteAuth, async (req, res) => {
  const d = valider(schemaInscription, req.body);
  const telephone = normaliserTelephone(d.telephone, d.pays)!;
  const nb = await prisma.utilisateur.count();
  if (nb > 0 && !env.ALLOW_REGISTRATION) throw new ErreurApi(403, 'INSCRIPTION_FERMEE', 'Les inscriptions sont fermées.');
  for (const [champ, existant] of [
    ['email', await prisma.utilisateur.findUnique({ where: { email: d.email } })],
    ['telephone', await prisma.utilisateur.findUnique({ where: { telephone } })],
  ] as const) {
    if (!existant) continue;
    // Une inscription jamais confirmée ne bloque pas l'adresse ou le numéro : elle est remplacée.
    if (!estVerifie(existant)) await prisma.utilisateur.delete({ where: { id: existant.id } });
    else if (champ === 'email') throw new ErreurApi(409, 'EMAIL_UTILISE', 'Cette adresse est déjà utilisée.', [{ champ: 'email', message: 'Cette adresse est déjà utilisée.' }]);
    else throw new ErreurApi(409, 'TELEPHONE_UTILISE', 'Ce numéro est déjà utilisé.', [{ champ: 'telephone', message: 'Ce numéro est déjà utilisé.' }]);
  }
  // Le premier compte créé administre l'application.
  const premier = (await prisma.utilisateur.count()) === 0;
  const u = await prisma.utilisateur.create({
    data: { email: d.email, nom: d.nom, telephone, motDePasse: await bcrypt.hash(d.motDePasse, 12), role: premier ? 'ADMIN' : 'COMPTABLE', langue: d.langue, devise: d.devise },
  });
  let envois;
  try {
    envois = await envoyerCodesManquants(u, d.canalTelephone);
  } catch (e) {
    await prisma.utilisateur.delete({ where: { id: u.id } }); // rien n'a pu être envoyé : l'inscription est annulée
    throw e;
  }
  await journaliser(u.id, 'INSCRIPTION', u.email);
  res.status(201).json({ verification: etatVerification(u, envois) });
});

/** POST /api/auth/verification/verifier — saisie du code reçu par e-mail ou sur le téléphone. */
routesAuth.post('/verification/verifier', limiteAuth, async (req, res) => {
  const d = valider(schemaVerifier, req.body);
  let u = await lireJeton(d.jeton);
  if (d.cible === 'email' && !u.emailVerifieLe) {
    await verifierCode(u.id, 'VERIFICATION_EMAIL', d.code);
    u = await prisma.utilisateur.update({ where: { id: u.id }, data: { emailVerifieLe: new Date() } });
  } else if (d.cible === 'telephone' && u.telephone && !u.telephoneVerifieLe) {
    await verifierCode(u.id, 'VERIFICATION_TELEPHONE', d.code);
    u = await prisma.utilisateur.update({ where: { id: u.id }, data: { telephoneVerifieLe: new Date() } });
  }
  if (estVerifie(u)) {
    await journaliser(u.id, 'COMPTE_CONFIRME', u.email);
    ouvrirSession(res, u);
    res.json({ utilisateur: publique(u) });
    return;
  }
  res.json({ verification: etatVerification(u) });
});

/** POST /api/auth/verification/renvoyer — nouveau code (éventuellement sur l'autre canal du téléphone). */
routesAuth.post('/verification/renvoyer', limiteAuth, async (req, res) => {
  const d = valider(schemaRenvoyer, req.body);
  const u = await lireJeton(d.jeton);
  const envoi = d.cible === 'email' ? await envoyerCode(u, 'VERIFICATION_EMAIL', 'EMAIL') : await envoyerCode(u, 'VERIFICATION_TELEPHONE', d.canal ?? 'SMS');
  res.json({ verification: etatVerification(u, { [d.cible]: envoi }) });
});

routesAuth.post('/connexion', limiteAuth, async (req, res) => {
  const d = valider(schemaConnexion, req.body);
  const u = await trouverParIdentifiant(d);
  // Comparaison effectuée même si l'utilisateur n'existe pas (temps constant).
  const ok = await bcrypt.compare(d.motDePasse, u?.motDePasse ?? '$2b$12$invalideinvalideinvalideinvalideinvalideinvalideinval');
  if (!u || !ok) throw new ErreurApi(401, 'IDENTIFIANTS', 'Identifiant ou mot de passe incorrect.');
  if (!estVerifie(u)) {
    // Mot de passe juste mais compte non confirmé : nouveaux codes, puis écran de vérification.
    const envois = await envoyerCodesManquants(u).catch((e) => (logger.warn({ err: e }, 'Codes non renvoyés'), {}));
    res.status(403).json({ erreur: { code: 'COMPTE_NON_VERIFIE', message: 'Confirmez votre adresse e-mail et votre numéro de téléphone.' }, verification: etatVerification(u, envois) });
    return;
  }
  await prisma.utilisateur.update({ where: { id: u.id }, data: { derniereConnexion: new Date() } });
  await journaliser(u.id, 'CONNEXION', u.email);
  ouvrirSession(res, u);
  res.json({ utilisateur: publique(u) });
});

/**
 * POST /api/auth/mot-de-passe/oubli — envoie un code de réinitialisation.
 * La réponse est la même que le compte existe ou non (pas d'énumération des comptes).
 */
routesAuth.post('/mot-de-passe/oubli', limiteAuth, async (req, res) => {
  const d = valider(schemaOubli, req.body);
  if (!canauxDisponibles()[d.canal]) throw new ErreurApi(503, 'CANAL_INDISPONIBLE', 'Ce mode d’envoi n’est pas configuré sur ce serveur.');
  const u = await trouverParIdentifiant(d);
  let codeDemo: string | undefined;
  if (u && (d.canal === 'EMAIL' || u.telephone)) {
    try {
      codeDemo = (await envoyerCode(u, 'REINITIALISATION', d.canal)).codeDemo;
    } catch (e) {
      // Les refus liés au rythme d'envoi sont signalés (ils ne révèlent rien de plus qu'un envoi réussi).
      if (e instanceof ErreurApi && (e.code === 'PATIENTER' || e.code === 'TROP_DE_CODES')) throw e;
      logger.warn({ err: e }, 'Code de réinitialisation non envoyé');
    }
  }
  res.json({ envoye: true, ...(codeDemo && { codeDemo }) });
});

/** POST /api/auth/mot-de-passe/reinitialiser — code reçu + nouveau mot de passe. */
routesAuth.post('/mot-de-passe/reinitialiser', limiteAuth, async (req, res) => {
  const d = valider(schemaReinitialisation, req.body);
  const u = await trouverParIdentifiant(d);
  if (!u) throw new ErreurApi(422, 'CODE_INCORRECT', 'Code incorrect ou expiré. Demandez un nouveau code.', { champ: 'code' });
  const defauts = defautsMotDePasse(d.motDePasse, u.nom, u.email);
  if (defauts.length) throw new ErreurApi(422, 'VALIDATION', 'Mot de passe trop faible', [{ champ: 'motDePasse', message: `Mot de passe trop faible : ${defauts.join(', ')}.` }]);
  const { canal } = await verifierCode(u.id, 'REINITIALISATION', d.code);
  // Le code prouve l'accès au canal : l'adresse ou le numéro est confirmé au passage.
  await prisma.utilisateur.update({
    where: { id: u.id },
    data: { motDePasse: await bcrypt.hash(d.motDePasse, 12), ...(canal === 'EMAIL' ? { emailVerifieLe: u.emailVerifieLe ?? new Date() } : { telephoneVerifieLe: u.telephoneVerifieLe ?? new Date() }) },
  });
  await prisma.codeVerification.updateMany({ where: { utilisateurId: u.id, objet: 'REINITIALISATION', utiliseLe: null }, data: { utiliseLe: new Date() } });
  await journaliser(u.id, 'REINITIALISATION_MOT_DE_PASSE', u.email, { canal });
  res.json({ reinitialise: true });
});

routesAuth.post('/deconnexion', (_req, res) => {
  res.clearCookie(COOKIE_SESSION, { path: '/' });
  res.status(204).end();
});

routesAuth.get('/moi', authentifier, async (req, res) => {
  const u = await prisma.utilisateur.findUnique({ where: { id: req.session!.id } });
  if (!u) throw new ErreurApi(401, 'NON_AUTHENTIFIE', 'Session expirée');
  res.json({ utilisateur: publique(u), inscriptionOuverte: env.ALLOW_REGISTRATION });
});

const schemaPreferences = z
  .object({ langue: z.enum(LANGUES).optional(), devise: z.enum(DEVISES).optional() })
  .refine((d) => d.langue || d.devise, 'Aucune préférence transmise');

/** PATCH /api/auth/preferences — langue de l'interface et monnaie d'affichage de l'utilisateur. */
routesAuth.patch('/preferences', authentifier, async (req, res) => {
  const d = valider(schemaPreferences, req.body);
  const u = await prisma.utilisateur.update({ where: { id: req.session!.id }, data: d });
  res.json({ utilisateur: publique(u) });
});

routesAuth.get('/etat', async (_req, res) => {
  const c = canauxDisponibles();
  res.json({
    premierDemarrage: (await prisma.utilisateur.count()) === 0,
    inscriptionOuverte: env.ALLOW_REGISTRATION,
    canaux: { email: c.EMAIL, sms: c.SMS, whatsapp: c.WHATSAPP },
    demonstration: env.CODES_VISIBLES,
  });
});
