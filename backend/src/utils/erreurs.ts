export class ErreurApi extends Error {
  constructor(
    public readonly statut: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const nonTrouve = (quoi: string) => new ErreurApi(404, 'NON_TROUVE', `${quoi} introuvable`);
export const interdit = (message = 'Action non autorisée') => new ErreurApi(403, 'INTERDIT', message);
export const nonAuthentifie = () => new ErreurApi(401, 'NON_AUTHENTIFIE', 'Authentification requise');
