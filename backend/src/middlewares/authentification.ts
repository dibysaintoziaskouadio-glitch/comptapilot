import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { interdit, nonAuthentifie } from '../utils/erreurs';

export const COOKIE_SESSION = 'compta_session';

export interface Session {
  id: string;
  email: string;
  nom: string;
  role: 'ADMIN' | 'COMPTABLE' | 'LECTEUR';
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: Session;
  }
}

export function signer(s: Session): string {
  return jwt.sign(s, env.JWT_SECRET, { expiresIn: `${env.JWT_TTL_HEURES}h`, issuer: 'comptapilot' });
}

export function authentifier(req: Request, _res: Response, next: NextFunction): void {
  const jeton = req.cookies?.[COOKIE_SESSION] ?? (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  if (!jeton) return next(nonAuthentifie());
  try {
    const p = jwt.verify(jeton, env.JWT_SECRET, { issuer: 'comptapilot' }) as Session;
    req.session = { id: p.id, email: p.email, nom: p.nom, role: p.role };
    next();
  } catch {
    next(nonAuthentifie());
  }
}

export const exigerRole =
  (...roles: Session['role'][]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session || !roles.includes(req.session.role)) return next(interdit());
    next();
  };
