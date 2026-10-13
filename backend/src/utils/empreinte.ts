import { createHash } from 'node:crypto';

/** JSON canonique : clés triées récursivement, pour une empreinte stable. */
export function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}

export function empreinte(v: unknown): string {
  return createHash('sha256').update(canonique(v)).digest('hex');
}
