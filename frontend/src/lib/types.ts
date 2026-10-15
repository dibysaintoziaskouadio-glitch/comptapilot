export type {
  Champ,
  CodeMoteur,
  Controle,
  DescriptionFormule,
  DescriptionMoteur,
  Ecriture,
  Etape,
  ResultatCalcul,
  Tableau,
  Unite,
  ValeurResultat,
} from '@compta/moteurs';

export interface Utilisateur {
  id: string;
  email: string;
  nom: string;
  role: 'ADMIN' | 'COMPTABLE' | 'LECTEUR';
  langue: 'fr' | 'en';
  devise: string;
  telephone: string | null;
}

/** Compte vu par l'administrateur (écran Utilisateurs). */
export interface CompteAdmin {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: 'ADMIN' | 'COMPTABLE' | 'LECTEUR';
  actif: boolean;
  confirme: boolean;
  enLigne: boolean;
  creeLe: string;
  derniereConnexion: string | null;
  derniereActivite: string | null;
  nbCalculs: number;
}

/** Événement du journal des connexions et des comptes. */
export interface EvenementCompte {
  id: string;
  action: string;
  cible: string | null;
  details: { ip?: string; de?: string; vers?: string } | null;
  creeLe: string;
  utilisateur: { nom: string; email: string } | null;
}

export interface CalculResume {
  id: string;
  moteur: string;
  formuleId: string;
  formuleNom: string;
  formuleVersion: string;
  libelle: string | null;
  /** Libellé du résultat principal (anciens calculs : libellé et valeur déjà formatés). */
  principal: string | null;
  principalValeur: string | null;
  principalUnite: string | null;
  /** Monnaie dans laquelle le calcul a été saisi. */
  devise: string;
  empreinte: string;
  nbErreurs: number;
  nbAvertissements: number;
  dureeMs: number;
  statut: 'BROUILLON' | 'VALIDE';
  valideLe: string | null;
  creeLe: string;
}
