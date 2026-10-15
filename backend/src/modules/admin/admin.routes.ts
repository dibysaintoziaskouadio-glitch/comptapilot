/**
 * Administration des comptes (rôle ADMIN) : liste des utilisateurs et de leur activité,
 * journal des connexions, changement de rôle et désactivation.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { ErreurApi, nonTrouve } from '../../utils/erreurs';
import { valider } from '../../utils/validation';
import { journaliser } from '../audit';

export const routesAdmin = Router();

/** Un compte actif dans les 5 dernières minutes est affiché « en ligne ». */
export const EN_LIGNE_MS = 5 * 60_000;

/** Événements du journal d'audit liés aux comptes. */
const EVENEMENTS = ['CONNEXION', 'CONNEXION_ECHOUEE', 'INSCRIPTION', 'COMPTE_CONFIRME', 'REINITIALISATION_MOT_DE_PASSE', 'CHANGEMENT_ROLE', 'COMPTE_DESACTIVE', 'COMPTE_REACTIVE'];

routesAdmin.get('/utilisateurs', async (_req, res) => {
  const comptes = await prisma.utilisateur.findMany({
    orderBy: [{ derniereActivite: { sort: 'desc', nulls: 'last' } }, { creeLe: 'desc' }],
    select: { id: true, nom: true, email: true, telephone: true, role: true, actif: true, creeLe: true, derniereConnexion: true, derniereActivite: true, emailVerifieLe: true, telephoneVerifieLe: true, _count: { select: { calculs: true } } },
  });
  const seuil = Date.now() - EN_LIGNE_MS;
  res.json({
    utilisateurs: comptes.map(({ _count, emailVerifieLe, telephoneVerifieLe, ...u }) => ({
      ...u,
      confirme: !!emailVerifieLe && (!u.telephone || !!telephoneVerifieLe),
      enLigne: u.actif && !!u.derniereActivite && u.derniereActivite.getTime() > seuil,
      nbCalculs: _count.calculs,
    })),
  });
});

const schemaJournal = z.object({ page: z.coerce.number().int().min(1).default(1), parPage: z.coerce.number().int().min(1).max(100).default(50) });

routesAdmin.get('/connexions', async (req, res) => {
  const p = valider(schemaJournal, req.query);
  const where = { action: { in: EVENEMENTS } };
  const [total, evenements] = await Promise.all([
    prisma.journalAudit.count({ where }),
    prisma.journalAudit.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      skip: (p.page - 1) * p.parPage,
      take: p.parPage,
      select: { id: true, action: true, cible: true, details: true, creeLe: true, utilisateur: { select: { nom: true, email: true } } },
    }),
  ]);
  res.json({ evenements, total, page: p.page, parPage: p.parPage });
});

const schemaMaj = z.object({ role: z.enum(['ADMIN', 'COMPTABLE', 'LECTEUR']).optional(), actif: z.boolean().optional() }).refine((d) => d.role !== undefined || d.actif !== undefined, 'Aucune modification transmise');

routesAdmin.patch('/utilisateurs/:id', async (req, res) => {
  const d = valider(schemaMaj, req.body);
  const id = String(req.params.id);
  if (id === req.session!.id) throw new ErreurApi(409, 'SOI_MEME', 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre propre compte.');
  const u = await prisma.utilisateur.findUnique({ where: { id } });
  if (!u) throw nonTrouve('Utilisateur');
  // L'application garde toujours au moins un administrateur actif.
  const perdAdmin = u.role === 'ADMIN' && u.actif && ((d.role !== undefined && d.role !== 'ADMIN') || d.actif === false);
  if (perdAdmin && (await prisma.utilisateur.count({ where: { role: 'ADMIN', actif: true } })) <= 1)
    throw new ErreurApi(409, 'DERNIER_ADMIN', 'Il doit rester au moins un administrateur actif.');
  const maj = await prisma.utilisateur.update({
    where: { id },
    // Désactivation : versionSession + 1 ferme aussi les sessions déjà ouvertes.
    data: { ...(d.role !== undefined && { role: d.role }), ...(d.actif !== undefined && { actif: d.actif, ...(!d.actif && { versionSession: { increment: 1 } }) }) },
    select: { id: true, role: true, actif: true },
  });
  if (d.role !== undefined && d.role !== u.role) await journaliser(req.session!.id, 'CHANGEMENT_ROLE', u.email, { de: u.role, vers: d.role });
  if (d.actif !== undefined && d.actif !== u.actif) await journaliser(req.session!.id, d.actif ? 'COMPTE_REACTIVE' : 'COMPTE_DESACTIVE', u.email);
  res.json({ utilisateur: maj });
});
