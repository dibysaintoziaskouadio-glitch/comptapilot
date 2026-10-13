/**
 * Calcul d'un bulletin de paie mensuel (régime général) — fonction pure.
 * Elle est utilisée par la formule « bulletin », par le calcul inverse net → brut
 * et par le coût employeur.
 */
import { arrondi, d, Decimal, euros, max, min, pct, positif, somme, UN, ZERO } from '../noyau';
import { ConstantesPaie, GrillePas, TauxCotisations } from './baremes';

export type TrancheEffectif = '1-10' | '11-19' | '20-49' | '50-249' | '250+';

export interface ParamsBulletin {
  statut: 'non-cadre' | 'cadre';
  effectif: TrancheEffectif;
  salaireBase: Decimal;
  heuresContrat: Decimal;
  hs25: Decimal;
  hs50: Decimal;
  primes: Decimal;
  avantagesNature: Decimal;
  absences: Decimal;
  fraisNonSoumis: Decimal;
  tauxAT: Decimal;
  tauxVM: Decimal;
  mutuelleSalarie: Decimal;
  mutuellePatronale: Decimal;
  prevoyanceSalarie: Decimal;
  prevoyancePatronale: Decimal;
  tauxPAS: Decimal | null; // null → taux neutre (grille)
  alsaceMoselle: boolean;
}

export interface LigneBulletin {
  rubrique: string;
  categorie: 'brut' | 'sante' | 'retraite' | 'chomage' | 'famille' | 'autres' | 'csg' | 'reduction' | 'net';
  base?: Decimal;
  tauxSal?: Decimal; // fraction
  montantSal?: Decimal;
  tauxPat?: Decimal;
  montantPat?: Decimal;
}

export interface Bulletin {
  lignes: LigneBulletin[];
  brut: Decimal;
  tauxHoraire: Decimal;
  montantHs: Decimal;
  plafond: Decimal;
  t1: Decimal;
  t2: Decimal;
  smicMois: Decimal;
  cotisationsSalariales: Decimal;
  cotisationsPatronales: Decimal;
  reductionGenerale: Decimal;
  coefficientRG: Decimal;
  deductionHs: Decimal;
  reductionHsSalariale: Decimal;
  netAvantImpot: Decimal;
  netImposable: Decimal;
  tauxPasApplique: Decimal;
  pas: Decimal;
  netAPayer: Decimal;
  coutEmployeur: Decimal;
  avantagesNature: Decimal;
  fraisNonSoumis: Decimal;
}

const moinsDe = (eff: TrancheEffectif, seuil: 11 | 20 | 50 | 250): boolean => {
  const bornes: Record<TrancheEffectif, number> = { '1-10': 10, '11-19': 19, '20-49': 49, '50-249': 249, '250+': 1e9 };
  return bornes[eff] < seuil;
};

export function tauxNeutre(grille: GrillePas, base: Decimal): Decimal {
  const tr = grille.tranches.find((t) => t.jusqua === null || base.lessThan(t.jusqua))!;
  return pct(tr.taux);
}

export function calculerBulletin(p: ParamsBulletin, k: ConstantesPaie, t: TauxCotisations, grille: GrillePas | null): Bulletin {
  const lignes: LigneBulletin[] = [];
  const dureeLegale = d(k.dureeLegaleMensuelle);
  const th = p.salaireBase.div(p.heuresContrat);
  const hs25 = euros(p.hs25.times(th).times('1.25'));
  const hs50 = euros(p.hs50.times(th).times('1.5'));
  const montantHs = hs25.plus(hs50);
  lignes.push({ rubrique: 'Salaire de base', categorie: 'brut', base: p.heuresContrat, montantSal: p.salaireBase });
  if (!hs25.isZero()) lignes.push({ rubrique: 'Heures supplémentaires à 25 %', categorie: 'brut', base: p.hs25, montantSal: hs25 });
  if (!hs50.isZero()) lignes.push({ rubrique: 'Heures supplémentaires à 50 %', categorie: 'brut', base: p.hs50, montantSal: hs50 });
  if (!p.primes.isZero()) lignes.push({ rubrique: 'Primes et gratifications', categorie: 'brut', montantSal: p.primes });
  if (!p.avantagesNature.isZero()) lignes.push({ rubrique: 'Avantages en nature', categorie: 'brut', montantSal: p.avantagesNature });
  if (!p.absences.isZero()) lignes.push({ rubrique: 'Retenue pour absence', categorie: 'brut', montantSal: p.absences.neg() });
  const brut = euros(p.salaireBase.plus(montantHs).plus(p.primes).plus(p.avantagesNature).minus(p.absences));

  // Plafond proratisé pour un temps partiel (CSS art. R.242-2).
  const plafond = euros(d(k.pmss).times(min(UN, p.heuresContrat.div(dureeLegale))));
  const t1 = min(brut, plafond);
  const t2 = min(positif(brut.minus(plafond)), plafond.times(7));
  const quatreP = min(brut, plafond.times(4));
  const heuresRemunerees = p.heuresContrat.plus(p.hs25).plus(p.hs50);
  const smicMois = euros(d(k.smicHoraire).times(heuresRemunerees));

  const cot = (rubrique: string, categorie: LigneBulletin['categorie'], base: Decimal, tauxSal: string | null, tauxPat: string | null) => {
    const ts = tauxSal ? pct(tauxSal) : undefined;
    const tp = tauxPat ? pct(tauxPat) : undefined;
    const l: LigneBulletin = { rubrique, categorie, base };
    if (ts) {
      l.tauxSal = ts;
      l.montantSal = euros(base.times(ts));
    }
    if (tp) {
      l.tauxPat = tp;
      l.montantPat = euros(base.times(tp));
    }
    if ((l.montantSal && !l.montantSal.isZero()) || (l.montantPat && !l.montantPat.isZero())) lignes.push(l);
  };

  // Santé
  cot('Maladie, maternité, invalidité, décès', 'sante', brut, null, t.maladie.patronal);
  if (brut.greaterThan(smicMois.times(t.maladie.seuilSmic))) cot('Maladie — complément au-delà du seuil', 'sante', brut, null, t.maladie.complement);
  if (p.alsaceMoselle) cot('Maladie — régime local Alsace-Moselle', 'sante', brut, t.alsaceMoselle, null);
  if (!p.mutuelleSalarie.isZero() || !p.mutuellePatronale.isZero())
    lignes.push({ rubrique: 'Complémentaire santé', categorie: 'sante', montantSal: p.mutuelleSalarie, montantPat: p.mutuellePatronale });
  if (!p.prevoyanceSalarie.isZero() || !p.prevoyancePatronale.isZero())
    lignes.push({ rubrique: 'Prévoyance', categorie: 'sante', montantSal: p.prevoyanceSalarie, montantPat: p.prevoyancePatronale });
  if (p.statut === 'cadre') cot('Prévoyance cadres (minimum conventionnel T1)', 'sante', t1, null, t.prevoyanceCadreMin);
  cot('Accidents du travail — maladies professionnelles', 'sante', brut, null, p.tauxAT.times(100).toFixed());

  // Retraite
  cot('Sécurité sociale plafonnée', 'retraite', t1, t.vieillessePlafonnee.salarial, t.vieillessePlafonnee.patronal);
  cot('Sécurité sociale déplafonnée', 'retraite', brut, t.vieillesseDeplafonnee.salarial, t.vieillesseDeplafonnee.patronal);
  cot('Complémentaire AGIRC-ARRCO Tranche 1', 'retraite', t1, t.agircT1.salarial, t.agircT1.patronal);
  cot('Complémentaire AGIRC-ARRCO Tranche 2', 'retraite', t2, t.agircT2.salarial, t.agircT2.patronal);
  cot('CEG Tranche 1', 'retraite', t1, t.cegT1.salarial, t.cegT1.patronal);
  cot('CEG Tranche 2', 'retraite', t2, t.cegT2.salarial, t.cegT2.patronal);
  if (brut.greaterThan(plafond)) cot('CET', 'retraite', t1.plus(t2), t.cet.salarial, t.cet.patronal);
  if (p.statut === 'cadre') cot('APEC', 'retraite', quatreP, t.apec.salarial, t.apec.patronal);

  // Famille
  const afPlein = brut.greaterThan(smicMois.times(t.allocationsFamiliales.seuilSmic));
  cot('Allocations familiales', 'famille', brut, null, afPlein ? t.allocationsFamiliales.plein : t.allocationsFamiliales.reduit);

  // Chômage
  cot('Assurance chômage', 'chomage', quatreP, null, t.chomage);
  cot('AGS', 'chomage', quatreP, null, t.ags);

  // Autres contributions employeur
  const moins50 = moinsDe(p.effectif, 50);
  cot('FNAL', 'autres', moins50 ? t1 : brut, null, moins50 ? t.fnal.moins50 : t.fnal.plus50);
  cot('Contribution solidarité autonomie', 'autres', brut, null, t.csa);
  cot('Formation professionnelle', 'autres', brut, null, moinsDe(p.effectif, 11) ? t.formation.moins11 : t.formation.plus11);
  cot("Taxe d'apprentissage", 'autres', brut, null, t.apprentissage);
  cot('Contribution au dialogue social', 'autres', brut, null, t.dialogueSocial);
  if (!p.tauxVM.isZero() && !moinsDe(p.effectif, 11)) cot('Versement mobilité', 'autres', brut, null, p.tauxVM.times(100).toFixed());
  const prevPat = p.mutuellePatronale.plus(p.prevoyancePatronale).plus(p.statut === 'cadre' ? euros(t1.times(pct(t.prevoyanceCadreMin))) : ZERO);
  if (!moinsDe(p.effectif, 11)) cot('Forfait social sur prévoyance', 'autres', prevPat, null, t.forfaitSocialPrevoyance);

  // CSG / CRDS : 98,25 % du brut dans la limite de 4 PASS + contributions patronales de prévoyance.
  const assietteCsg = euros(quatreP.times(UN.minus(pct(t.abattementCsg))).plus(brut.minus(quatreP)).plus(prevPat));
  cot('CSG déductible', 'csg', assietteCsg, t.csgDeductible, null);
  cot('CSG non déductible', 'csg', assietteCsg, t.csgNonDeductible, null);
  cot('CRDS', 'csg', assietteCsg, t.crds, null);

  // Réduction salariale sur heures supplémentaires (CSS art. L.241-17)
  const reductionHsSalariale = euros(montantHs.times(pct(t.reductionHsSalariale)));
  if (!reductionHsSalariale.isZero()) lignes.push({ rubrique: 'Réduction de cotisations salariales sur heures supplémentaires', categorie: 'reduction', base: montantHs, tauxSal: pct(t.reductionHsSalariale), montantSal: reductionHsSalariale.neg() });

  // Réduction générale des cotisations patronales
  const rg = t.reductionGenerale;
  let coef = ZERO;
  if (rg.formule === 'fillon') {
    const T = d(moins50 ? rg.tFnal010 : rg.tFnal050);
    if (brut.lessThan(smicMois.times(rg.plafondSmic)) && brut.greaterThan(0)) {
      coef = arrondi(T.div('0.6').times(d(rg.plafondSmic).times(smicMois).div(brut).minus(1)), 4);
      coef = min(max(coef, 0), T);
    }
  } else {
    const tDelta = d(moins50 ? rg.tDeltaFnal010 : rg.tDeltaFnal050);
    if (brut.lessThan(smicMois.times(rg.plafondSmic)) && brut.greaterThan(0)) {
      const x = d('0.5').times(d(rg.plafondSmic).times(smicMois).div(brut).minus(1));
      coef = arrondi(d(rg.tMin).plus(tDelta.times(positif(x).pow(rg.puissance))), 4);
      coef = min(coef, d(rg.tMin).plus(tDelta));
    }
  }
  const reductionGenerale = euros(brut.times(coef));
  if (!reductionGenerale.isZero()) lignes.push({ rubrique: `Réduction générale des cotisations (${rg.formule === 'rgdu' ? 'RGDU' : 'ex-Fillon'})`, categorie: 'reduction', base: brut, tauxPat: coef, montantPat: reductionGenerale.neg() });

  // Déduction forfaitaire patronale sur heures supplémentaires (CSS art. L.241-18)
  const nbHs = p.hs25.plus(p.hs50);
  const forfait = moinsDe(p.effectif, 20) ? d(t.deductionHs.moins20) : moinsDe(p.effectif, 250) ? d(t.deductionHs.de20a249) : ZERO;
  const deductionHs = euros(nbHs.times(forfait));
  if (!deductionHs.isZero()) lignes.push({ rubrique: 'Déduction forfaitaire patronale heures supplémentaires', categorie: 'reduction', base: nbHs, montantPat: deductionHs.neg() });

  const cotisationsSalariales = somme(lignes.filter((l) => l.categorie !== 'brut').map((l) => l.montantSal ?? ZERO));
  const cotisationsPatronales = somme(lignes.filter((l) => l.categorie !== 'brut').map((l) => l.montantPat ?? ZERO));

  const csgNonDed = somme(lignes.filter((l) => l.rubrique === 'CSG non déductible' || l.rubrique === 'CRDS').map((l) => l.montantSal ?? ZERO));
  const netAvantImpot = brut.minus(cotisationsSalariales);
  // Net imposable : + CSG/CRDS non déductibles + part patronale santé ; − heures supplémentaires exonérées (CGI art. 81 quater)
  const netImposable = euros(netAvantImpot.plus(csgNonDed).plus(p.mutuellePatronale).minus(montantHs));
  const tauxPasApplique = p.tauxPAS ?? (grille ? tauxNeutre(grille, netImposable) : ZERO);
  const pas = euros(positif(netImposable).times(tauxPasApplique));
  const netAPayer = netAvantImpot.minus(pas).minus(p.avantagesNature).plus(p.fraisNonSoumis);
  const coutEmployeur = brut.plus(cotisationsPatronales).plus(p.fraisNonSoumis);

  return {
    lignes,
    brut,
    tauxHoraire: th,
    montantHs,
    plafond,
    t1,
    t2,
    smicMois,
    cotisationsSalariales,
    cotisationsPatronales,
    reductionGenerale,
    coefficientRG: coef,
    deductionHs,
    reductionHsSalariale,
    netAvantImpot,
    netImposable,
    tauxPasApplique,
    pas,
    netAPayer,
    coutEmployeur,
    avantagesNature: p.avantagesNature,
    fraisNonSoumis: p.fraisNonSoumis,
  };
}
