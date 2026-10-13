import type { Unite } from './types';

const nf = (min: number, max: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max });
const cache = new Map<string, Intl.NumberFormat>();
const fmt = (min: number, max: number) => {
  const k = `${min}-${max}`;
  if (!cache.has(k)) cache.set(k, nf(min, max));
  return cache.get(k)!;
};

/** Nombre décimal transmis en chaîne → affichage français (sans perte : on ne passe par Number que pour l'affichage). */
export function nombre(v: string, decimalesMin = 0, decimalesMax = 6): string {
  if (v === '' || v === undefined || v === null) return '';
  const [ent, dec = ''] = v.replace('-', '').split('.');
  const signe = v.startsWith('-') ? '−' : '';
  const entierFormate = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const d = dec.slice(0, decimalesMax).replace(/0+$/, '').padEnd(decimalesMin, '0');
  return signe + entierFormate + (d ? ',' + d : '');
}

export function valeur(v: string, unite?: Unite | string): string {
  switch (unite) {
    case 'EUR':
      return `${nombre(v, 2, 2)} €`;
    case 'devise':
      return nombre(v, 2, 2);
    case '%':
      return `${nombre(v, 0, 4)} %`;
    case 'jours':
      return `${nombre(v)} j`;
    case 'mois':
      return `${nombre(v)} mois`;
    case 'annees':
      return `${nombre(v, 0, 2)} an${Number(v) >= 2 ? 's' : ''}`;
    case 'heures':
      return `${nombre(v)} h`;
    case 'fois':
      return `${nombre(v, 0, 2)} ×`;
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v;
    case 'booleen':
      return v === 'oui' ? 'Oui' : 'Non';
    case 'texte':
      return v;
    case 'entier':
    case 'unites':
      return nombre(v, 0, 0);
    default:
      return nombre(v);
  }
}

export const dateHeure = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
/** « 2026-10-13 » est lu comme un jour local (et non minuit UTC) pour ne pas glisser d'un jour. */
export const dateCourte = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
export { fmt };
