/** Raccourcis de déclaration des champs d'entrée. */
import { Champ, OptionChamp } from './types';

type Opts = Partial<Omit<Champ, 'nom' | 'libelle' | 'type'>>;

export const montant = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'montant', unite: '€', ...o });
export const nombre = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'nombre', ...o });
export const taux = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'taux', unite: '%', ...o });
export const entier = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'entier', ...o });
export const date = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'date', ...o });
export const booleen = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'booleen', defaut: false, ...o });
export const texte = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'texte', ...o });
export const liste = (nom: string, libelle: string, o: Opts = {}): Champ => ({ nom, libelle, type: 'liste', ...o });

export const choix = (nom: string, libelle: string, options: [string, string][], o: Opts = {}): Champ => ({
  nom,
  libelle,
  type: 'choix',
  options: options.map(([valeur, lib]): OptionChamp => ({ valeur, libelle: lib })),
  defaut: options[0]?.[0],
  ...o,
});

export const table = (nom: string, libelle: string, colonnes: Champ[], o: Opts = {}): Champ => ({
  nom,
  libelle,
  type: 'table',
  colonnes,
  ...o,
});

/** Date de l'opération : détermine la version des barèmes appliquée. */
export const dateOperation = (libelle = "Date de l'opération", o: Opts = {}): Champ =>
  date('dateOperation', libelle, { aide: 'Détermine la version des taux et barèmes appliquée.', ...o });

export const TAUX_TVA_FR = ['20', '10', '5.5', '2.1', '0'];
