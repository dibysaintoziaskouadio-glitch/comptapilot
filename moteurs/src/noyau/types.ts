/** Types publics du moteur de calcul (partagés avec l'API et l'interface). */

export type CodeMoteur =
  | 'base'
  | 'tva'
  | 'amortissements'
  | 'provisions'
  | 'paie'
  | 'fiscal'
  | 'financier'
  | 'tresorerie'
  | 'analytique'
  | 'investissement'
  | 'stocks'
  | 'consolidation'
  | 'sectoriels';

export type TypeChamp =
  | 'montant' // décimal en euros
  | 'nombre' // décimal quelconque
  | 'taux' // saisi en pourcentage (20 = 20 %), transmis au calcul en fraction (0,2)
  | 'entier'
  | 'date' // AAAA-MM-JJ
  | 'choix'
  | 'booleen'
  | 'liste' // liste de décimaux
  | 'table' // lignes structurées (voir `colonnes`)
  | 'texte';

export interface OptionChamp {
  valeur: string;
  libelle: string;
}

export interface Champ {
  nom: string;
  libelle: string;
  type: TypeChamp;
  defaut?: unknown;
  aide?: string;
  unite?: string;
  min?: string;
  max?: string;
  optionnel?: boolean;
  options?: OptionChamp[];
  /** Valeurs rapides proposées par l'interface (ex. taux de TVA). */
  suggestions?: string[];
  /** Colonnes d'un champ `table`. */
  colonnes?: Champ[];
  /** Le champ n'est affiché et validé que si `champ` vaut l'une des `valeurs`. */
  visibleSi?: { champ: string; valeurs: unknown[] };
  /** Regroupement visuel dans le formulaire. */
  groupe?: string;
}

export type Unite =
  | 'EUR'
  | '%'
  | 'nombre'
  | 'entier'
  | 'jours'
  | 'mois'
  | 'annees'
  | 'heures'
  | 'unites'
  | 'fois'
  | 'date'
  | 'texte'
  | 'devise'
  | 'booleen';

export interface ValeurResultat {
  libelle: string;
  valeur: string;
  unite: Unite;
  principal?: boolean;
  aide?: string;
  groupe?: string;
}

export interface Etape {
  libelle: string;
  formule: string;
  valeur: string;
  unite?: Unite;
}

export type NiveauControle = 'ok' | 'info' | 'avertissement' | 'erreur';

export interface Controle {
  niveau: NiveauControle;
  code: string;
  message: string;
}

export interface Reference {
  texte: string;
  url?: string;
}

export interface ColonneTableau {
  cle: string;
  libelle: string;
  unite?: Unite;
}

export interface Graphique {
  type: 'barres' | 'lignes' | 'aires' | 'barres-empilees';
  x: string;
  series: string[];
}

export interface Tableau {
  titre: string;
  colonnes: ColonneTableau[];
  lignes: Record<string, string>[];
  totaux?: Record<string, string>;
  graphique?: Graphique;
}

export interface LigneEcriture {
  compte: string;
  intitule: string;
  debit?: string;
  credit?: string;
}

export interface Ecriture {
  libelle: string;
  journal?: string;
  lignes: LigneEcriture[];
}

export interface BaremeUtilise {
  code: string;
  libelle: string;
  du: string;
  au?: string;
  source: string;
  statut: 'officiel' | 'a_verifier';
}

export interface ResultatCalcul {
  formule: { id: string; moteur: CodeMoteur; nom: string; version: string; expression: string };
  entrees: Record<string, unknown>;
  resultats: Record<string, ValeurResultat>;
  etapes: Etape[];
  controles: Controle[];
  tableaux: Tableau[];
  ecritures: Ecriture[];
  references: Reference[];
  baremes: BaremeUtilise[];
  dureeMs: number;
}

export interface ErreurChamp {
  champ: string;
  message: string;
}

export interface ExempleFormule {
  titre: string;
  entrees: Record<string, unknown>;
  /** Valeurs attendues (sous-ensemble des résultats), vérifiées par les tests. */
  attendu: Record<string, string>;
  /** Source de la valeur attendue (cas officiel, calcul manuel…). */
  source?: string;
}

/** Description publique d'une formule (sans la fonction de calcul). */
export interface DescriptionFormule {
  id: string;
  moteur: CodeMoteur;
  nom: string;
  description: string;
  categorie: string;
  expression: string;
  version: string;
  references: Reference[];
  champs: Champ[];
  exemples: ExempleFormule[];
  motsCles: string[];
  baremes: string[];
}

export interface DescriptionMoteur {
  code: CodeMoteur;
  dossier: string;
  nom: string;
  description: string;
  icone: string;
  formules: DescriptionFormule[];
}
