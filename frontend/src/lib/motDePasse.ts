/**
 * Règles de mot de passe affichées en direct à l'inscription.
 * Miroir de backend/src/utils/motDePasse.ts, qui reste la seule vérification qui fait foi.
 */
export const LONGUEUR_MIN = 12;

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function fragmentsPersonnels(nom: string, email: string): string[] {
  const local = email.split('@')[0] ?? '';
  return [...nom.split(/[\s'’-]+/), ...local.split(/[._+-]+/)].map(sansAccents).filter((m) => m.length >= 3);
}

export interface Regle {
  id: string;
  libelle: string;
  ok: boolean;
}

export function reglesMotDePasse(mdp: string, nom: string, email: string): Regle[] {
  const m = sansAccents(mdp);
  return [
    { id: 'longueur', libelle: `${LONGUEUR_MIN} caractères min.`, ok: mdp.length >= LONGUEUR_MIN },
    { id: 'casse', libelle: 'Majuscule et minuscule', ok: /[a-z]/.test(mdp) && /[A-Z]/.test(mdp) },
    { id: 'chiffre', libelle: 'Un chiffre', ok: /\d/.test(mdp) },
    { id: 'special', libelle: 'Un caractère spécial', ok: /[^A-Za-z0-9]/.test(mdp) },
    { id: 'personnel', libelle: 'Sans nom ni e-mail', ok: mdp.length > 0 && !fragmentsPersonnels(nom, email).some((f) => m.includes(f)) },
  ];
}

export interface Robustesse {
  /** 0 (vide) à 4 (excellent). */
  niveau: 0 | 1 | 2 | 3 | 4;
  libelle: string;
  couleur: string;
}

const NIVEAUX: Omit<Robustesse, 'niveau'>[] = [
  { libelle: 'À saisir', couleur: 'rgb(255 255 255 / .15)' },
  { libelle: 'Faible', couleur: '#f43f5e' },
  { libelle: 'Moyen', couleur: '#f59e0b' },
  { libelle: 'Solide', couleur: '#22c55e' },
  { libelle: 'Excellent', couleur: '#22d3ee' },
];

/**
 * Indicateur visuel : conforme = « Solide » au moins ; « Excellent » au-delà de 16 caractères.
 * Un mot de passe non conforme ne dépasse jamais « Moyen ».
 */
export function robustesse(mdp: string, regles: Regle[]): Robustesse {
  if (!mdp) return { niveau: 0, ...NIVEAUX[0] };
  const respectees = regles.filter((r) => r.ok).length;
  let niveau: Robustesse['niveau'];
  if (respectees === regles.length) niveau = mdp.length >= 16 ? 4 : 3;
  else niveau = respectees >= 3 ? 2 : 1;
  return { niveau, ...NIVEAUX[niveau] };
}

export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
