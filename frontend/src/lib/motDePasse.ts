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
  /** Identifiant, traduit par l'interface (cx.regleLongueur, cx.regleCasse…). */
  id: 'longueur' | 'casse' | 'chiffre' | 'special' | 'personnel';
  ok: boolean;
}

export function reglesMotDePasse(mdp: string, nom: string, email: string): Regle[] {
  const m = sansAccents(mdp);
  return [
    { id: 'longueur', ok: mdp.length >= LONGUEUR_MIN },
    { id: 'casse', ok: /[a-z]/.test(mdp) && /[A-Z]/.test(mdp) },
    { id: 'chiffre', ok: /\d/.test(mdp) },
    { id: 'special', ok: /[^A-Za-z0-9]/.test(mdp) },
    { id: 'personnel', ok: mdp.length > 0 && !fragmentsPersonnels(nom, email).some((f) => m.includes(f)) },
  ];
}

export interface Robustesse {
  /** 0 (vide) à 4 (excellent) ; libellé traduit par l'interface (cx.niveau0…4). */
  niveau: 0 | 1 | 2 | 3 | 4;
  couleur: string;
}

const COULEURS = ['rgb(255 255 255 / .15)', '#f43f5e', '#f59e0b', '#22c55e', '#22d3ee'];

/**
 * Indicateur visuel : conforme = « Solide » au moins ; « Excellent » au-delà de 16 caractères.
 * Un mot de passe non conforme ne dépasse jamais « Moyen ».
 */
export function robustesse(mdp: string, regles: Regle[]): Robustesse {
  if (!mdp) return { niveau: 0, couleur: COULEURS[0] };
  const respectees = regles.filter((r) => r.ok).length;
  let niveau: Robustesse['niveau'];
  if (respectees === regles.length) niveau = mdp.length >= 16 ? 4 : 3;
  else niveau = respectees >= 3 ? 2 : 1;
  return { niveau, couleur: COULEURS[niveau] };
}

export const emailValide = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
