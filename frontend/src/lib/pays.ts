/** Pays proposés pour l'indicatif téléphonique (la validation fine du numéro est faite par l'API). */
import type { Langue } from './i18n/dictionnaires';

export interface Pays {
  code: string; // ISO 3166-1 alpha-2
  indicatif: string;
  nom: Record<Langue, string>;
}

export const PAYS: Pays[] = [
  { code: 'CI', indicatif: '+225', nom: { fr: 'Côte d’Ivoire', en: 'Côte d’Ivoire' } },
  { code: 'SN', indicatif: '+221', nom: { fr: 'Sénégal', en: 'Senegal' } },
  { code: 'ML', indicatif: '+223', nom: { fr: 'Mali', en: 'Mali' } },
  { code: 'BF', indicatif: '+226', nom: { fr: 'Burkina Faso', en: 'Burkina Faso' } },
  { code: 'BJ', indicatif: '+229', nom: { fr: 'Bénin', en: 'Benin' } },
  { code: 'TG', indicatif: '+228', nom: { fr: 'Togo', en: 'Togo' } },
  { code: 'NE', indicatif: '+227', nom: { fr: 'Niger', en: 'Niger' } },
  { code: 'GW', indicatif: '+245', nom: { fr: 'Guinée-Bissau', en: 'Guinea-Bissau' } },
  { code: 'GN', indicatif: '+224', nom: { fr: 'Guinée', en: 'Guinea' } },
  { code: 'CM', indicatif: '+237', nom: { fr: 'Cameroun', en: 'Cameroon' } },
  { code: 'GA', indicatif: '+241', nom: { fr: 'Gabon', en: 'Gabon' } },
  { code: 'CG', indicatif: '+242', nom: { fr: 'Congo', en: 'Congo' } },
  { code: 'CD', indicatif: '+243', nom: { fr: 'RD Congo', en: 'DR Congo' } },
  { code: 'TD', indicatif: '+235', nom: { fr: 'Tchad', en: 'Chad' } },
  { code: 'CF', indicatif: '+236', nom: { fr: 'Centrafrique', en: 'Central African Rep.' } },
  { code: 'GQ', indicatif: '+240', nom: { fr: 'Guinée équatoriale', en: 'Equatorial Guinea' } },
  { code: 'MA', indicatif: '+212', nom: { fr: 'Maroc', en: 'Morocco' } },
  { code: 'DZ', indicatif: '+213', nom: { fr: 'Algérie', en: 'Algeria' } },
  { code: 'TN', indicatif: '+216', nom: { fr: 'Tunisie', en: 'Tunisia' } },
  { code: 'NG', indicatif: '+234', nom: { fr: 'Nigeria', en: 'Nigeria' } },
  { code: 'GH', indicatif: '+233', nom: { fr: 'Ghana', en: 'Ghana' } },
  { code: 'KE', indicatif: '+254', nom: { fr: 'Kenya', en: 'Kenya' } },
  { code: 'ZA', indicatif: '+27', nom: { fr: 'Afrique du Sud', en: 'South Africa' } },
  { code: 'FR', indicatif: '+33', nom: { fr: 'France', en: 'France' } },
  { code: 'BE', indicatif: '+32', nom: { fr: 'Belgique', en: 'Belgium' } },
  { code: 'CH', indicatif: '+41', nom: { fr: 'Suisse', en: 'Switzerland' } },
  { code: 'LU', indicatif: '+352', nom: { fr: 'Luxembourg', en: 'Luxembourg' } },
  { code: 'GB', indicatif: '+44', nom: { fr: 'Royaume-Uni', en: 'United Kingdom' } },
  { code: 'CA', indicatif: '+1', nom: { fr: 'Canada', en: 'Canada' } },
  { code: 'US', indicatif: '+1', nom: { fr: 'États-Unis', en: 'United States' } },
  { code: 'CN', indicatif: '+86', nom: { fr: 'Chine', en: 'China' } },
  { code: 'JP', indicatif: '+81', nom: { fr: 'Japon', en: 'Japan' } },
];

const PAR_DEVISE: Record<string, string> = { XOF: 'CI', XAF: 'CM', EUR: 'FR', USD: 'US', GBP: 'GB', CHF: 'CH', CAD: 'CA', MAD: 'MA', DZD: 'DZ', TND: 'TN', NGN: 'NG', GHS: 'GH', GNF: 'GN', CDF: 'CD', KES: 'KE', ZAR: 'ZA', CNY: 'CN', JPY: 'JP' };

/** Pays par défaut : région du navigateur (fr-CI → CI), sinon pays de la monnaie choisie, sinon Côte d'Ivoire. */
export function paysParDefaut(devise: string): string {
  const region = (navigator.language ?? '').split('-')[1]?.toUpperCase();
  if (region && PAYS.some((p) => p.code === region)) return region;
  return PAR_DEVISE[devise] ?? 'CI';
}

/** Drapeau en émoji à partir du code pays (indicateurs régionaux Unicode). */
export const drapeau = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
