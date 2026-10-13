import { Router } from 'express';
import { z } from 'zod';
import { ajouterVersion, estDateIso, estObsolete, listerBaremes, obtenirBareme } from '@compta/moteurs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { exigerRole } from '../../middlewares/authentification';
import { ErreurApi, nonTrouve } from '../../utils/erreurs';
import { valider } from '../../utils/validation';
import { journaliser } from '../audit';

export const routesBaremes = Router();

routesBaremes.get('/', async (_req, res) => {
  const enBase = await prisma.versionBareme.findMany({ include: { auteur: { select: { nom: true } } } });
  const meta = new Map(enBase.map((v) => [`${v.code}|${v.du}`, v]));
  const aujourdHui = new Date().toISOString().slice(0, 10);
  res.json({
    baremes: listerBaremes()
      .filter((b) => !b.code.startsWith('test.'))
      .map((b) => {
        const enVigueur = [...b.versions].reverse().find((v) => v.du <= aujourdHui && (!v.au || aujourdHui <= v.au));
        return {
          code: b.code,
          moteur: b.moteur,
          libelle: b.libelle,
          description: b.description,
          revision: b.revision ?? 'annuelle',
          obsolete: estObsolete(b, aujourdHui),
          enVigueur: enVigueur?.du ?? null,
          versions: b.versions.map((v) => {
            const m = meta.get(`${b.code}|${v.du}`);
            return { ...v, origine: m?.origine ?? 'BIBLIOTHEQUE', auteur: m?.auteur?.nom ?? null, enregistreeLe: m?.creeLe ?? null };
          }),
        };
      }),
  });
});

const schemaVersion = z.object({
  du: z.string().refine(estDateIso, 'Date AAAA-MM-JJ attendue'),
  au: z.string().refine(estDateIso, 'Date AAAA-MM-JJ attendue').optional(),
  valeurs: z.record(z.unknown()),
  source: z.string().trim().min(3, 'Indiquer le texte de référence (loi de finances, arrêté…)').max(500),
  note: z.string().trim().max(500).optional(),
  statut: z.enum(['officiel', 'a_verifier']).default('officiel'),
});

/** Structure identique : mêmes clés (récursivement) que la dernière version connue. */
function memeStructure(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b);
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && memeStructure((a as never)[k], (b as never)[k]));
  }
  return typeof a === typeof b || a === null || b === null;
}

routesBaremes.post('/:code/versions', exigerRole('ADMIN'), async (req, res) => {
  let b;
  try {
    b = obtenirBareme(String(req.params.code));
  } catch {
    throw nonTrouve('Barème');
  }
  const d = valider(schemaVersion, req.body);
  const reference = b.versions[b.versions.length - 1].valeurs;
  if (!memeStructure(reference, d.valeurs)) throw new ErreurApi(422, 'STRUCTURE', 'Les valeurs doivent reprendre exactement la structure de la version précédente.');
  ajouterVersion(b.code, { du: d.du, au: d.au, valeurs: d.valeurs, source: d.source, note: d.note, statut: d.statut });
  const v = await prisma.versionBareme.upsert({
    where: { code_du: { code: b.code, du: d.du } },
    create: { code: b.code, moteur: b.moteur, libelle: b.libelle, du: d.du, au: d.au, valeurs: d.valeurs as Prisma.InputJsonValue, source: d.source, note: d.note, statut: d.statut === 'officiel' ? 'OFFICIEL' : 'A_VERIFIER', origine: 'SAISIE', auteurId: req.session!.id },
    update: { au: d.au, valeurs: d.valeurs as Prisma.InputJsonValue, source: d.source, note: d.note, statut: d.statut === 'officiel' ? 'OFFICIEL' : 'A_VERIFIER', origine: 'SAISIE', auteurId: req.session!.id },
  });
  await journaliser(req.session!.id, 'VERSION_BAREME', b.code, { du: d.du, source: d.source });
  res.status(201).json({ version: v });
});
