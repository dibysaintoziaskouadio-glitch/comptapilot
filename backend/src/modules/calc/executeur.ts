/**
 * Exécution des formules hors du fil principal.
 *
 * Un calcul est synchrone : sur une saisie démesurée (échéancier de milliers de lignes, tableau
 * de 10 000 mouvements…), il bloquerait toute l'API, connexions comprises. Les calculs passent
 * donc par un petit pool de workers, chacun limité en mémoire ; un calcul qui dépasse le délai
 * est interrompu (le worker est remplacé) et refusé, sans affecter les autres utilisateurs.
 *
 * Les versions de barèmes saisies par un administrateur sont rejouées dans chaque worker.
 */
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { ajouterVersion, type ResultatCalcul, type VersionBareme } from '@compta/moteurs';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ErreurApi } from '../../utils/erreurs';

const DELAI_MS = env.NODE_ENV === 'test' ? 30_000 : 10_000;
const MEMOIRE_MO = 256;
const FILE_MAX = 200;
const TAILLE = Math.max(1, Math.min(4, availableParallelism() - 1));

// Code du worker (JavaScript, pour fonctionner aussi bien compilé qu'avec tsx ou ts-jest).
const CODE = `
const { parentPort, workerData } = require('node:worker_threads');
const m = require(workerData.moteurs);
const appliquer = (v) => { try { m.ajouterVersion(v.code, v.version); } catch {} };
workerData.versions.forEach(appliquer);
parentPort.on('message', (msg) => {
  if (msg.version) return appliquer(msg.version);
  try {
    const f = m.obtenirFormule(msg.moteur, msg.formule);
    parentPort.postMessage({ id: msg.id, json: JSON.stringify(m.executerFormule(f, msg.entrees)) });
  } catch (e) {
    parentPort.postMessage({ id: msg.id, erreur: { nom: e && e.name, message: String(e && e.message), erreurs: e && e.erreurs } });
  }
});
`;

interface Tache {
  id: number;
  moteur: string;
  formule: string;
  entrees: Record<string, unknown>;
  resoudre: (r: ResultatCalcul) => void;
  rejeter: (e: unknown) => void;
}

interface Ouvrier {
  worker: Worker;
  tache?: Tache;
  minuterie?: NodeJS.Timeout;
  /** Arrêt demandé (délai dépassé) : ne reçoit plus de tâche. */
  arrete?: boolean;
}

const versions: { code: string; version: VersionBareme<unknown> }[] = [];
const ouvriers: Ouvrier[] = [];
const file: Tache[] = [];
let prochainId = 1;

/** Ajoute une version de barème au moteur du processus et à celui de chaque worker. */
export function enregistrerVersion(code: string, version: VersionBareme<unknown>): void {
  ajouterVersion(code, version);
  const i = versions.findIndex((v) => v.code === code && v.version.du === version.du);
  if (i >= 0) versions[i] = { code, version };
  else versions.push({ code, version });
  for (const o of ouvriers) o.worker.postMessage({ version: { code, version } });
}

function erreurDepuis(e: { nom?: string; message: string; erreurs?: unknown }): Error {
  if (e.nom === 'ErreurEntree') return new ErreurApi(422, 'ENTREES_INVALIDES', 'Entrées invalides', e.erreurs);
  if (e.nom === 'ErreurCalcul') return new ErreurApi(422, 'CALCUL_IMPOSSIBLE', e.message);
  return new Error(e.message);
}

function creer(): Ouvrier {
  const worker = new Worker(CODE, {
    eval: true,
    workerData: { moteurs: require.resolve('@compta/moteurs'), versions },
    resourceLimits: { maxOldGenerationSizeMb: MEMOIRE_MO },
  });
  worker.unref();
  const o: Ouvrier = { worker };
  worker.on('message', (msg: { id: number; json?: string; erreur?: { nom?: string; message: string; erreurs?: unknown } }) => {
    const t = o.tache;
    if (!t || t.id !== msg.id) return;
    liberer(o);
    if (msg.erreur) t.rejeter(erreurDepuis(msg.erreur));
    else t.resoudre(JSON.parse(msg.json!) as ResultatCalcul);
    suivante();
  });
  // Mémoire épuisée ou plantage : la tâche en cours est refusée et le worker remplacé.
  worker.on('error', (e) => logger.warn({ err: e }, 'Worker de calcul arrêté'));
  worker.on('exit', () => {
    const t = o.tache;
    liberer(o);
    const i = ouvriers.indexOf(o);
    if (i >= 0) ouvriers.splice(i, 1);
    t?.rejeter(new ErreurApi(422, 'CALCUL_TROP_LOURD', 'Ce calcul dépasse les ressources autorisées : réduisez la taille des données saisies.'));
    suivante();
  });
  ouvriers.push(o);
  return o;
}

function liberer(o: Ouvrier) {
  if (o.minuterie) clearTimeout(o.minuterie);
  o.tache = undefined;
  o.minuterie = undefined;
}

function suivante() {
  while (file.length) {
    const o = ouvriers.find((x) => !x.tache && !x.arrete) ?? (ouvriers.filter((x) => !x.arrete).length < TAILLE ? creer() : undefined);
    if (!o) return;
    const t = file.shift()!;
    o.tache = t;
    o.minuterie = setTimeout(() => {
      // Délai dépassé : le worker est arrêté (l'événement « exit » refuse la tâche et libère la place).
      o.arrete = true;
      liberer(o);
      t.rejeter(new ErreurApi(422, 'CALCUL_TROP_LONG', `Ce calcul dépasse ${DELAI_MS / 1000} s : réduisez la taille des données saisies.`));
      void o.worker.terminate();
    }, DELAI_MS);
    o.worker.postMessage({ id: t.id, moteur: t.moteur, formule: t.formule, entrees: t.entrees });
  }
}

/** Exécute la formule dans un worker ; mêmes erreurs que le moteur (entrées invalides, calcul impossible). */
export function executer(moteur: string, formule: string, entrees: Record<string, unknown>): Promise<ResultatCalcul> {
  if (file.length >= FILE_MAX) return Promise.reject(new ErreurApi(503, 'SERVEUR_OCCUPE', 'Le serveur est très sollicité, réessayez dans un instant.'));
  return new Promise((resoudre, rejeter) => {
    file.push({ id: prochainId++, moteur, formule, entrees, resoudre, rejeter });
    suivante();
  });
}

/** Démarre les workers à l'avance : le premier calcul n'attend pas le chargement du moteur. */
export function demarrerExecuteur(): void {
  while (ouvriers.filter((x) => !x.arrete).length < TAILLE) creer();
}

/** Arrête les workers (fin des tests, arrêt du serveur). */
export async function arreterExecuteur(): Promise<void> {
  await Promise.all(ouvriers.map((o) => o.worker.terminate()));
}
