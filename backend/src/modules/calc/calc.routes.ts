import { Router } from 'express';
import { z } from 'zod';
import { catalogue, decrireFormule, executerFormule, obtenirFormule, ResultatCalcul } from '@compta/moteurs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { limiteCalculs } from '../../middlewares/limites';
import { empreinte } from '../../utils/empreinte';
import { ErreurApi, nonTrouve } from '../../utils/erreurs';
import { valider } from '../../utils/validation';

export const routesCalc = Router();

/** Le catalogue est immuable pendant la vie du processus : calculé une fois. */
let cacheCatalogue: ReturnType<typeof catalogue> | null = null;
const cat = () => (cacheCatalogue ??= catalogue());

routesCalc.get('/catalogue', (_req, res) => {
  res.set('Cache-Control', 'private, max-age=300').json({ moteurs: cat() });
});

routesCalc.get('/:moteur', (req, res) => {
  const m = cat().find((x) => x.code === String(req.params.moteur));
  if (!m) throw nonTrouve('Moteur');
  res.json({ moteur: m });
});

routesCalc.get('/:moteur/:formule', (req, res) => {
  const f = obtenirFormule(String(req.params.moteur), String(req.params.formule));
  if (!f) throw nonTrouve('Formule');
  res.json({ formule: decrireFormule(f) });
});

const schemaExecution = z.object({
  entrees: z.record(z.unknown()).default({}),
  enregistrer: z.boolean().default(false),
  valider: z.boolean().default(false),
  libelle: z.string().trim().max(200).optional(),
});

export function empreinteResultat(r: ResultatCalcul): string {
  return empreinte({ formule: r.formule.id, moteur: r.formule.moteur, version: r.formule.version, entrees: r.entrees, resultats: r.resultats });
}

/**
 * POST /api/calc/{moteur}/{formule} — exécute la formule ; enregistre le calcul
 * dans le journal si `enregistrer` est vrai (statut VALIDE si `valider`).
 */
routesCalc.post('/:moteur/:formule', limiteCalculs, async (req, res) => {
  const f = obtenirFormule(String(req.params.moteur), String(req.params.formule));
  if (!f) throw nonTrouve('Formule');
  const d = valider(schemaExecution, req.body);
  const r = executerFormule(f, d.entrees);
  const hash = empreinteResultat(r);
  let calculId: string | undefined;
  if (d.enregistrer) {
    if (req.session!.role === 'LECTEUR') throw new ErreurApi(403, 'INTERDIT', 'Les lecteurs ne peuvent pas enregistrer de calcul.');
    const principal = Object.values(r.resultats).find((x) => x.principal) ?? Object.values(r.resultats)[0];
    const c = await prisma.calcul.create({
      data: {
        utilisateurId: req.session!.id,
        moteur: f.moteur,
        formuleId: f.id,
        formuleNom: f.nom,
        formuleVersion: r.formule.version,
        libelle: d.libelle,
        entrees: r.entrees as Prisma.InputJsonValue,
        resultat: r as unknown as Prisma.InputJsonValue,
        principal: principal ? `${principal.libelle} : ${principal.valeur}${principal.unite === 'EUR' ? ' €' : principal.unite === '%' ? ' %' : ''}` : null,
        empreinte: hash,
        nbErreurs: r.controles.filter((x) => x.niveau === 'erreur').length,
        nbAvertissements: r.controles.filter((x) => x.niveau === 'avertissement').length,
        dureeMs: r.dureeMs,
        statut: d.valider ? 'VALIDE' : 'BROUILLON',
        valideLe: d.valider ? new Date() : null,
      },
    });
    calculId = c.id;
  }
  res.json({ resultat: r, empreinte: hash, calculId });
});

