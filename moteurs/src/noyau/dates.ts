/**
 * Calculs de dates déterministes sur des dates ISO « AAAA-MM-JJ ».
 * Tous les calculs passent par un numéro de jour UTC : aucun effet de fuseau horaire.
 */

const MS_JOUR = 86_400_000;
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  a: number;
  m: number;
  j: number;
}

export function estDateIso(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const r = RE_ISO.exec(s);
  if (!r) return false;
  const a = +r[1];
  const m = +r[2];
  const j = +r[3];
  return m >= 1 && m <= 12 && j >= 1 && j <= joursDansMois(a, m);
}

export function parts(iso: string): DateParts {
  const r = RE_ISO.exec(iso);
  if (!r) throw new Error(`Date invalide : ${iso}`);
  return { a: +r[1], m: +r[2], j: +r[3] };
}

export function iso(a: number, m: number, j: number): string {
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

export function numJour(s: string): number {
  const { a, m, j } = parts(s);
  return Date.UTC(a, m - 1, j) / MS_JOUR;
}

export function depuisNum(n: number): string {
  const dt = new Date(n * MS_JOUR);
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function estBissextile(a: number): boolean {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
}

export function joursDansMois(a: number, m: number): number {
  return [31, estBissextile(a) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function joursDansAnnee(a: number): number {
  return estBissextile(a) ? 366 : 365;
}

export function ajouterJours(s: string, n: number): string {
  return depuisNum(numJour(s) + n);
}

/** Ajoute n mois ; le jour est ramené au dernier jour du mois si nécessaire (31/01 + 1 mois = 28/02 ou 29/02). */
export function ajouterMois(s: string, n: number): string {
  const { a, m, j } = parts(s);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return iso(na, nm, Math.min(j, joursDansMois(na, nm)));
}

export function finDeMois(s: string): string {
  const { a, m } = parts(s);
  return iso(a, m, joursDansMois(a, m));
}

/** Nombre de jours de a à b (b − a), b exclu. */
export function joursEntre(a: string, b: string): number {
  return numJour(b) - numJour(a);
}

/** 0 = dimanche … 6 = samedi */
export function jourSemaine(s: string): number {
  return ((numJour(s) % 7) + 7 + 4) % 7; // 01/01/1970 était un jeudi
}

export function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher, calendrier grégorien). */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

/** Jours fériés légaux (Code du travail art. L.3133-1), option Alsace-Moselle (L.3134-13). */
export function joursFeries(annee: number, alsaceMoselle = false): Map<string, string> {
  const p = paques(annee);
  const f = new Map<string, string>([
    [iso(annee, 1, 1), "Jour de l'an"],
    [ajouterJours(p, 1), 'Lundi de Pâques'],
    [iso(annee, 5, 1), 'Fête du travail'],
    [iso(annee, 5, 8), 'Victoire 1945'],
    [ajouterJours(p, 39), 'Ascension'],
    [ajouterJours(p, 50), 'Lundi de Pentecôte'],
    [iso(annee, 7, 14), 'Fête nationale'],
    [iso(annee, 8, 15), 'Assomption'],
    [iso(annee, 11, 1), 'Toussaint'],
    [iso(annee, 11, 11), 'Armistice 1918'],
    [iso(annee, 12, 25), 'Noël'],
  ]);
  if (alsaceMoselle) {
    f.set(ajouterJours(p, -2), 'Vendredi saint');
    f.set(iso(annee, 12, 26), 'Saint-Étienne');
  }
  return f;
}

export function estFerie(s: string, alsaceMoselle = false): boolean {
  return joursFeries(parts(s).a, alsaceMoselle).has(s);
}

/** Compte les jours de [debut, fin] (bornes incluses) répondant au prédicat. */
export function compterJours(debut: string, fin: string, pred: (s: string) => boolean): number {
  let n = 0;
  for (let x = numJour(debut); x <= numJour(fin); x++) if (pred(depuisNum(x))) n++;
  return n;
}

/** Jours ouvrés : du lundi au vendredi, hors jours fériés. */
export function estOuvre(s: string, alsaceMoselle = false): boolean {
  const js = jourSemaine(s);
  return js >= 1 && js <= 5 && !estFerie(s, alsaceMoselle);
}

/** Jours ouvrables : du lundi au samedi, hors jours fériés. */
export function estOuvrable(s: string, alsaceMoselle = false): boolean {
  return jourSemaine(s) !== 0 && !estFerie(s, alsaceMoselle);
}

/**
 * Convention 30/360 européenne (30E/360) : chaque mois compte 30 jours.
 * Renvoie le nombre de jours de a à b (b exclu, comme une durée).
 */
export function jours30E360(a: string, b: string): number {
  const p1 = parts(a);
  const p2 = parts(b);
  const j1 = Math.min(p1.j, 30);
  const j2 = Math.min(p2.j, 30);
  return 360 * (p2.a - p1.a) + 30 * (p2.m - p1.m) + (j2 - j1);
}

/**
 * Prorata fiscal « jours/360 » : nombre de jours du premier au dernier jour inclus,
 * chaque mois comptant pour 30 jours (usage fiscal pour l'amortissement linéaire).
 */
export function joursFiscaux360(debutInclus: string, finInclus: string): number {
  return jours30E360(debutInclus, finInclus) + 1;
}

/** Nombre de mois entiers ou entamés du mois de `debut` au mois de `fin` inclus. */
export function moisInclus(debut: string, fin: string): number {
  const p1 = parts(debut);
  const p2 = parts(fin);
  return (p2.a - p1.a) * 12 + (p2.m - p1.m) + 1;
}

/**
 * Ancienneté en années, mois et jours : plus grand nombre de mois entiers m tel que
 * debut + m mois ≤ fin (avec report au dernier jour du mois), puis jours restants.
 */
export function anciennete(debut: string, fin: string): { annees: number; mois: number; jours: number } {
  const p1 = parts(debut);
  const p2 = parts(fin);
  let m = (p2.a - p1.a) * 12 + (p2.m - p1.m);
  while (m > 0 && comparer(ajouterMois(debut, m), fin) > 0) m--;
  const jours = joursEntre(ajouterMois(debut, m), fin);
  return { annees: Math.floor(m / 12), mois: m % 12, jours };
}
