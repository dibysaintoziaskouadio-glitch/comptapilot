/**
 * Base versionnée des taux et barèmes.
 *
 * Chaque barème possède des versions datées ; le moteur applique celle en vigueur
 * à la date de l'opération. Une version peut être marquée « a_verifier » lorsque
 * sa valeur n'a pas été confirmée par un texte officiel publié : le calcul émet
 * alors un avertissement.
 *
 * Obsolescence : un barème revalorisé chaque année (PMSS, SMIC, grilles, seuils…)
 * est signalé dès que l'opération est postérieure à l'année de sa dernière version.
 * Un barème qui ne change que par un texte nouveau (taux de TVA, taux d'IS…) porte
 * `revision: 'sur-texte'` et n'est jamais signalé pour simple ancienneté.
 */
import { CodeMoteur, Controle } from './types';
import { comparer, estDateIso, parts } from './dates';
import { ErreurCalcul } from './erreurs';

export interface VersionBareme<T = unknown> {
  du: string;
  au?: string;
  valeurs: T;
  source: string;
  statut: 'officiel' | 'a_verifier';
  note?: string;
}

export interface Bareme<T = unknown> {
  code: string;
  moteur: CodeMoteur;
  libelle: string;
  description?: string;
  /** 'annuelle' (défaut) : revalorisé chaque année ; 'sur-texte' : modifié seulement par un texte nouveau. */
  revision?: 'annuelle' | 'sur-texte';
  versions: VersionBareme<T>[];
}

/** Vrai si la dernière version d'un barème à revalorisation annuelle est antérieure à l'année de `date`. */
export function estObsolete(b: Bareme, date: string): boolean {
  if (b.revision === 'sur-texte') return false;
  const derniere = b.versions[b.versions.length - 1];
  return !!derniere && !derniere.au && parts(date).a > parts(derniere.du).a;
}

const registre = new Map<string, Bareme>();

export function bareme<T>(b: Bareme<T>): Bareme<T> {
  if (registre.has(b.code)) throw new Error(`Barème déjà déclaré : ${b.code}`);
  b.versions.sort((x, y) => comparer(x.du, y.du));
  registre.set(b.code, b as Bareme);
  return b;
}

export function obtenirBareme(code: string): Bareme {
  const b = registre.get(code);
  if (!b) throw new Error(`Barème inconnu : ${code}`);
  return b;
}

export function listerBaremes(): Bareme[] {
  return [...registre.values()];
}

/**
 * Ajoute ou remplace une version (mise à jour par loi de finances, saisie administrateur).
 * Une version de même date de début remplace la précédente.
 */
export function ajouterVersion<T>(code: string, version: VersionBareme<T>): void {
  const b = obtenirBareme(code);
  if (!estDateIso(version.du)) throw new Error(`Date de début invalide : ${version.du}`);
  const i = b.versions.findIndex((v) => v.du === version.du);
  if (i >= 0) b.versions[i] = version;
  else b.versions.push(version);
  b.versions.sort((x, y) => comparer(x.du, y.du));
}

export interface Resolution<T> {
  bareme: Bareme<T>;
  version: VersionBareme<T>;
  controles: Controle[];
}

export function resoudreBareme<T>(code: string, date: string): Resolution<T> {
  const b = obtenirBareme(code) as Bareme<T>;
  const candidates = b.versions.filter(
    (v) => comparer(v.du, date) <= 0 && (!v.au || comparer(date, v.au) <= 0),
  );
  const version = candidates[candidates.length - 1];
  if (!version) {
    throw new ErreurCalcul(
      `Aucune version du barème « ${b.libelle} » n'est applicable au ${date} (première version : ${b.versions[0]?.du}).`,
    );
  }
  const controles: Controle[] = [];
  if (version.statut === 'a_verifier') {
    controles.push({
      niveau: 'avertissement',
      code: 'BAREME_A_VERIFIER',
      message: `Barème « ${b.libelle} » (version du ${version.du}) à confirmer avec le texte officiel${version.note ? ' : ' + version.note : '.'}`,
    });
  }
  if (version === b.versions[b.versions.length - 1] && estObsolete(b as Bareme, date)) {
    controles.push({
      niveau: 'avertissement',
      code: 'BAREME_OBSOLETE',
      message: `Barème « ${b.libelle} » : dernière version connue du ${version.du}. Vérifier qu'aucune mise à jour n'est intervenue pour ${parts(date).a}.`,
    });
  }
  return { bareme: b, version, controles };
}
