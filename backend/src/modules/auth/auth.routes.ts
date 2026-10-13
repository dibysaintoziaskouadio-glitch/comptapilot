import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { authentifier, COOKIE_SESSION, Session, signer } from '../../middlewares/authentification';
import { limiteAuth } from '../../middlewares/limites';
import { ErreurApi } from '../../utils/erreurs';
import { valider } from '../../utils/validation';
import { journaliser } from '../audit';
import { defautsMotDePasse } from '../../utils/motDePasse';

const schemaInscription = z
  .object({
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    nom: z.string().trim().min(2, 'Nom trop court').max(100),
    motDePasse: z.string().max(200),
  })
  .superRefine((d, ctx) => {
    const defauts = defautsMotDePasse(d.motDePasse, d.nom, d.email);
    if (defauts.length) ctx.addIssue({ code: 'custom', path: ['motDePasse'], message: `Mot de passe trop faible : ${defauts.join(', ')}.` });
  });
const schemaConnexion = z.object({ email: z.string().trim().toLowerCase().email(), motDePasse: z.string().min(1) });

const optionsCookie = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: env.JWT_TTL_HEURES * 3600 * 1000,
  path: '/',
});

const publique = (u: { id: string; email: string; nom: string; role: Session['role'] }) => ({ id: u.id, email: u.email, nom: u.nom, role: u.role });

export const routesAuth = Router();

routesAuth.post('/inscription', limiteAuth, async (req, res) => {
  const d = valider(schemaInscription, req.body);
  const nb = await prisma.utilisateur.count();
  if (nb > 0 && !env.ALLOW_REGISTRATION) throw new ErreurApi(403, 'INSCRIPTION_FERMEE', 'Les inscriptions sont fermées.');
  if (await prisma.utilisateur.findUnique({ where: { email: d.email } })) throw new ErreurApi(409, 'EMAIL_UTILISE', 'Cette adresse est déjà utilisée.');
  // Le premier compte créé administre l'application.
  const u = await prisma.utilisateur.create({ data: { email: d.email, nom: d.nom, motDePasse: await bcrypt.hash(d.motDePasse, 12), role: nb === 0 ? 'ADMIN' : 'COMPTABLE' } });
  await journaliser(u.id, 'INSCRIPTION', u.email);
  res.cookie(COOKIE_SESSION, signer(publique(u)), optionsCookie());
  res.status(201).json({ utilisateur: publique(u) });
});

routesAuth.post('/connexion', limiteAuth, async (req, res) => {
  const d = valider(schemaConnexion, req.body);
  const u = await prisma.utilisateur.findUnique({ where: { email: d.email } });
  // Comparaison effectuée même si l'utilisateur n'existe pas (temps constant).
  const ok = await bcrypt.compare(d.motDePasse, u?.motDePasse ?? '$2b$12$invalideinvalideinvalideinvalideinvalideinvalideinval');
  if (!u || !ok) throw new ErreurApi(401, 'IDENTIFIANTS', 'E-mail ou mot de passe incorrect.');
  await prisma.utilisateur.update({ where: { id: u.id }, data: { derniereConnexion: new Date() } });
  res.cookie(COOKIE_SESSION, signer(publique(u)), optionsCookie());
  res.json({ utilisateur: publique(u) });
});

routesAuth.post('/deconnexion', (_req, res) => {
  res.clearCookie(COOKIE_SESSION, { path: '/' });
  res.status(204).end();
});

routesAuth.get('/moi', authentifier, async (req, res) => {
  const u = await prisma.utilisateur.findUnique({ where: { id: req.session!.id } });
  if (!u) throw new ErreurApi(401, 'NON_AUTHENTIFIE', 'Session expirée');
  res.json({ utilisateur: publique(u), inscriptionOuverte: env.ALLOW_REGISTRATION });
});

routesAuth.get('/etat', async (_req, res) => {
  res.json({ premierDemarrage: (await prisma.utilisateur.count()) === 0, inscriptionOuverte: env.ALLOW_REGISTRATION });
});
