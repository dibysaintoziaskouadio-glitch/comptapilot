/** Primitives financières partagées (actualisation, annuités, TRI), en Decimal. */
import { d, Decimal, UN, Valeur, ZERO } from './decimal';
import { ErreurCalcul } from './erreurs';

/** (1 + i)^n — n peut être fractionnaire. */
export function facteur(i: Valeur, n: Valeur): Decimal {
  return UN.plus(d(i)).pow(d(n));
}

/** Valeur actuelle nette d'une série de flux F0, F1, … Fn (F0 en t = 0). */
export function van(taux: Valeur, flux: Valeur[]): Decimal {
  return vanEtDerivee(d(taux), flux)[0];
}

/** VAN et dérivée dVAN/dtaux en un seul passage (facteur d'actualisation incrémental). */
function vanEtDerivee(taux: Decimal, flux: Valeur[]): [Decimal, Decimal] {
  const v = UN.div(UN.plus(taux));
  let facteurT = UN; // v^t
  let s = ZERO;
  let der = ZERO;
  flux.forEach((f, t) => {
    const x = d(f);
    s = s.plus(x.times(facteurT));
    if (t > 0) der = der.minus(x.times(t).times(facteurT).times(v));
    facteurT = facteurT.times(v);
  });
  return [s, der];
}

/**
 * Taux de rentabilité interne : taux annulant la VAN.
 * Recherche d'un encadrement puis dichotomie affinée par Newton (déterministe).
 * Renvoie null si aucun changement de signe n'existe sur ]−99 % ; 10 000 %].
 */
export function tri(flux: Valeur[], precision = '1e-14'): Decimal | null {
  const eps = d(precision);
  // 1) Newton amorti, initialisé par le rendement moyen pondéré par la durée des flux :
  //    g0 = (Σ flux positifs / |flux initiaux|)^(1 / durée moyenne) − 1.
  const fl = flux.map((f) => d(f));
  const entrees = fl.reduce((acc, f) => (f.greaterThan(0) ? acc.plus(f) : acc), ZERO);
  const sorties = fl.reduce((acc, f) => (f.isNegative() ? acc.plus(f.neg()) : acc), ZERO);
  const duree = entrees.isZero() ? UN : fl.reduce((acc, f, t) => (f.greaterThan(0) ? acc.plus(f.times(t)) : acc), ZERO).div(entrees);
  let g = sorties.isZero() || entrees.isZero() || duree.isZero() ? d('0.1') : entrees.div(sorties).pow(UN.div(duree)).minus(1);
  for (let k = 0; k < 60; k++) {
    const [f, der] = vanEtDerivee(g, fl);
    if (der.isZero()) break;
    let pas = f.div(der);
    // Amortissement : on divise le pas tant qu'il sort du domaine ]−99 % ; +∞[.
    for (let j = 0; j < 30 && g.minus(pas).lessThanOrEqualTo('-0.99'); j++) pas = pas.div(2);
    const suivant = g.minus(pas);
    if (suivant.lessThanOrEqualTo('-0.99')) break;
    if (suivant.minus(g).abs().lessThan(eps)) return suivant;
    g = suivant;
  }
  // 2) Repli : encadrement puis dichotomie / Newton protégé.
  let bas = d('-0.99');
  let haut = d('0.1');
  let fBas = van(bas, flux);
  let fHaut = van(haut, flux);
  let essais = 0;
  while (fBas.times(fHaut).greaterThan(0) && !fHaut.isZero()) {
    haut = haut.times(2).plus('0.1');
    fHaut = van(haut, flux);
    if (++essais > 12) return null; // au-delà de ~ 400 000 %
  }
  if (fHaut.isZero()) return haut;
  if (fBas.isZero()) return bas;
  let x = bas.plus(haut).div(2);
  for (let k = 0; k < 400; k++) {
    const fx = van(x, flux);
    if (fx.abs().lessThan(eps)) return x;
    if (fx.times(fBas).isNegative()) {
      haut = x;
    } else {
      bas = x;
      fBas = fx;
    }
    // Pas de Newton si il reste dans l'encadrement, sinon dichotomie.
    const der = vanEtDerivee(x, flux)[1];
    let suivant = der.isZero() ? null : x.minus(fx.div(der));
    if (!suivant || suivant.lessThanOrEqualTo(bas) || suivant.greaterThanOrEqualTo(haut)) suivant = bas.plus(haut).div(2);
    if (suivant.minus(x).abs().lessThan(eps)) return suivant;
    x = suivant;
  }
  return x;
}

/** Résout f(x) = 0 par dichotomie sur [bas, haut] (f monotone ou changement de signe). */
export function dichotomie(f: (x: Decimal) => Decimal, bas: Valeur, haut: Valeur, iterations = 200, precision = '1e-12'): Decimal {
  let a = d(bas);
  let b = d(haut);
  let fa = f(a);
  const fb = f(b);
  if (fa.isZero()) return a;
  if (fb.isZero()) return b;
  if (fa.times(fb).greaterThan(0)) throw new ErreurCalcul('Aucune solution dans l’intervalle de recherche.');
  for (let k = 0; k < iterations; k++) {
    const m = a.plus(b).div(2);
    const fm = f(m);
    if (fm.isZero() || b.minus(a).abs().lessThan(precision)) return m;
    if (fm.times(fa).isNegative()) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return a.plus(b).div(2);
}

/**
 * Échéance constante d'un emprunt : C × i / (1 − (1 + i)^−n).
 * Paiement en fin de période ; valeur résiduelle VR remboursée in fine optionnelle.
 */
export function annuiteConstante(capital: Valeur, i: Valeur, n: number, valeurResiduelle: Valeur = 0): Decimal {
  const ti = d(i);
  const vr = d(valeurResiduelle);
  if (ti.isZero()) return d(capital).minus(vr).div(n);
  const actualiseVr = vr.div(facteur(ti, n));
  return d(capital).minus(actualiseVr).times(ti).div(UN.minus(facteur(ti, -n)));
}

/** Taux périodique équivalent à un taux annuel : (1 + t)^(1/k) − 1. */
export function tauxEquivalent(tauxAnnuel: Valeur, periodesParAn: number): Decimal {
  return UN.plus(d(tauxAnnuel)).pow(UN.div(periodesParAn)).minus(1);
}

/** Taux annuel actuariel correspondant à un taux périodique : (1 + i)^k − 1. */
export function tauxAnnuelActuariel(tauxPeriodique: Valeur, periodesParAn: number): Decimal {
  return UN.plus(d(tauxPeriodique)).pow(periodesParAn).minus(1);
}
