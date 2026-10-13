/**
 * Test transversal : chaque formule enregistrée est exécutée sur chacun de ses
 * exemples documentés ; les valeurs attendues doivent être reproduites à
 * l'identique, de façon déterministe et en moins de 100 ms.
 */
import { executerFormule, toutesLesFormules, MOTEURS } from '../src';

const formules = toutesLesFormules();

describe('Catalogue', () => {
  test('chaque formule est documentée et possède au moins un exemple', () => {
    for (const f of formules) {
      expect(f.references.length).toBeGreaterThan(0);
      expect(f.exemples.length).toBeGreaterThan(0);
      expect(f.expression.length).toBeGreaterThan(0);
      expect(MOTEURS.some((m) => m.code === f.moteur)).toBe(true);
    }
  });
});

describe.each(formules.map((f) => [`${f.moteur}/${f.id}`, f] as const))('%s', (_nom, f) => {
  test.each(f.exemples.map((ex) => [ex.titre, ex] as const))('exemple « %s »', (_t, ex) => {
    const r1 = executerFormule(f, ex.entrees);
    const obtenu: Record<string, string> = {};
    for (const cle of Object.keys(ex.attendu)) obtenu[cle] = r1.resultats[cle]?.valeur;
    expect(obtenu).toEqual(ex.attendu);
    // Déterminisme
    const r2 = executerFormule(f, ex.entrees);
    expect({ ...r2, dureeMs: 0 }).toEqual({ ...r1, dureeMs: 0 });
    // Aucune écriture déséquilibrée
    expect(r1.controles.filter((c) => c.code === 'ECRITURE_DESEQUILIBREE')).toEqual([]);
    // Performance
    // Performance : meilleur de trois exécutions (insensible à la charge des autres workers)
    expect(Math.min(r1.dureeMs, r2.dureeMs, executerFormule(f, ex.entrees).dureeMs)).toBeLessThan(100);
  });
});
