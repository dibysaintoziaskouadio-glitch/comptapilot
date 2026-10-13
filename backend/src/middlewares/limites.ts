import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erreur: { code: 'TROP_DE_TENTATIVES', message: 'Trop de tentatives, réessayez plus tard.' } },
});

export const limiteCalculs = rateLimit({
  windowMs: 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 10000 : 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erreur: { code: 'TROP_DE_REQUETES', message: 'Trop de calculs par minute.' } },
});
