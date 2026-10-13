import { ErreurChamp } from './types';

/** Entrées invalides : renvoyées champ par champ à l'utilisateur. */
export class ErreurEntree extends Error {
  constructor(public readonly erreurs: ErreurChamp[]) {
    super(erreurs.map((e) => `${e.champ} : ${e.message}`).join(' ; '));
    this.name = 'ErreurEntree';
  }
}

/** Calcul impossible avec les entrées fournies (cas non défini, barème manquant…). */
export class ErreurCalcul extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurCalcul';
  }
}
