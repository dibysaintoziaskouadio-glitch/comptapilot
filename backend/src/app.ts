import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { authentifier } from './middlewares/authentification';
import { gestionnaireErreurs } from './middlewares/erreurs';
import { routesAuth } from './modules/auth/auth.routes';
import { routesBaremes } from './modules/baremes/baremes.routes';
import { routesCalc } from './modules/calc/calc.routes';
import { routesHistorique } from './modules/historique/historique.routes';
import { prisma } from './config/prisma';

export function creerApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: true }));
  app.use(express.json({ limit: '6mb' })); // un FEC complet peut être volumineux
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/sante' } }));

  app.get('/api/sante', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ statut: 'ok' });
  });
  app.use('/api/auth', routesAuth);
  app.use('/api/calc', authentifier, routesCalc);
  app.use('/api/historique', authentifier, routesHistorique);
  app.use('/api/baremes', authentifier, routesBaremes);
  app.use('/api', (_req, res) => {
    res.status(404).json({ erreur: { code: 'NON_TROUVE', message: 'Route inconnue' } });
  });
  app.use(gestionnaireErreurs);
  return app;
}
