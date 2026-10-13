export class ErreurApi extends Error {
  constructor(
    public statut: number,
    public code: string,
    message: string,
    public details?: { champ: string; message: string }[],
  ) {
    super(message);
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
    throw new ErreurApi(r.status, corps?.erreur?.code ?? 'ERREUR', corps?.erreur?.message ?? `Erreur ${r.status}`, corps?.erreur?.details);
  }
  return corps as T;
}
