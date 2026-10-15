import type { NextFunction, Request, Response } from 'express';
import { ErreurCalcul, ErreurEntree } from '@compta/moteurs';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';
import { ErreurApi } from '../utils/erreurs';

export function gestionnaireErreurs(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ErreurApi) {
    res.status(err.statut).json({ erreur: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ErreurEntree) {
    res.status(422).json({ erreur: { code: 'ENTREES_INVALIDES', message: 'Entrées invalides', details: err.erreurs } });
    return;
  }
  if (err instanceof ErreurCalcul) {
    res.status(422).json({ erreur: { code: 'CALCUL_IMPOSSIBLE', message: err.message } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ erreur: { code: 'CONFLIT', message: 'Cet élément existe déjà' } });
    return;
  }
  if ((err as { type?: string } | null)?.type === 'entity.too.large') {
    res.status(413).json({ erreur: { code: 'TROP_VOLUMINEUX', message: 'Requête trop volumineuse.' } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({ erreur: { code: 'JSON_INVALIDE', message: 'Corps de requête JSON invalide' } });
    return;
  }
  logger.error({ err, url: req.originalUrl }, 'Erreur non gérée');
  res.status(500).json({ erreur: { code: 'ERREUR_INTERNE', message: 'Erreur interne du serveur' } });
}
