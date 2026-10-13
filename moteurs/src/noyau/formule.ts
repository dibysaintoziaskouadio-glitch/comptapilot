/**
 * Définition, validation des entrées et exécution d'une formule.
 * Chaque formule est une fonction pure : mêmes entrées → mêmes sorties.
 */
import { d, Decimal, normaliserNombre } from './decimal';
import { estDateIso } from './dates';
import { Contexte } from './contexte';
import { ErreurCalcul, ErreurEntree } from './erreurs';
import {
  Champ,
  CodeMoteur,
  DescriptionFormule,
  ErreurChamp,
  ExempleFormule,
  Reference,
  ResultatCalcul,
} from './types';

export interface Formule<E = Record<string, any>> {
  id: string;
  moteur: CodeMoteur;
  nom: string;
  description: string;
  categorie: string;
  /** Formule principale lisible (affichée en tête). */
  expression: string;
  version?: string;
  references: Reference[];
  champs: Champ[];
  exemples: ExempleFormule[];
  motsCles?: string[];
  /** Codes des barèmes consultés (documentation). */
  baremes?: string[];
  calculer: (e: E, c: Contexte) => void;
}

export function formule<E = Record<string, any>>(f: Formule<E>): Formule<E> {
  return f;
}

const RE_NOMBRE = /^-?\d+(\.\d+)?$/;

function estVide(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

function parserNombre(v: unknown): Decimal | null {
  if (typeof v === 'number') return Number.isFinite(v) ? d(String(v)) : null;
  if (typeof v !== 'string') return null;
  const s = normaliserNombre(v);
  return RE_NOMBRE.test(s) ? d(s) : null;
}

function estVisible(champ: Champ, brut: Record<string, unknown>, champs: Champ[]): boolean {
  if (!champ.visibleSi) return true;
  const source = champs.find((c) => c.nom === champ.visibleSi!.champ);
  const valeur = brut[champ.visibleSi.champ] ?? source?.defaut;
  return champ.visibleSi.valeurs.some((v) => String(v) === String(valeur));
}

function parserChamp(champ: Champ, valeur: unknown, chemin: string, erreurs: ErreurChamp[]): unknown {
  const err = (message: string) => {
    erreurs.push({ champ: chemin, message });
    return undefined;
  };
  switch (champ.type) {
    case 'montant':
    case 'nombre':
    case 'taux': {
      const x = parserNombre(valeur);
      if (!x) return err('nombre attendu');
      if (champ.min !== undefined && x.lessThan(champ.min)) return err(`doit être ≥ ${champ.min}`);
      if (champ.max !== undefined && x.greaterThan(champ.max)) return err(`doit être ≤ ${champ.max}`);
      return champ.type === 'taux' ? x.div(100) : x;
    }
    case 'entier': {
      const x = parserNombre(valeur);
      if (!x || !x.isInteger()) return err('nombre entier attendu');
      if (champ.min !== undefined && x.lessThan(champ.min)) return err(`doit être ≥ ${champ.min}`);
      if (champ.max !== undefined && x.greaterThan(champ.max)) return err(`doit être ≤ ${champ.max}`);
      return x.toNumber();
    }
    case 'date':
      return estDateIso(valeur) ? valeur : err('date AAAA-MM-JJ attendue');
    case 'choix': {
      const s = String(valeur);
      return champ.options?.some((o) => o.valeur === s) ? s : err(`valeur non autorisée (${s})`);
    }
    case 'booleen':
      if (typeof valeur === 'boolean') return valeur;
      if (valeur === 'true' || valeur === 'oui') return true;
      if (valeur === 'false' || valeur === 'non') return false;
      return err('vrai/faux attendu');
    case 'texte':
      if (typeof valeur !== 'string') return err('texte attendu');
      if (valeur.length > 5_000_000) return err('texte trop long');
      return valeur;
    case 'liste': {
      const items = Array.isArray(valeur)
        ? valeur
        : String(valeur)
            .split(/[;\n]/)
            .map((s) => s.trim())
            .filter((s) => s !== '');
      const out: Decimal[] = [];
      items.forEach((it, i) => {
        const x = parserNombre(it);
        if (!x) erreurs.push({ champ: `${chemin}[${i + 1}]`, message: 'nombre attendu' });
        else out.push(x);
      });
      if (champ.min !== undefined && out.length < Number(champ.min))
        return err(`au moins ${champ.min} valeur(s) attendue(s)`);
      return out;
    }
    case 'table': {
      if (!Array.isArray(valeur)) return err('liste de lignes attendue');
      if (valeur.length > 10_000) return err('10 000 lignes maximum');
      const lignes: Record<string, unknown>[] = [];
      valeur.forEach((ligne, i) => {
        if (typeof ligne !== 'object' || ligne === null) {
          erreurs.push({ champ: `${chemin}[${i + 1}]`, message: 'ligne invalide' });
          return;
        }
        const brut = ligne as Record<string, unknown>;
        const cols = champ.colonnes ?? [];
        if (cols.every((c) => estVide(brut[c.nom]))) return; // ligne vide ignorée
        lignes.push(parserObjet(cols, brut, `${chemin}[${i + 1}]`, erreurs));
      });
      if (champ.min !== undefined && lignes.length < Number(champ.min))
        return err(`au moins ${champ.min} ligne(s) attendue(s)`);
      return lignes;
    }
  }
}

function parserObjet(champs: Champ[], brut: Record<string, unknown>, prefixe: string, erreurs: ErreurChamp[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const champ of champs) {
    const chemin = prefixe ? `${prefixe}.${champ.nom}` : champ.nom;
    if (!estVisible(champ, brut, champs)) continue;
    let valeur = brut[champ.nom];
    if (estVide(valeur)) valeur = champ.defaut;
    if (estVide(valeur)) {
      if (!champ.optionnel) erreurs.push({ champ: chemin, message: 'obligatoire' });
      continue;
    }
    const v = parserChamp(champ, valeur, chemin, erreurs);
    if (v !== undefined) out[champ.nom] = v;
  }
  return out;
}

/** Valide et convertit les entrées brutes (JSON) selon la déclaration des champs. */
export function parserEntrees(champs: Champ[], brut: Record<string, unknown>): Record<string, unknown> {
  const erreurs: ErreurChamp[] = [];
  const out = parserObjet(champs, brut ?? {}, '', erreurs);
  if (erreurs.length) throw new ErreurEntree(erreurs);
  return out;
}

/** Entrées normalisées (sérialisables) : valeurs par défaut appliquées, taux en pourcentage. */
function normaliser(champs: Champ[], parsees: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const champ of champs) {
    const v = parsees[champ.nom];
    if (v === undefined) continue;
    out[champ.nom] = normaliserValeur(champ, v);
  }
  return out;
}

function normaliserValeur(champ: Champ, v: unknown): unknown {
  if (v instanceof Decimal || Decimal.isDecimal(v)) {
    const x = v as Decimal;
    return champ.type === 'taux' ? x.times(100).toFixed() : x.toFixed();
  }
  if (Array.isArray(v)) {
    if (champ.type === 'liste') return (v as Decimal[]).map((x) => x.toFixed());
    return (v as Record<string, unknown>[]).map((l) => normaliser(champ.colonnes ?? [], l));
  }
  return v;
}

function maintenant(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

export function executerFormule(f: Formule<any>, brut: Record<string, unknown>): ResultatCalcul {
  const t0 = maintenant();
  const entrees = parserEntrees(f.champs, brut);
  const c = new Contexte();
  try {
    f.calculer(entrees, c);
  } catch (e) {
    if (e instanceof ErreurCalcul || e instanceof ErreurEntree) throw e;
    if (e instanceof Error && /DecimalError/.test(e.message)) throw new ErreurCalcul(`Calcul impossible : ${e.message}`);
    throw e;
  }
  if (!c.controles.some((x) => x.niveau === 'erreur' || x.niveau === 'avertissement')) {
    c.ctrl('ok', 'COHERENCE', 'Tous les contrôles de cohérence sont satisfaits.');
  }
  return {
    formule: { id: f.id, moteur: f.moteur, nom: f.nom, version: f.version ?? '1.0.0', expression: f.expression },
    entrees: normaliser(f.champs, entrees),
    resultats: c.resultats,
    etapes: c.etapes,
    controles: c.controles,
    tableaux: c.tableaux,
    ecritures: c.ecritures,
    references: f.references,
    baremes: c.baremes,
    dureeMs: Math.round((maintenant() - t0) * 1000) / 1000,
  };
}

export function decrireFormule(f: Formule<any>): DescriptionFormule {
  return {
    id: f.id,
    moteur: f.moteur,
    nom: f.nom,
    description: f.description,
    categorie: f.categorie,
    expression: f.expression,
    version: f.version ?? '1.0.0',
    references: f.references,
    champs: f.champs,
    exemples: f.exemples,
    motsCles: f.motsCles ?? [],
    baremes: f.baremes ?? [],
  };
}
