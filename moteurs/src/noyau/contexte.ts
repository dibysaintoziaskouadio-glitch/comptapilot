/**
 * Contexte d'exécution d'une formule : collecte la trace (étapes), les résultats,
 * les contrôles automatiques, les tableaux, les écritures comptables et les
 * barèmes utilisés.
 */
import { d, Decimal, euros, somme, Valeur } from './decimal';
import { fe, fp, frn } from './format';
import { resoudreBareme } from './baremes';
import { ErreurCalcul } from './erreurs';
import {
  BaremeUtilise,
  Controle,
  Ecriture,
  Etape,
  LigneEcriture,
  NiveauControle,
  Tableau,
  Unite,
  ValeurResultat,
} from './types';

export interface OptionsResultat {
  principal?: boolean;
  decimales?: number;
  aide?: string;
  groupe?: string;
}

/** Valeur brute → chaîne stockée, selon l'unité. Les pourcentages sont fournis en fraction. */
/** Refuse une valeur infinie ou indéterminée (dépassement de 10^100, division par zéro). */
function fini(x: Decimal, libelle?: string): Decimal {
  if (!x.isFinite()) throw new ErreurCalcul(`Résultat hors limites${libelle ? ` (${libelle})` : ''} : vérifiez les montants, taux et durées saisis.`);
  return x;
}

export function serialiser(v: Valeur | string | boolean, unite: Unite, decimales?: number): string {
  if (unite === 'texte' || unite === 'date') return String(v);
  if (unite === 'booleen') return v ? 'oui' : 'non';
  const x = fini(d(v as Valeur));
  switch (unite) {
    case 'EUR':
    case 'devise':
      return x.toFixed(decimales ?? 2);
    case '%':
      return x.times(100).toFixed(decimales ?? 2);
    case 'entier':
      return x.toFixed(0);
    default:
      return decimales === undefined ? x.toDecimalPlaces(6).toFixed() : x.toFixed(decimales);
  }
}

/** Formate une valeur pour l'affichage dans une étape de trace. */
export function afficher(v: Valeur | string, unite?: Unite): string {
  if (typeof v === 'string' && (unite === 'texte' || unite === 'date')) return v;
  switch (unite) {
    case 'EUR':
      return fe(v as Valeur);
    case '%':
      return fp(v as Valeur);
    case 'jours':
      return frn(v as Valeur, 4) + ' j';
    case 'mois':
      return frn(v as Valeur, 4) + ' mois';
    case 'annees':
      return frn(v as Valeur, 4) + ' an(s)';
    case 'heures':
      return frn(v as Valeur, 4) + ' h';
    default:
      return frn(v as Valeur, 6);
  }
}

export class Contexte {
  readonly etapes: Etape[] = [];
  readonly resultats: Record<string, ValeurResultat> = {};
  readonly controles: Controle[] = [];
  readonly tableaux: Tableau[] = [];
  readonly ecritures: Ecriture[] = [];
  readonly baremes: BaremeUtilise[] = [];

  /** Enregistre une étape de calcul et renvoie la valeur (pour chaîner). */
  etape<T extends Decimal | string>(libelle: string, formule: string, valeur: T, unite?: Unite): T {
    if (typeof valeur !== 'string') fini(valeur, libelle);
    this.etapes.push({
      libelle,
      formule,
      valeur: typeof valeur === 'string' ? valeur : afficher(valeur, unite),
      unite,
    });
    return valeur;
  }

  /** Déclare un résultat publié. Pour l'unité « % », fournir la fraction (0,2 pour 20 %). */
  res(cle: string, libelle: string, valeur: Valeur | boolean, unite: Unite = 'EUR', opts: OptionsResultat = {}): void {
    this.resultats[cle] = {
      libelle,
      valeur: serialiser(valeur as Valeur, unite, opts.decimales),
      unite,
      ...(opts.principal ? { principal: true } : {}),
      ...(opts.aide ? { aide: opts.aide } : {}),
      ...(opts.groupe ? { groupe: opts.groupe } : {}),
    };
  }

  /** Résultat + étape en un appel (cas le plus courant). */
  calc(cle: string, libelle: string, formule: string, valeur: Decimal, unite: Unite = 'EUR', opts: OptionsResultat = {}): Decimal {
    this.etape(libelle, formule, valeur, unite);
    this.res(cle, libelle, valeur, unite, opts);
    return valeur;
  }

  ctrl(niveau: NiveauControle, code: string, message: string): void {
    this.controles.push({ niveau, code, message });
  }

  /** Contrôle booléen : « ok » si la condition est vraie, sinon niveau indiqué. */
  verifier(condition: boolean, code: string, siOk: string, siKo: string, niveau: NiveauControle = 'erreur'): boolean {
    this.ctrl(condition ? 'ok' : niveau, code, condition ? siOk : siKo);
    return condition;
  }

  tableau(t: Tableau): void {
    this.tableaux.push(t);
  }

  /**
   * Écriture comptable proposée. Les montants nuls sont omis ; l'équilibre
   * débit/crédit est contrôlé automatiquement à 0,01 € près.
   */
  ecriture(libelle: string, lignes: { compte: string; intitule: string; debit?: Valeur; credit?: Valeur }[], journal = 'OD'): void {
    const out: LigneEcriture[] = [];
    for (const l of lignes) {
      // Solde net de la ligne : un montant négatif passe dans la colonne opposée.
      const net = euros(l.debit ?? 0).minus(euros(l.credit ?? 0));
      if (net.isZero()) continue;
      out.push({
        compte: l.compte,
        intitule: l.intitule,
        ...(net.greaterThan(0) ? { debit: net.toFixed(2) } : { credit: net.neg().toFixed(2) }),
      });
    }
    if (out.length === 0) return;
    this.ecritures.push({ libelle, journal, lignes: out });
    const td = somme(out.map((l) => l.debit ?? 0));
    const tc = somme(out.map((l) => l.credit ?? 0));
    const ecart = td.minus(tc).abs();
    if (ecart.greaterThan('0.01')) {
      this.ctrl('erreur', 'ECRITURE_DESEQUILIBREE', `Écriture « ${libelle} » déséquilibrée : débit ${fe(td)} / crédit ${fe(tc)}.`);
    }
  }

  /** Résout un barème à la date d'opération et l'inscrit dans la trace. */
  bareme<T>(code: string, date: string): T {
    const r = resoudreBareme<T>(code, date);
    if (!this.baremes.some((b) => b.code === code && b.du === r.version.du)) {
      this.baremes.push({
        code,
        libelle: r.bareme.libelle,
        du: r.version.du,
        ...(r.version.au ? { au: r.version.au } : {}),
        source: r.version.source,
        statut: r.version.statut,
      });
      for (const c of r.controles) if (!this.controles.some((x) => x.message === c.message)) this.controles.push(c);
    }
    return r.version.valeurs;
  }
}
