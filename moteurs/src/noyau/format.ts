/** Mise en forme française des valeurs dans les traces de calcul. */
import { d, Decimal, Valeur } from './decimal';

const ESPACE = ' ';

function grouper(entier: string): string {
  return entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
}

/** 1234.5 → « 1 234,50 » */
export function fr(v: Valeur, decimales = 2): string {
  const s = d(v).toFixed(decimales);
  const negatif = s.startsWith('-');
  const [ent, dec] = (negatif ? s.slice(1) : s).split('.');
  return (negatif ? '−' : '') + grouper(ent) + (dec ? ',' + dec : '');
}

/** Format libre : supprime les zéros non significatifs (max `decimales`). */
export function frn(v: Valeur, decimales = 6): string {
  const x = d(v).toDecimalPlaces(decimales);
  const nd = Math.max(0, x.decimalPlaces());
  return fr(x, nd);
}

/** Montant en euros : « 1 234,50 € » */
export function fe(v: Valeur): string {
  return fr(v, 2) + ESPACE + '€';
}

/** Fraction → pourcentage : 0,2 → « 20 % » ; décimales non significatives supprimées. */
export function fp(fraction: Valeur, decimales = 4): string {
  return frn(d(fraction).times(100), decimales) + ESPACE + '%';
}

/** Date ISO → « 31/12/2024 » */
export function fd(iso: string): string {
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

export function signe(v: Decimal): string {
  return v.isNegative() ? '−' : '+';
}
