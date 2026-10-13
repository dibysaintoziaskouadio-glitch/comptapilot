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
}

export interface CalculResume {
  id: string;
  moteur: string;
  formuleId: string;
  formuleNom: string;
  formuleVersion: string;
  libelle: string | null;
  principal: string | null;
  empreinte: string;
  nbErreurs: number;
  nbAvertissements: number;
  dureeMs: number;
  statut: 'BROUILLON' | 'VALIDE';
  valideLe: string | null;
  creeLe: string;
}
