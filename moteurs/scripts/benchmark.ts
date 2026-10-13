/**
 * Benchmark séquentiel : durée médiane et maximale de chaque formule sur ses
 * exemples (après échauffement), et reproduction des valeurs de référence.
 * Génère docs/BENCHMARKS.md.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { executerFormule, toutesLesFormules } from '../src';

const ITER = 15;
const lignes: { id: string; mediane: number; max: number; ok: boolean; ref: string }[] = [];
for (const f of toutesLesFormules())
  for (const ex of f.exemples) {
    executerFormule(f, ex.entrees); // échauffement
    const t: number[] = [];
    let ok = true;
    for (let i = 0; i < ITER; i++) {
      const t0 = performance.now();
      const r = executerFormule(f, ex.entrees);
      t.push(performance.now() - t0);
      ok = ok && Object.entries(ex.attendu).every(([k, v]) => r.resultats[k]?.valeur === v);
    }
    t.sort((a, b) => a - b);
    lignes.push({ id: `${f.moteur}/${f.id} — ${ex.titre}`, mediane: t[Math.floor(ITER / 2)], max: t[ITER - 1], ok, ref: ex.source ?? 'calcul manuel recoupé' });
  }
const lents = lignes.filter((l) => l.mediane >= 100);
const echecs = lignes.filter((l) => !l.ok);
const md = [
  '# Benchmarks du moteur de calcul',
  '',
  `> Généré par \`npm run bench\` — ${lignes.length} cas, ${ITER} exécutions chacun, Node ${process.version}.`,
  '',
  `- Médiane globale : ${lignes.map((l) => l.mediane).sort((a, b) => a - b)[Math.floor(lignes.length / 2)].toFixed(2)} ms`,
  `- Cas ≥ 100 ms (médiane) : ${lents.length}`,
  `- Valeurs de référence non reproduites : ${echecs.length}`,
  '',
  '| Cas | Médiane (ms) | Max (ms) | Référence reproduite | Origine de la référence |',
  '|---|---:|---:|:---:|---|',
  ...lignes.map((l) => `| ${l.id} | ${l.mediane.toFixed(2)} | ${l.max.toFixed(2)} | ${l.ok ? '✅' : '❌'} | ${l.ref} |`),
  '',
].join('\n');
writeFileSync(join(__dirname, '..', '..', 'docs', 'BENCHMARKS.md'), md);
console.log(`${lignes.length} cas — ${lents.length} ≥ 100 ms — ${echecs.length} écarts de référence.`);
if (lents.length || echecs.length) process.exitCode = 1;
