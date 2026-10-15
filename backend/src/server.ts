import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { creerApp } from './app';
import { synchroniserBaremes } from './modules/baremes/baremes.service';
import { arreterExecuteur, demarrerExecuteur } from './modules/calc/executeur';

async function demarrer() {
  await prisma.$connect();
  await synchroniserBaremes();
  demarrerExecuteur();
  const serveur = creerApp().listen(env.PORT, () => logger.info(`Comptapilot API sur http://localhost:${env.PORT}`));
  const arreter = async () => {
    serveur.close();
    await arreterExecuteur();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', arreter);
  process.on('SIGINT', arreter);
}

demarrer().catch((e) => {
  logger.fatal(e, 'Échec du démarrage');
  process.exit(1);
});
