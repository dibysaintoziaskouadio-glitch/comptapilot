import { z, ZodTypeAny } from 'zod';
import { ErreurApi } from './erreurs';

export function valider<S extends ZodTypeAny>(schema: S, donnees: unknown): z.infer<S> {
  const r = schema.safeParse(donnees);
  if (!r.success)
    throw new ErreurApi(
      422,
      'VALIDATION',
      'Données invalides',
      r.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
    );
  return r.data;
}
