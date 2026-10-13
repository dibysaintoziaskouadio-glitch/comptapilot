import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ErreurApi, nonTrouve } from '../../utils/erreurs';
import { valider } from '../../utils/validation';
import { journaliser } from '../audit';

export const routesHistorique = Router();

const schemaListe = z.object({
  moteur: z.string().optional(),
  formule: z.string().optional(),
  statut: z.enum(['BROUILLON', 'VALIDE']).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  parPage: z.coerce.number().int().min(1).max(100).default(20),
});

routesHistorique.get('/', async (req, res) => {
  const p = valider(schemaListe, req.query);
  const where: Prisma.CalculWhereInput = {
    utilisateurId: req.session!.id,
    ...(p.moteur ? { moteur: p.moteur } : {}),
    ...(p.formule ? { formuleId: p.formule } : {}),
    ...(p.statut ? { statut: p.statut } : {}),
    ...(p.q ? { OR: [{ libelle: { contains: p.q, mode: 'insensitive' } }, { formuleNom: { contains: p.q, mode: 'insensitive' } }] } : {}),
  };
  const [total, calculs] = await Promise.all([
    prisma.calcul.count({ where }),
    prisma.calcul.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      skip: (p.page - 1) * p.parPage,
      take: p.parPage,
      select: { id: true, moteur: true, formuleId: true, formuleNom: true, formuleVersion: true, libelle: true, principal: true, principalValeur: true, principalUnite: true, devise: true, empreinte: true, nbErreurs: true, nbAvertissements: true, dureeMs: true, statut: true, valideLe: true, creeLe: true },
    }),
  ]);
  res.json({ calculs, total, page: p.page, parPage: p.parPage });
});

routesHistorique.get('/statistiques', async (req, res) => {
  const id = req.session!.id;
  const [parMoteur, total, valides, alertes] = await Promise.all([
    prisma.calcul.groupBy({ by: ['moteur'], where: { utilisateurId: id }, _count: { _all: true } }),
    prisma.calcul.count({ where: { utilisateurId: id } }),
    prisma.calcul.count({ where: { utilisateurId: id, statut: 'VALIDE' } }),
    prisma.calcul.count({ where: { utilisateurId: id, OR: [{ nbErreurs: { gt: 0 } }, { nbAvertissements: { gt: 0 } }] } }),
  ]);
  // Jours calendaires locaux (fuseau du serveur), aujourd'hui compris.
  const jourLocal = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const depuis = new Date();
  depuis.setHours(0, 0, 0, 0);
  depuis.setDate(depuis.getDate() - 13);
  const recents = await prisma.calcul.findMany({ where: { utilisateurId: id, creeLe: { gte: depuis } }, select: { creeLe: true } });
  const parJour: Record<string, number> = {};
  for (let i = 0; i < 14; i++) parJour[jourLocal(new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate() + i))] = 0;
  for (const r of recents) {
    const k = jourLocal(r.creeLe);
    if (k in parJour) parJour[k]++;
  }
  res.json({
    total,
    valides,
    alertes,
    parMoteur: Object.fromEntries(parMoteur.map((x) => [x.moteur, x._count._all])),
    parJour: Object.entries(parJour).map(([jour, n]) => ({ jour, n })),
  });
});

routesHistorique.get('/:id', async (req, res) => {
  const c = await prisma.calcul.findFirst({ where: { id: String(req.params.id), utilisateurId: req.session!.id } });
  if (!c) throw nonTrouve('Calcul');
  res.json({ calcul: c });
});

const schemaMaj = z.object({ libelle: z.string().trim().max(200).optional(), valider: z.literal(true).optional() });

routesHistorique.patch('/:id', async (req, res) => {
  const d = valider(schemaMaj, req.body);
  const c = await prisma.calcul.findFirst({ where: { id: String(req.params.id), utilisateurId: req.session!.id } });
  if (!c) throw nonTrouve('Calcul');
  if (d.valider && c.statut === 'VALIDE') throw new ErreurApi(409, 'DEJA_VALIDE', 'Ce calcul est déjà validé.');
  const maj = await prisma.calcul.update({
    where: { id: c.id },
    data: { ...(d.libelle !== undefined ? { libelle: d.libelle } : {}), ...(d.valider ? { statut: 'VALIDE', valideLe: new Date() } : {}) },
  });
  if (d.valider) await journaliser(req.session!.id, 'VALIDATION_CALCUL', c.id, { formule: `${c.moteur}/${c.formuleId}`, empreinte: c.empreinte });
  res.json({ calcul: maj });
});

routesHistorique.delete('/:id', async (req, res) => {
  const c = await prisma.calcul.findFirst({ where: { id: String(req.params.id), utilisateurId: req.session!.id } });
  if (!c) throw nonTrouve('Calcul');
  // Un calcul validé fait partie de la piste d'audit : il ne peut plus être supprimé.
  if (c.statut === 'VALIDE') throw new ErreurApi(409, 'CALCUL_VALIDE', 'Un calcul validé ne peut pas être supprimé (piste d’audit).');
  await prisma.calcul.delete({ where: { id: c.id } });
  res.status(204).end();
});
