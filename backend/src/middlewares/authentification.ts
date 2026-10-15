import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
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

/** `v` : version de session de l'utilisateur à la signature (voir `versionSession`). */
export function signer(s: Session, v: number): string {
  return jwt.sign({ ...s, v }, env.JWT_SECRET, { expiresIn: `${env.JWT_TTL_HEURES}h`, issuer: 'comptapilot', algorithm: 'HS256' });
}

/** Intervalle minimal entre deux mises à jour de la dernière activité d'un compte. */
const ACTIVITE_MS = 60_000;

/**
 * Vérifie le jeton puis relit le compte : une session est refusée si le compte n'existe plus, s'il a été
 * désactivé ou si le mot de passe a changé depuis sa création ; le rôle appliqué est celui de la base.
 */
export async function authentifier(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const jeton = req.cookies?.[COOKIE_SESSION] ?? (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
  if (!jeton) return next(nonAuthentifie());
  let p: Session & { v?: number };
  try {
    p = jwt.verify(jeton, env.JWT_SECRET, { issuer: 'comptapilot', algorithms: ['HS256'] }) as Session & { v?: number };
  } catch {
    return next(nonAuthentifie());
  }
  const u = await prisma.utilisateur.findUnique({ where: { id: p.id }, select: { email: true, nom: true, role: true, versionSession: true, actif: true, derniereActivite: true } });
  if (!u || !u.actif || u.versionSession !== (p.v ?? 0)) return next(nonAuthentifie());
  if (!u.derniereActivite || Date.now() - u.derniereActivite.getTime() > ACTIVITE_MS)
    await prisma.utilisateur.update({ where: { id: p.id }, data: { derniereActivite: new Date() } });
  req.session = { id: p.id, email: u.email, nom: u.nom, role: u.role };
  next();
}

export const exigerRole =
  (...roles: Session['role'][]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session || !roles.includes(req.session.role)) return next(interdit());
    next();
  };
