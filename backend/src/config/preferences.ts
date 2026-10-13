/**
 * Langues de l'interface et monnaies d'affichage proposées.
 * La monnaie ne convertit rien : elle indique dans quelle unité monétaire l'utilisateur saisit et lit ses montants.
 * Liste reprise dans frontend/src/lib/devises.ts.
 */
export const LANGUES = ['fr', 'en'] as const;
export type Langue = (typeof LANGUES)[number];

export const DEVISES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'MAD', 'DZD', 'TND', 'NGN', 'GHS', 'GNF', 'CDF', 'KES', 'ZAR', 'CNY', 'JPY'] as const;
export type Devise = (typeof DEVISES)[number];
