/**
 * Tests de propriétés (fast-check) : invariants comptables vérifiés sur des
 * entrées aléatoires — équilibre, symétrie, conservation, déterminisme.
 */
import fc from 'fast-check';
import { d, executer, somme, toutesLesFormules, executerFormule } from '../src';
import { tableauEmprunt } from '../src/calculs-tresorerie';
import { planLineaire, planDegressif } from '../src/calculs-amortissement/plans';
import { valoriser } from '../src/calculs-stocks';

const montantArb = fc.integer({ min: 0, max: 10_000_000_00 }).map((c) => (c / 100).toFixed(2));
const tauxTva = fc.constantFrom('20', '10', '5.5', '2.1', '8.5', '13');
const RUNS = { numRuns: 150 };

describe('TVA : symétrie HT ↔ TTC', () => {
  test('depuis HT : TTC = HT + TVA exactement', () => {
    fc.assert(
      fc.property(montantArb, tauxTva, (ht, t) => {
        const r = executer('tva', 'ht-ttc', { depuis: 'HT', montant: ht, taux: t });
        return d(r.resultats.ht.valeur).plus(r.resultats.tva.valeur).equals(r.resultats.ttc.valeur);
      }),
      RUNS,
    );
  });
  test('depuis TTC : HT + TVA = TTC et |HT × t − TVA| ≤ 0,01', () => {
    fc.assert(
      fc.property(montantArb, tauxTva, (ttc, t) => {
        const r = executer('tva', 'ht-ttc', { depuis: 'TTC', montant: ttc, taux: t });
        const ht = d(r.resultats.ht.valeur);
        const tva = d(r.resultats.tva.valeur);
        return ht.plus(tva).equals(ttc) && ht.times(d(t).div(100)).minus(tva).abs().lessThanOrEqualTo('0.01');
      }),
      RUNS,
    );
  });
  test('aller-retour HT → TTC → HT stable', () => {
    fc.assert(
      fc.property(montantArb, tauxTva, (ht, t) => {
        const ttc = executer('tva', 'ht-ttc', { depuis: 'HT', montant: ht, taux: t }).resultats.ttc.valeur;
        const retour = executer('tva', 'ht-ttc', { depuis: 'TTC', montant: ttc, taux: t }).resultats.ht.valeur;
        return d(retour).minus(ht).abs().lessThanOrEqualTo('0.01');
      }),
      RUNS,
    );
  });
});

describe('Répartition au centime', () => {
  test('la somme des parts égale toujours le total', () => {
    fc.assert(
      fc.property(montantArb, fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 12 }), (total, cles) => {
        const r = executer('base', 'repartition-proportionnelle', { total, cles: cles.map((c, i) => ({ libelle: `L${i}`, cle: String(c) })) });
        const s = somme(cles.map((_, i) => r.resultats[`part_${i + 1}`].valeur));
        return s.equals(total);
      }),
      RUNS,
    );
  });
});

describe('Emprunts', () => {
  test('CRD final nul et Σ amortissements = capital, pour tout prêt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 5_000_000 }),
        fc.integer({ min: 0, max: 1500 }),
        fc.integer({ min: 1, max: 360 }),
        fc.constantFrom('annuites', 'amortissement-constant', 'in-fine') as fc.Arbitrary<'annuites'>,
        (capital, tauxBp, n, type) => {
          const lignes = tableauEmprunt({
            capital: d(capital),
            tauxPeriodique: d(tauxBp).div(10000).div(12),
            periodes: n,
            type,
            differe: 0,
            typeDiffere: 'partiel',
            assurancePeriodique: d(0),
            assuranceSurCrd: false,
          });
          return lignes[lignes.length - 1].crdFin.isZero() && somme(lignes.map((l) => l.amortissement)).equals(capital) && lignes.every((l) => !l.crdFin.isNegative());
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Amortissements', () => {
  const dateArb = fc.date({ min: new Date('2015-01-01'), max: new Date('2030-12-30') }).map((x) => x.toISOString().slice(0, 10));
  test('plan linéaire : Σ dotations = base, VNC jamais négative', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000_000 }), fc.integer({ min: 1, max: 40 }), dateArb, (vo, n, mes) => {
        const cloture = `${mes.slice(0, 4)}-12-31`;
        const plan = planLineaire(d(vo), 0, n, mes, cloture, 'jours360');
        return somme(plan.map((l) => l.dotation)).equals(vo) && plan.every((l) => !l.vnc.isNegative());
      }),
      RUNS,
    );
  });
  test('plan dégressif : Σ dotations = VO et dotations décroissantes jusqu’à la bascule', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 10_000_000 }), fc.integer({ min: 3, max: 20 }), dateArb, (vo, n, acq) => {
        const plan = planDegressif(d(vo), n, acq, `${acq.slice(0, 4)}-12-31`);
        return somme(plan.map((l) => l.dotation)).equals(vo) && plan.every((l) => !l.dotation.isNegative());
      }),
      RUNS,
    );
  });
});

describe('Paie : cohérence brut → net → coût', () => {
  test('net + cotisations salariales = brut ; coût = brut + patronales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 180000, max: 4000000 }),
        fc.constantFrom('non-cadre', 'cadre'),
        fc.constantFrom('1-10', '20-49', '250+'),
        fc.constantFrom('2024-06-30', '2025-03-31', '2025-09-30'),
        fc.integer({ min: 0, max: 20 }),
        (centimes, statut, effectif, dateOperation, hs) => {
          const r = executer('paie', 'bulletin', { salaireBase: (centimes / 100).toFixed(2), statut, effectif, dateOperation, hs25: String(hs) });
          const v = (k: string) => d(r.resultats[k].valeur);
          return (
            v('netAvantImpot').plus(v('cotisationsSalariales')).equals(v('brut')) &&
            v('coutEmployeur').equals(v('brut').plus(v('cotisationsPatronales'))) &&
            v('reductionGenerale').greaterThanOrEqualTo(0) &&
            !r.controles.some((c) => c.code.startsWith('COHERENCE') && c.niveau === 'erreur')
          );
        },
      ),
      { numRuns: 80 },
    );
  });
  test('la réduction générale décroît quand le salaire augmente', () => {
    const rg = (s: string) => d(executer('paie', 'bulletin', { salaireBase: s, dateOperation: '2024-06-30' }).resultats.reductionGenerale.valeur);
    expect(rg('1800').greaterThan(rg('2200'))).toBe(true);
    expect(rg('2200').greaterThan(rg('2600'))).toBe(true);
    expect(rg('3000').isZero()).toBe(true);
  });
});

describe('Stocks : conservation de la valeur', () => {
  test('SI + entrées − sorties = SF, pour les 4 méthodes', () => {
    const mvtArb = fc.array(
      fc.record({ type: fc.constantFrom('entree', 'sortie'), q: fc.integer({ min: 1, max: 500 }), pu: fc.integer({ min: 100, max: 5000 }) }),
      { minLength: 1, maxLength: 15 },
    );
    fc.assert(
      fc.property(mvtArb, fc.constantFrom('cmp', 'cmp-periodique', 'fifo', 'lifo'), (ms, methode) => {
        const mvts = ms.map((m, i) => ({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, type: m.type as 'entree', quantite: d(m.q), prixUnitaire: d(m.pu).div(100) }));
        const r = valoriser(methode as 'cmp', d(1000), d(10000), mvts);
        const entrees = somme(mvts.filter((m) => m.type === 'entree').map((m) => m.quantite.times(m.prixUnitaire).toDecimalPlaces(2)));
        if (methode === 'cmp-periodique') return r.stockFinalQ.greaterThanOrEqualTo(0);
        return d(10000).plus(entrees).minus(r.coutSorties).equals(r.stockFinalV) && !r.stockFinalQ.isNegative();
      }),
      RUNS,
    );
  });
});

describe('Écritures générées', () => {
  test('toutes les écritures de tous les exemples sont équilibrées', () => {
    for (const f of toutesLesFormules())
      for (const ex of f.exemples) {
        const r = executerFormule(f, ex.entrees);
        for (const e of r.ecritures) {
          const dbt = somme(e.lignes.map((l) => l.debit ?? 0));
          const crd = somme(e.lignes.map((l) => l.credit ?? 0));
          expect({ formule: f.id, ecriture: e.libelle, ecart: dbt.minus(crd).toFixed(2) }).toEqual({ formule: f.id, ecriture: e.libelle, ecart: '0.00' });
        }
      }
  });
});

describe('Déterminisme', () => {
  test('Monte-Carlo : même graine → mêmes résultats, graine différente → résultats différents', () => {
    const a = executer('investissement', 'monte-carlo', { graine: 7, simulations: 300 });
    const b = executer('investissement', 'monte-carlo', { graine: 7, simulations: 300 });
    const c = executer('investissement', 'monte-carlo', { graine: 8, simulations: 300 });
    expect(a.resultats).toEqual(b.resultats);
    expect(a.resultats.vanMoyenne.valeur).not.toBe(c.resultats.vanMoyenne.valeur);
  });
  test('Monte-Carlo converge vers la VAN théorique', () => {
    const r = executer('investissement', 'monte-carlo', { simulations: 5000, graine: 1 });
    const ecart = d(r.resultats.vanMoyenne.valeur).minus(r.resultats.vanTheorique.valeur).abs();
    // 4 erreurs-types : σ / √n ≈ 31 500 / 70,7
    expect(ecart.lessThan(1800)).toBe(true);
  });
});

