/**
 * Monnaies d'affichage. Aucune conversion : la monnaie indique l'unité dans laquelle
 * l'utilisateur saisit et lit ses montants. Liste reprise de backend/src/config/preferences.ts.
 */
import type { Langue } from './i18n/dictionnaires';

export interface DescriptionDevise {
  code: string;
  nom: Record<Langue, string>;
  region: Record<Langue, string>;
}

export const DEVISES: DescriptionDevise[] = [
  { code: 'XOF', nom: { fr: 'Franc CFA (BCEAO)', en: 'CFA franc (BCEAO)' }, region: { fr: 'Côte d’Ivoire, Sénégal, Mali, Burkina Faso, Bénin, Togo, Niger, Guinée-Bissau', en: 'Côte d’Ivoire, Senegal, Mali, Burkina Faso, Benin, Togo, Niger, Guinea-Bissau' } },
  { code: 'XAF', nom: { fr: 'Franc CFA (BEAC)', en: 'CFA franc (BEAC)' }, region: { fr: 'Cameroun, Gabon, Congo, Tchad, Centrafrique, Guinée équatoriale', en: 'Cameroon, Gabon, Congo, Chad, Central African Rep., Equatorial Guinea' } },
  { code: 'EUR', nom: { fr: 'Euro', en: 'Euro' }, region: { fr: 'Zone euro', en: 'Euro area' } },
  { code: 'USD', nom: { fr: 'Dollar américain', en: 'US dollar' }, region: { fr: 'États-Unis', en: 'United States' } },
  { code: 'GBP', nom: { fr: 'Livre sterling', en: 'Pound sterling' }, region: { fr: 'Royaume-Uni', en: 'United Kingdom' } },
  { code: 'CHF', nom: { fr: 'Franc suisse', en: 'Swiss franc' }, region: { fr: 'Suisse', en: 'Switzerland' } },
  { code: 'CAD', nom: { fr: 'Dollar canadien', en: 'Canadian dollar' }, region: { fr: 'Canada', en: 'Canada' } },
  { code: 'MAD', nom: { fr: 'Dirham marocain', en: 'Moroccan dirham' }, region: { fr: 'Maroc', en: 'Morocco' } },
  { code: 'DZD', nom: { fr: 'Dinar algérien', en: 'Algerian dinar' }, region: { fr: 'Algérie', en: 'Algeria' } },
  { code: 'TND', nom: { fr: 'Dinar tunisien', en: 'Tunisian dinar' }, region: { fr: 'Tunisie', en: 'Tunisia' } },
  { code: 'NGN', nom: { fr: 'Naira', en: 'Naira' }, region: { fr: 'Nigeria', en: 'Nigeria' } },
  { code: 'GHS', nom: { fr: 'Cedi', en: 'Cedi' }, region: { fr: 'Ghana', en: 'Ghana' } },
  { code: 'GNF', nom: { fr: 'Franc guinéen', en: 'Guinean franc' }, region: { fr: 'Guinée', en: 'Guinea' } },
  { code: 'CDF', nom: { fr: 'Franc congolais', en: 'Congolese franc' }, region: { fr: 'RD Congo', en: 'DR Congo' } },
  { code: 'KES', nom: { fr: 'Shilling kényan', en: 'Kenyan shilling' }, region: { fr: 'Kenya', en: 'Kenya' } },
  { code: 'ZAR', nom: { fr: 'Rand', en: 'Rand' }, region: { fr: 'Afrique du Sud', en: 'South Africa' } },
  { code: 'CNY', nom: { fr: 'Yuan', en: 'Yuan' }, region: { fr: 'Chine', en: 'China' } },
  { code: 'JPY', nom: { fr: 'Yen', en: 'Yen' }, region: { fr: 'Japon', en: 'Japan' } },
];

export const CODES_DEVISES = DEVISES.map((d) => d.code);

/** Symboles ambigus remplacés (le dollar canadien et le yuan partagent « $ » et « ¥ » avec d'autres monnaies). */
const SYMBOLES: Record<string, string> = { CAD: 'CA$', CNY: 'CN¥' };

export interface FormatDevise {
  code: string;
  symbole: string;
  /** Décimales affichées : celles de la monnaie, plafonnées à 2 (précision des calculs). */
  decimales: number;
  /** Symbole placé avant le montant (usage anglais) ou après (usage français). */
  avant: boolean;
}

const cache = new Map<string, FormatDevise>();

export function formatDevise(code: string, langue: Langue): FormatDevise {
  const cle = `${code}-${langue}`;
  const connu = cache.get(cle);
  if (connu) return connu;
  const loc = langue === 'fr' ? 'fr-FR' : 'en-GB';
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(loc, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
  } catch {
    // Navigateurs antérieurs à 2020 : « narrowSymbol » inconnu.
    nf = new Intl.NumberFormat(loc, { style: 'currency', currency: code });
  }
  const parts = typeof nf.formatToParts === 'function' ? nf.formatToParts(1234.5) : [];
  const iSymbole = parts.findIndex((p) => p.type === 'currency');
  const iNombre = parts.findIndex((p) => p.type === 'integer');
  const f: FormatDevise = {
    code,
    symbole: SYMBOLES[code] ?? parts[iSymbole]?.value ?? code,
    decimales: Math.min(2, nf.resolvedOptions().maximumFractionDigits ?? 2),
    avant: iSymbole >= 0 && iSymbole < iNombre,
  };
  cache.set(cle, f);
  return f;
}
