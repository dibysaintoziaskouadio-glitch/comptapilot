/**
 * Balayage des variantes : chaque formule est exécutée pour chaque option de
 * chacun de ses champs « choix » et pour chaque case « booléen » activée.
 * Invariants : pas d'exception autre qu'une erreur métier signalée, résultats
 * présents, écritures équilibrées, exécution déterministe et < 100 ms.
 */
import { Champ, ErreurCalcul, ErreurEntree, executerFormule, somme, toutesLesFormules, Formule } from '../src';

function variantes(f: Formule<any>): { nom: string; entrees: Record<string, unknown> }[] {
  const out: { nom: string; entrees: Record<string, unknown> }[] = [];
  const base = f.exemples[0]?.entrees ?? {};
  const visit = (champ: Champ) => {
    if (champ.type === 'choix') for (const o of champ.options ?? []) out.push({ nom: `${champ.nom}=${o.valeur}`, entrees: { ...base, [champ.nom]: o.valeur } });
    if (champ.type === 'booleen') {
      out.push({ nom: `${champ.nom}=oui`, entrees: { ...base, [champ.nom]: true } });
      out.push({ nom: `${champ.nom}=non`, entrees: { ...base, [champ.nom]: false } });
    }
  };
  f.champs.forEach(visit);
  // Variantes croisées : chaque booléen activé avec chaque option du premier choix
  const premierChoix = f.champs.find((c) => c.type === 'choix');
  const booleens = f.champs.filter((c) => c.type === 'booleen');
  if (premierChoix)
    for (const o of premierChoix.options ?? []) for (const b of booleens) out.push({ nom: `${premierChoix.nom}=${o.valeur}+${b.nom}`, entrees: { ...base, [premierChoix.nom]: o.valeur, [b.nom]: true } });
  return out;
}

const cas = toutesLesFormules().flatMap((f) => variantes(f).map((v) => [`${f.moteur}/${f.id} [${v.nom}]`, f, v.entrees] as const));

test('le balayage couvre plusieurs centaines de variantes', () => {
  expect(cas.length).toBeGreaterThan(250);
});

test.each(cas)('%s', (_nom, f, entrees) => {
  let r;
  try {
    r = executerFormule(f, entrees);
  } catch (e) {
    // Une combinaison incohérente doit être refusée proprement, jamais planter.
    expect(e instanceof ErreurCalcul || e instanceof ErreurEntree).toBe(true);
    return;
  }
  expect(r.controles.length).toBeGreaterThan(0);
  for (const e of r.ecritures) {
    const ecart = somme(e.lignes.map((l) => l.debit ?? 0)).minus(somme(e.lignes.map((l) => l.credit ?? 0)));
    expect(ecart.abs().lessThanOrEqualTo('0.01')).toBe(true);
  }
  const r2 = executerFormule(f, entrees);
  expect({ ...r2, dureeMs: 0 }).toEqual({ ...r, dureeMs: 0 });
  expect(Math.min(r.dureeMs, r2.dureeMs, executerFormule(f, entrees).dureeMs)).toBeLessThan(100);
});
