/**
 * Génère docs/FORMULES.md (catalogue exhaustif avec formules, entrées, références
 * légales et exemples vérifiés) et docs/BAREMES.md (barèmes versionnés).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { catalogue, listerBaremes, MOTEURS } from '../src';

const racine = join(__dirname, '..', '..', 'docs');
mkdirSync(racine, { recursive: true });
const cat = catalogue();
const total = cat.reduce((n, m) => n + m.formules.length, 0);
const l: string[] = [];
l.push('# Catalogue des formules', '');
l.push(`> Document généré automatiquement par \`npm run docs\` à partir du registre du moteur — ${total} formules, ${cat.length} moteurs.`, '');
l.push('| Moteur | Dossier | Formules |', '|---|---|---|');
for (const m of cat) l.push(`| [${m.nom}](#${m.code}) | \`moteurs/src/${m.dossier}\` | ${m.formules.length} |`);
l.push('');
for (const m of cat) {
  l.push(`## <a id="${m.code}"></a>${m.nom}`, '', m.description, '');
  const cats = [...new Set(m.formules.map((f) => f.categorie))];
  for (const c of cats) {
    l.push(`### ${c}`, '');
    for (const f of m.formules.filter((x) => x.categorie === c)) {
      l.push(`#### ${f.nom}`, '');
      l.push(`\`POST /api/calc/${m.code}/${f.id}\` — version ${f.version}`, '');
      l.push(f.description, '');
      l.push('```text', f.expression, '```', '');
      l.push('**Entrées**', '');
      for (const ch of f.champs) l.push(`- \`${ch.nom}\` (${ch.type}${ch.optionnel ? ', optionnel' : ''}) — ${ch.libelle}${ch.defaut !== undefined && typeof ch.defaut !== 'object' ? ` — défaut : \`${ch.defaut}\`` : ''}`);
      l.push('', '**Références**', '');
      for (const r of f.references) l.push(`- ${r.url ? `[${r.texte}](${r.url})` : r.texte}`);
      if (f.baremes.length) l.push('', `**Barèmes** : ${f.baremes.map((b) => `\`${b}\``).join(', ')}`);
      l.push('', '**Exemples vérifiés par les tests**', '');
      for (const ex of f.exemples) l.push(`- *${ex.titre}* → ${Object.entries(ex.attendu).map(([k, v]) => `\`${k}\` = ${v}`).join(', ')}${ex.source ? ` (source : ${ex.source})` : ''}`);
      l.push('');
    }
  }
}
writeFileSync(join(racine, 'FORMULES.md'), l.join('\n'));

const b: string[] = ['# Barèmes et taux versionnés', '', '> Généré par `npm run docs`. Le moteur applique la version en vigueur à la date de l’opération ; une version « à vérifier » ou une date postérieure à la dernière version connue déclenche une alerte.', ''];
for (const m of MOTEURS) {
  const bs = listerBaremes().filter((x) => x.moteur === m.code && !x.code.startsWith('test.'));
  if (!bs.length) continue;
  b.push(`## ${m.nom}`, '');
  for (const x of bs) {
    b.push(`### ${x.libelle} — \`${x.code}\``, '', '| Du | Au | Statut | Source |', '|---|---|---|---|');
    for (const v of x.versions) b.push(`| ${v.du} | ${v.au ?? '—'} | ${v.statut === 'officiel' ? 'officiel' : '⚠️ à vérifier'} | ${v.source}${v.note ? ` — ${v.note}` : ''} |`);
    b.push('');
  }
}
writeFileSync(join(racine, 'BAREMES.md'), b.join('\n'));
console.log(`docs/FORMULES.md (${total} formules) et docs/BAREMES.md générés.`);
