/**
 * Mise en forme des valeurs selon la langue et la monnaie de l'utilisateur.
 * Les valeurs arrivent du moteur en chaînes décimales exactes ; elles ne passent jamais par un nombre flottant,
 * y compris pour l'arrondi d'affichage (fait sur la chaîne).
 * La configuration est fixée par PreferencesProvider (configurerFormat) avant le rendu des pages.
 */
import type { Unite } from './types';
import type { Langue } from './i18n/dictionnaires';
import { formatDevise } from './devises';

let langue: Langue = 'fr';
let devise = 'EUR';

export function configurerFormat(l: Langue, d: string): void {
  langue = l;
  devise = d;
}
export const deviseCourante = () => devise;
export const locale = () => (langue === 'fr' ? 'fr-FR' : 'en-GB');

// Espace insécable normale en français : l'espace fine est quasi invisible en Figtree et Sora.
const separateurs = () => (langue === 'fr' ? { groupe: ' ', decimale: ',' } : { groupe: ',', decimale: '.' });

/** Ajoute 1 à un entier écrit en chiffres décimaux (« 1299 » → « 1300 »). */
function incrementer(chiffres: string): string {
  const a = chiffres.split('');
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i] !== '9') {
      a[i] = String(Number(a[i]) + 1);
      return a.join('');
    }
    a[i] = '0';
  }
  return '1' + a.join('');
}

/**
 * Arrondi commercial (demi vers le haut, en valeur absolue) d'une chaîne décimale à `n` décimales.
 * Calcul sur les chiffres, sans BigInt ni flottant : compatible avec les navigateurs anciens (iOS 13, vieux Android).
 */
export function arrondir(v: string, n: number): string {
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(v.trim());
  if (!m) return v;
  const [, signe, ent = '0', dec = ''] = m;
  const chiffres = `${ent || '0'}${dec.padEnd(n + 1, '0').slice(0, n + 1)}`;
  let corps = chiffres.slice(0, -1);
  if (Number(chiffres.slice(-1)) >= 5) corps = incrementer(corps);
  corps = corps.replace(/^0+(?=\d)/, '');
  const s = corps.padStart(n + 1, '0');
  const r = n ? `${s.slice(0, -n)}.${s.slice(-n)}` : s;
  return /^0*$/.test(corps) ? r : signe + r;
}

/** Nombre décimal transmis en chaîne → affichage localisé, entre `decimalesMin` et `decimalesMax` décimales. */
export function nombre(v: string, decimalesMin = 0, decimalesMax = 6): string {
  if (v === '' || v === undefined || v === null) return '';
  if (!/^-?\d*(\.\d*)?$/.test(v)) return v;
  const { groupe, decimale } = separateurs();
  const a = arrondir(v, decimalesMax);
  const [ent, dec = ''] = a.replace('-', '').split('.');
  const signe = a.startsWith('-') ? '−' : '';
  const d = dec.replace(/0+$/, '').padEnd(decimalesMin, '0');
  return signe + ent.replace(/\B(?=(\d{3})+(?!\d))/g, groupe) + (d ? decimale + d : '');
}

/** Montant dans la monnaie courante (ou celle indiquée), arrondi au nombre de décimales de la monnaie. */
export function montant(v: string, code = devise): string {
  const f = formatDevise(code, langue);
  const n = nombre(v, f.decimales, f.decimales);
  if (!f.avant) return `${n} ${f.symbole}`;
  const signe = n.startsWith('−') ? '−' : '';
  const abs = signe ? n.slice(1) : n;
  // « $1,234.50 » mais « CHF 1,234.50 » : espace seulement après un symbole alphabétique.
  return `${signe}${f.symbole}${/[A-Za-z]$/.test(f.symbole) ? ' ' : ''}${abs}`;
}

/** Symbole de la monnaie courante (suffixe des champs de saisie de montants). */
export const symboleDevise = (code = devise) => formatDevise(code, langue).symbole;

/**
 * Textes produits par le moteur (étapes, contrôles) : ils sont rédigés en euros ;
 * le symbole est remplacé par celui de la monnaie choisie, sans conversion des nombres.
 */
export function texteMoteur(s: string, code = devise): string {
  return code === 'EUR' ? s : s.replace(/€/g, symboleDevise(code));
}

const UNITES: Record<Langue, Record<string, (n: string, v: string) => string>> = {
  fr: {
    jours: (n) => `${n} j`,
    mois: (n) => `${n} mois`,
    annees: (n, v) => `${n} an${Number(v) >= 2 ? 's' : ''}`,
    heures: (n) => `${n} h`,
    fois: (n) => `${n} ×`,
  },
  en: {
    jours: (n, v) => `${n} day${Number(v) === 1 ? '' : 's'}`,
    mois: (n, v) => `${n} month${Number(v) === 1 ? '' : 's'}`,
    annees: (n, v) => `${n} year${Number(v) === 1 ? '' : 's'}`,
    heures: (n) => `${n} h`,
    fois: (n) => `${n} ×`,
  },
};

export function valeur(v: string, unite?: Unite | string, code = devise): string {
  switch (unite) {
    case 'EUR':
      return montant(v, code);
    case 'devise':
      return nombre(v, 2, 2);
    case '%':
      return langue === 'fr' ? `${nombre(v, 0, 4)} %` : `${nombre(v, 0, 4)}%`;
    case 'jours':
    case 'mois':
    case 'heures':
      return UNITES[langue][unite](nombre(v), v);
    case 'annees':
    case 'fois':
      return UNITES[langue][unite](nombre(v, 0, 2), v);
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v;
    case 'booleen':
      return v === 'oui' ? (langue === 'fr' ? 'Oui' : 'Yes') : langue === 'fr' ? 'Non' : 'No';
    case 'texte':
      return v;
    case 'entier':
    case 'unites':
      return nombre(v, 0, 0);
    default:
      return nombre(v);
  }
}

export const dateHeure = (iso: string) => new Date(iso).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
/** « 2026-10-13 » est lu comme un jour local (et non minuit UTC) pour ne pas glisser d'un jour. */
export const dateCourte = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)).toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
/** Durée d'exécution en millisecondes, au format de la langue. */
export const duree = (ms: number) => ms.toLocaleString(locale(), { maximumFractionDigits: 3 });
