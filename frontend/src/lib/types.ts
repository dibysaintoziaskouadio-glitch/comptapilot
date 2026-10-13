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
