import { ajouterVersion, listerBaremes } from '@compta/moteurs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

const versStatut = (s: 'officiel' | 'a_verifier'): 'OFFICIEL' | 'A_VERIFIER' => (s === 'officiel' ? 'OFFICIEL' : 'A_VERIFIER');

/**
 * Synchronise la base versionnée avec la bibliothèque :
 * 1. les versions livrées avec le moteur sont inscrites en base (historisation) ;
 * 2. les versions saisies par un administrateur sont chargées dans le moteur.
 */
export async function synchroniserBaremes(): Promise<void> {
  const enBase = await prisma.versionBareme.findMany();
  const cles = new Set(enBase.map((v) => `${v.code}|${v.du}`));
  const aCreer: Prisma.VersionBaremeCreateManyInput[] = [];
  for (const b of listerBaremes())
    for (const v of b.versions)
      if (!cles.has(`${b.code}|${v.du}`))
        aCreer.push({ code: b.code, moteur: b.moteur, libelle: b.libelle, du: v.du, au: v.au ?? null, valeurs: v.valeurs as Prisma.InputJsonValue, source: v.source, note: v.note ?? null, statut: versStatut(v.statut), origine: 'BIBLIOTHEQUE' });
  if (aCreer.length) await prisma.versionBareme.createMany({ data: aCreer, skipDuplicates: true });
  const saisies = enBase.filter((v) => v.origine === 'SAISIE');
  for (const v of saisies) {
    try {
      ajouterVersion(v.code, { du: v.du, au: v.au ?? undefined, valeurs: v.valeurs, source: v.source, note: v.note ?? undefined, statut: v.statut === 'OFFICIEL' ? 'officiel' : 'a_verifier' });
    } catch (e) {
      logger.warn({ code: v.code, err: e }, 'Version de barème ignorée');
    }
  }
  logger.info({ inscrites: aCreer.length, chargees: saisies.length }, 'Barèmes synchronisés');
}
