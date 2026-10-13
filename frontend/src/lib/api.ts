export class ErreurApi extends Error {
  constructor(
    public statut: number,
    public code: string,
    message: string,
    public details?: { champ: string; message: string }[] | Record<string, unknown>,
    /** Corps complet de la réponse (ex. état de vérification joint à COMPTE_NON_VERIFIE). */
    public corps?: Record<string, unknown>,
  ) {
    super(message);
  }
  /** Détails par champ, quand l'API en fournit une liste. */
  get champs(): { champ: string; message: string }[] {
    return Array.isArray(this.details) ? this.details : [];
  }
}

export async function api<T>(chemin: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...init } = options;
  const r = await fetch(`/api${chemin}`, {
    credentials: 'include',
    ...init,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  if (r.status === 204) return undefined as T;
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && !chemin.startsWith('/auth')) window.dispatchEvent(new Event('session-expiree'));
    throw new ErreurApi(r.status, corps?.erreur?.code ?? 'ERREUR', corps?.erreur?.message ?? `Erreur ${r.status}`, corps?.erreur?.details, corps);
  }
  return corps as T;
}
