/**
 * Arithmétique décimale exacte du moteur.
 *
 * Toutes les valeurs monétaires et tous les taux transitent par cette instance
 * de Decimal.js configurée à 28 chiffres significatifs. Aucun calcul n'utilise
 * de nombre flottant IEEE-754 (float64).
 */
import DecimalJs from 'decimal.js';

export const Decimal = DecimalJs.clone({
  precision: 28,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
  // Au-delà de 10^100, une valeur devient infinie (et le calcul est refusé) : une puissance démesurée
  // ne produit jamais un nombre de millions de chiffres que l'affichage devrait ensuite écrire.
  maxE: 100,
  minE: -100,
});
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Decimal = DecimalJs;

export type Valeur = DecimalJs | string | number;

/** Construit un décimal (accepte la virgule française et les espaces de milliers). */
export function d(v: Valeur): Decimal {
  if (DecimalJs.isDecimal(v)) return new Decimal(v);
  if (typeof v === 'string') return new Decimal(normaliserNombre(v));
  return new Decimal(v);
}

export function normaliserNombre(s: string): string {
  return s.trim().replace(/[\s  ]/g, '').replace(',', '.');
}

export const ZERO = new Decimal(0);
export const UN = new Decimal(1);
export const CENT = new Decimal(100);

export type ModeArrondi =
  | 'comptable' // au plus proche, 0,5 vers le haut (arrondi commercial)
  | 'bancaire' // au plus proche, 0,5 vers le pair
  | 'troncature' // vers zéro
  | 'exces' // à l'opposé de zéro
  | 'plafond' // vers +∞
  | 'plancher'; // vers −∞

const MODES: Record<ModeArrondi, DecimalJs.Rounding> = {
  comptable: DecimalJs.ROUND_HALF_UP,
  bancaire: DecimalJs.ROUND_HALF_EVEN,
  troncature: DecimalJs.ROUND_DOWN,
  exces: DecimalJs.ROUND_UP,
  plafond: DecimalJs.ROUND_CEIL,
  plancher: DecimalJs.ROUND_FLOOR,
};

/** Arrondi à n décimales selon le mode demandé (comptable par défaut). */
export function arrondi(v: Valeur, decimales = 2, mode: ModeArrondi = 'comptable'): Decimal {
  return d(v).toDecimalPlaces(decimales, MODES[mode]);
}

/** Arrondi au centime (2 décimales, au plus proche). */
export function euros(v: Valeur): Decimal {
  return arrondi(v, 2, 'comptable');
}

/**
 * Arrondi fiscal à l'euro : les fractions inférieures à 0,50 € sont négligées,
 * celles de 0,50 € et plus sont comptées pour 1 € (CGI art. 1657, 1-a).
 */
export function arrondiFiscal(v: Valeur): Decimal {
  return arrondi(v, 0, 'comptable');
}

export function somme(valeurs: Valeur[]): Decimal {
  return valeurs.reduce<Decimal>((acc, v) => acc.plus(d(v)), ZERO);
}

export function max(...valeurs: Valeur[]): Decimal {
  return valeurs.map(d).reduce((a, b) => (b.greaterThan(a) ? b : a));
}

export function min(...valeurs: Valeur[]): Decimal {
  return valeurs.map(d).reduce((a, b) => (b.lessThan(a) ? b : a));
}

/** Borne v dans [bas, haut]. */
export function borner(v: Valeur, bas: Valeur, haut: Valeur): Decimal {
  return max(bas, min(v, haut));
}

/** Pourcentage saisi (20) → fraction (0,2). */
export function pct(v: Valeur): Decimal {
  return d(v).div(100);
}

/** Division protégée : renvoie `siZero` quand le diviseur est nul. */
export function diviser(a: Valeur, b: Valeur, siZero: Valeur = 0): Decimal {
  const den = d(b);
  return den.isZero() ? d(siZero) : d(a).div(den);
}

/** Positif ou zéro : max(v, 0). */
export function positif(v: Valeur): Decimal {
  return max(v, 0);
}
