/**
 * Politique de mot de passe à l'inscription (inspirée de la recommandation CNIL de 2022) :
 * 12 caractères minimum, minuscule, majuscule, chiffre et caractère spécial,
 * sans reprendre le nom ni l'adresse e-mail.
 * Les mêmes règles sont affichées en direct dans le formulaire : frontend/src/lib/motDePasse.ts.
 */
export const LONGUEUR_MIN = 12;

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Fragments personnels (mots du nom et partie locale de l'e-mail) de 3 lettres ou plus. */
export function fragmentsPersonnels(nom: string, email: string): string[] {
  const local = email.split('@')[0] ?? '';
  return [...nom.split(/[\s'’-]+/), ...local.split(/[._+-]+/)].map(sansAccents).filter((m) => m.length >= 3);
}

/** Liste des règles non respectées (vide si le mot de passe est conforme). */
export function defautsMotDePasse(mdp: string, nom: string, email: string): string[] {
  const d: string[] = [];
  if (mdp.length < LONGUEUR_MIN) d.push(`${LONGUEUR_MIN} caractères minimum`);
  if (!/[a-z]/.test(mdp) || !/[A-Z]/.test(mdp)) d.push('une minuscule et une majuscule');
  if (!/\d/.test(mdp)) d.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(mdp)) d.push('un caractère spécial');
  const m = sansAccents(mdp);
  if (fragmentsPersonnels(nom, email).some((f) => m.includes(f))) d.push('ne pas contenir votre nom ni votre e-mail');
  return d;
}
