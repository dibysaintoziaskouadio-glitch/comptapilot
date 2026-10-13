/** Construction des plans d'amortissement (fonctions pures réutilisées par plusieurs formules). */
import {
  ajouterJours,
  ajouterMois,
  comparer,
  d,
  Decimal,
  euros,
  joursEntre,
  joursFiscaux360,
  moisInclus,
  UN,
  Valeur,
  ZERO,
} from '../noyau';

export type Prorata = 'jours360' | 'joursReels' | 'mois' | 'aucun';

export interface LignePlan {
  rang: number;
  debutExercice: string;
  cloture: string;
  base: Decimal;
  vncDebut: Decimal;
  dotation: Decimal;
  cumul: Decimal;
  vnc: Decimal;
  /** Pour le dégressif : taux appliqué ou « linéaire » après bascule. */
  mode?: string;
}

/** Fraction d'exercice entre la mise en service et la clôture du premier exercice. */
export function fractionPremierExercice(miseEnService: string, cloture: string, prorata: Prorata): Decimal {
  const debutEx = ajouterJours(ajouterMois(cloture, -12), 1);
  if (prorata === 'aucun' || comparer(miseEnService, debutEx) <= 0) return UN;
  switch (prorata) {
    case 'jours360':
      return d(joursFiscaux360(miseEnService, cloture)).div(360);
    case 'joursReels':
      return d(joursEntre(miseEnService, cloture) + 1).div(joursEntre(debutEx, cloture) + 1);
    case 'mois':
      return d(moisInclus(miseEnService, cloture)).div(12);
  }
}

/** Clôtures successives d'exercices de 12 mois à partir de la première clôture. */
export function cloture(premiere: string, rang: number): string {
  return ajouterMois(premiere, 12 * (rang - 1));
}

/**
 * Plan linéaire : annuité = (VO − VR) / n, première annuité au prorata,
 * dernière annuité = solde (le cumul égale exactement la base amortissable).
 */
export function planLineaire(vo: Valeur, vr: Valeur, duree: Valeur, miseEnService: string, premiereCloture: string, prorata: Prorata): LignePlan[] {
  const base = d(vo).minus(vr);
  const annuite = base.div(duree);
  const f1 = fractionPremierExercice(miseEnService, premiereCloture, prorata);
  const lignes: LignePlan[] = [];
  let cumul = ZERO;
  for (let rang = 1; cumul.lessThan(base) && rang <= 200; rang++) {
    const theorique = rang === 1 ? annuite.times(f1) : annuite;
    const dot = euros(Decimal.min(theorique, base.minus(cumul)));
    // Dernière annuité : on solde exactement la base pour éviter tout résidu d'arrondi.
    const reste = base.minus(cumul).minus(dot);
    const dotation = reste.lessThan('0.05') ? base.minus(cumul) : dot;
    const vncDebut = d(vo).minus(cumul);
    cumul = cumul.plus(dotation);
    const cl = cloture(premiereCloture, rang);
    lignes.push({
      rang,
      debutExercice: rang === 1 ? miseEnService : ajouterJours(cloture(premiereCloture, rang - 1), 1),
      cloture: cl,
      base,
      vncDebut,
      dotation,
      cumul,
      vnc: d(vo).minus(cumul),
    });
  }
  return lignes;
}

/** Coefficient fiscal du dégressif selon la durée (CGI art. 39 A, ann. II art. 15 bis). */
export function coefficientDegressif(duree: number): Decimal {
  if (duree < 3) return ZERO;
  if (duree <= 4) return d('1.25');
  if (duree <= 6) return d('1.75');
  return d('2.25');
}

/**
 * Plan dégressif fiscal : taux = (1/n) × coefficient, prorata en mois à compter du
 * premier jour du mois d'acquisition, bascule en linéaire lorsque l'annuité
 * linéaire sur la durée restante devient supérieure.
 */
export function planDegressif(vo: Valeur, duree: number, acquisition: string, premiereCloture: string, coefficient?: Decimal): LignePlan[] {
  const coef = coefficient ?? coefficientDegressif(duree);
  const tx = UN.div(duree).times(coef);
  const f1 = fractionPremierExercice(acquisition, premiereCloture, 'mois');
  const lignes: LignePlan[] = [];
  let vnc = d(vo);
  let cumul = ZERO;
  let bascule = false;
  for (let rang = 1; rang <= duree; rang++) {
    const restant = duree - rang + 1;
    const degressive = vnc.times(tx).times(rang === 1 ? f1 : UN);
    const lineaire = vnc.div(restant).times(rang === 1 ? f1 : UN);
    if (!bascule && rang > 1 && lineaire.greaterThanOrEqualTo(degressive)) bascule = true;
    let dot = euros(bascule ? lineaire : degressive);
    if (rang === duree) dot = vnc; // dernière annuité : solde
    const vncDebut = vnc;
    vnc = vnc.minus(dot);
    cumul = cumul.plus(dot);
    lignes.push({
      rang,
      debutExercice: rang === 1 ? acquisition : ajouterJours(cloture(premiereCloture, rang - 1), 1),
      cloture: cloture(premiereCloture, rang),
      base: d(vo),
      vncDebut,
      dotation: dot,
      cumul,
      vnc,
      mode: bascule ? 'Linéaire' : `Dégressif ${tx.times(100).toDecimalPlaces(2).toFixed()} %`,
    });
  }
  return lignes;
}

export function lignesTableau(plan: LignePlan[]): Record<string, string>[] {
  return plan.map((l) => ({
    rang: String(l.rang),
    cloture: l.cloture,
    vncDebut: l.vncDebut.toFixed(2),
    dotation: l.dotation.toFixed(2),
    cumul: l.cumul.toFixed(2),
    vnc: l.vnc.toFixed(2),
    ...(l.mode ? { mode: l.mode } : {}),
  }));
}

export const COLONNES_PLAN = [
  { cle: 'rang', libelle: 'Exercice', unite: 'entier' as const },
  { cle: 'cloture', libelle: 'Clôture', unite: 'date' as const },
  { cle: 'vncDebut', libelle: 'VNC début', unite: 'EUR' as const },
  { cle: 'dotation', libelle: 'Dotation', unite: 'EUR' as const },
  { cle: 'cumul', libelle: 'Cumul', unite: 'EUR' as const },
  { cle: 'vnc', libelle: 'VNC fin', unite: 'EUR' as const },
];
