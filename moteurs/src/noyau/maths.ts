/** Statistiques, algèbre linéaire et générateur pseudo-aléatoire déterministe, en Decimal. */
import { d, Decimal, somme, UN, Valeur, ZERO } from './decimal';
import { ErreurCalcul } from './erreurs';

export function moyenne(vs: Valeur[]): Decimal {
  if (vs.length === 0) throw new ErreurCalcul('Moyenne d’une série vide.');
  return somme(vs).div(vs.length);
}

/** Variance (population si `echantillon` = false, sinon échantillon n − 1). */
export function variance(vs: Valeur[], echantillon = false): Decimal {
  const m = moyenne(vs);
  const n = echantillon ? vs.length - 1 : vs.length;
  if (n <= 0) return ZERO;
  return somme(vs.map((v) => d(v).minus(m).pow(2))).div(n);
}

export function ecartType(vs: Valeur[], echantillon = false): Decimal {
  return variance(vs, echantillon).sqrt();
}

export function covariance(xs: Valeur[], ys: Valeur[], echantillon = false): Decimal {
  const mx = moyenne(xs);
  const my = moyenne(ys);
  const n = echantillon ? xs.length - 1 : xs.length;
  return somme(xs.map((x, i) => d(x).minus(mx).times(d(ys[i]).minus(my)))).div(n);
}

/** Centile par interpolation linéaire (méthode « R-7 », celle des tableurs). */
export function centile(vs: Decimal[], p: Valeur): Decimal {
  const tri = [...vs].sort((a, b) => a.comparedTo(b));
  const h = d(tri.length - 1).times(d(p));
  const bas = h.floor().toNumber();
  const haut = Math.min(bas + 1, tri.length - 1);
  return tri[bas].plus(h.minus(bas).times(tri[haut].minus(tri[bas])));
}

/** Fonction de répartition de la loi normale centrée réduite (série de Taylor de erf, puis développement asymptotique). */
export function normCdf(x: Valeur): Decimal {
  const z = d(x);
  if (z.abs().greaterThan(8)) return z.isNegative() ? ZERO : UN;
  const t = z.div(d(2).sqrt());
  // erf(t) = 2/√π Σ (−1)^n t^(2n+1) / (n! (2n+1))
  let terme = t;
  let s = t;
  for (let n = 1; n < 200; n++) {
    terme = terme.times(t.pow(2)).neg().div(n);
    const ajout = terme.div(2 * n + 1);
    s = s.plus(ajout);
    if (ajout.abs().lessThan('1e-26')) break;
  }
  const erf = s.times(2).div(Decimal.acos(-1).sqrt());
  return UN.plus(erf).div(2);
}

/** Résout A·x = b par élimination de Gauss avec pivot partiel. */
export function resoudreSysteme(A: Decimal[][], b: Decimal[]): Decimal[] {
  const n = b.length;
  const m = A.map((ligne, i) => [...ligne, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (m[r][col].abs().greaterThan(m[pivot][col].abs())) pivot = r;
    if (m[pivot][col].isZero()) throw new ErreurCalcul('Système singulier : prestations réciproques indéterminées.');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col].div(m[col][col]);
      for (let c = col; c <= n; c++) m[r][c] = m[r][c].minus(f.times(m[col][c]));
    }
  }
  return m.map((ligne, i) => ligne[n].div(ligne[i]));
}

/** Générateur Mulberry32 : séquence reproductible pour une graine donnée. */
export function generateur(graine: number): () => Decimal {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const entier = (t ^ (t >>> 14)) >>> 0;
    // (entier + 0,5) / 2^32 ∈ ]0 ; 1[ — exact en décimal
    return d(entier).plus('0.5').div('4294967296');
  };
}

const ACKLAM = {
  a: ['-39.69683028665376', '220.9460984245205', '-275.9285104469687', '138.3577518672690', '-30.66479806614716', '2.506628277459239'],
  b: ['-54.47609879822406', '161.5858368580409', '-155.6989798598866', '66.80131188771972', '-13.28068155288572'],
  c: ['-0.007784894002430293', '-0.3223964580411365', '-2.400758277161838', '-2.549732539343734', '4.374664141464968', '2.938163982698783'],
  d: ['0.007784695709041462', '0.3224671290700398', '2.445134137142996', '3.754408661907416'],
};
const D_ = (xs: string[]) => xs.map((x) => new Decimal(x));
const AK = { a: D_(ACKLAM.a), b: D_(ACKLAM.b), c: D_(ACKLAM.c), d: D_(ACKLAM.d) };
// L'accumulateur part de x × 0 : le calcul reste dans le contexte (précision) de x.
const horner = (cs: Decimal[], x: Decimal) => cs.reduce((acc, k) => acc.times(x).plus(k), x.times(0));

/** Contexte décimal à 16 chiffres réservé aux tirages statistiques (Monte-Carlo) : déterministe, plus rapide. */
export const DecimalSimulation = Decimal.clone({ precision: 16 });

/**
 * Quantile de la loi normale centrée réduite (algorithme d'Acklam, erreur relative < 1,2e-9).
 * Arithmétique décimale pure dans la zone centrale ; racine et logarithme dans les queues.
 */
export function quantileNormal(p: Decimal): Decimal {
  const bas = new Decimal('0.02425');
  if (p.lessThan(bas)) {
    const q = p.ln().times(-2).sqrt();
    return horner(AK.c, q).div(horner([...AK.d, UN], q));
  }
  if (p.greaterThan(UN.minus(bas))) {
    const q = p.neg().plus(1).ln().times(-2).sqrt();
    return horner(AK.c, q).div(horner([...AK.d, UN], q)).neg();
  }
  const q = p.minus('0.5');
  const r = q.times(q);
  return horner(AK.a, r).times(q).div(horner([...AK.b, UN], r));
}

/** Tirage normal N(0,1) exact par inversion (Acklam). */
export function tirageNormal(u: () => Decimal): Decimal {
  return quantileNormal(new DecimalSimulation(u()));
}

/** Générateur Mulberry32 renvoyant l'entier 32 bits brut (arithmétique entière exacte). */
export function generateurEntier(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const BINS = 1024;
const DEUX32 = new DecimalSimulation(4294967296);
/** Quantiles aux bornes p = i / 1024, calculés une fois au chargement (Acklam). */
const TABLE_QUANTILES: Decimal[] = Array.from({ length: BINS + 1 }, (_, i) =>
  i === 0 || i === BINS ? ZERO : quantileNormal(new DecimalSimulation(i).div(BINS)),
);
const LARGEUR_BIN = 4194304; // 2^32 / 1024

/** Échelle du virgule fixe entier (BigInt) des simulations : 10^15. */
export const ECHELLE_FIXE = 10n ** 15n;
const enFixe = (x: Decimal): bigint => BigInt(x.times('1e15').toDecimalPlaces(0).toFixed());
const TABLE_FIXE: bigint[] = TABLE_QUANTILES.map(enFixe);

/**
 * Tirage normal N(0,1) en virgule fixe entière (×10^15) : même table et même règle que
 * tirageNormalRapide, mais en arithmétique BigInt exacte (≈ 100 fois plus rapide que Decimal).
 */
export function tirageNormalFixe(rng: () => number): bigint {
  const x = rng();
  const i = Math.floor(x / LARGEUR_BIN);
  if (i === 0 || i === BINS - 1) return enFixe(quantileNormal(new DecimalSimulation(x).plus('0.5').div(DEUX32)));
  const r = BigInt(x - i * LARGEUR_BIN);
  return TABLE_FIXE[i] + ((TABLE_FIXE[i + 1] - TABLE_FIXE[i]) * r) / BigInt(LARGEUR_BIN);
}

/**
 * Tirage normal N(0,1) rapide et déterministe : interpolation linéaire dans une table
 * de 1 024 quantiles ; inversion exacte dans les deux classes extrêmes (p < 1/1024 ou p > 1023/1024).
 */
export function tirageNormalRapide(rng: () => number): Decimal {
  const x = rng();
  const i = Math.floor(x / LARGEUR_BIN);
  if (i === 0 || i === BINS - 1) return quantileNormal(new DecimalSimulation(x).plus('0.5').div(DEUX32));
  const frac = new DecimalSimulation(x - i * LARGEUR_BIN).div(LARGEUR_BIN);
  return TABLE_QUANTILES[i].plus(TABLE_QUANTILES[i + 1].minus(TABLE_QUANTILES[i]).times(frac));
}
