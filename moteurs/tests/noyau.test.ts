import {
  ajouterMois,
  ajouterVersion,
  anciennete,
  arrondi,
  arrondiFiscal,
  bareme,
  estObsolete,
  d,
  ErreurCalcul,
  ErreurEntree,
  estDateIso,
  executer,
  fr,
  fp,
  joursFeries,
  jours30E360,
  joursFiscaux360,
  jourSemaine,
  normCdf,
  paques,
  obtenirBareme,
  resoudreBareme,
  resoudreSysteme,
  tri,
  van,
  annuiteConstante,
  quantileNormal,
  tauxEquivalent,
  obtenirFormule,
  catalogue,
} from '../src';

describe('Arithmétique et arrondis', () => {
  test('précision décimale exacte (0,1 + 0,2 = 0,3)', () => {
    expect(d('0.1').plus('0.2').toFixed()).toBe('0.3');
    expect(d('1e15').plus('0.01').toFixed()).toBe('1000000000000000.01');
  });
  test('virgule française et espaces de milliers acceptés', () => {
    expect(d('1 234,56').toFixed()).toBe('1234.56');
    expect(d('1 000,5').toFixed()).toBe('1000.5');
  });
  test.each([
    ['2.345', 'comptable', '2.35'],
    ['2.345', 'bancaire', '2.34'],
    ['2.355', 'bancaire', '2.36'],
    ['-2.345', 'comptable', '-2.35'],
    ['2.349', 'troncature', '2.34'],
    ['2.341', 'exces', '2.35'],
    ['-2.341', 'plancher', '-2.35'],
    ['-2.349', 'plafond', '-2.34'],
  ] as const)('arrondi(%s, %s) = %s', (v, mode, attendu) => {
    expect(arrondi(v, 2, mode).toFixed(2)).toBe(attendu);
  });
  test('arrondi fiscal à l’euro (CGI 1657)', () => {
    expect(arrondiFiscal('1234.49').toFixed()).toBe('1234');
    expect(arrondiFiscal('1234.50').toFixed()).toBe('1235');
    expect(arrondiFiscal('0').toFixed()).toBe('0');
  });
  test('formatage français', () => {
    // Groupement par espace insécable normale (U+00A0), visible dans les polices de l'interface.
    expect(fr('1234567.891')).toBe('1\u00a0234\u00a0567,89');
    expect(fr('-5')).toBe('−5,00');
    expect(fp('0.055')).toBe('5,5\u00a0%');
  });
});

describe('Dates', () => {
  test('validation ISO', () => {
    expect(estDateIso('2024-02-29')).toBe(true);
    expect(estDateIso('2023-02-29')).toBe(false);
    expect(estDateIso('2024-13-01')).toBe(false);
    expect(estDateIso('29/02/2024')).toBe(false);
  });
  test.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2000, '2000-04-23'],
    [2038, '2038-04-25'],
  ])('Pâques %i = %s', (a, attendu) => expect(paques(a)).toBe(attendu));
  test('11 jours fériés légaux, 13 en Alsace-Moselle', () => {
    expect(joursFeries(2025).size).toBe(11);
    expect(joursFeries(2025, true).size).toBe(13);
    expect(joursFeries(2025).get('2025-06-09')).toBe('Lundi de Pentecôte');
  });
  test('jour de la semaine', () => {
    expect(jourSemaine('2025-05-01')).toBe(4); // jeudi
    expect(jourSemaine('2024-02-29')).toBe(4);
  });
  test('ajout de mois en fin de mois et années bissextiles', () => {
    expect(ajouterMois('2024-01-31', 1)).toBe('2024-02-29');
    expect(ajouterMois('2023-01-31', 1)).toBe('2023-02-28');
    expect(ajouterMois('2024-02-29', 12)).toBe('2025-02-28');
    expect(ajouterMois('2024-11-15', -12)).toBe('2023-11-15');
  });
  test('convention 30/360 et prorata fiscal', () => {
    expect(jours30E360('2024-01-01', '2025-01-01')).toBe(360);
    expect(joursFiscaux360('2024-04-15', '2024-12-31')).toBe(256);
    expect(joursFiscaux360('2024-01-01', '2024-12-31')).toBe(360);
    expect(joursFiscaux360('2024-02-29', '2024-12-31')).toBe(302);
  });
  test('ancienneté', () => {
    expect(anciennete('2012-09-03', '2025-06-30')).toEqual({ annees: 12, mois: 9, jours: 27 });
    expect(anciennete('2024-01-31', '2024-03-01')).toEqual({ annees: 0, mois: 1, jours: 1 });
  });
  test('prorata temporis sur année bissextile (366 jours)', () => {
    const r = executer('base', 'prorata-temporis', { montantAnnuel: '36600', debut: '2024-01-01', fin: '2024-12-31', convention: 'exact' });
    expect(r.resultats.jours.valeur).toBe('366');
    expect(r.resultats.prorata.valeur).toBe('36600.00');
  });
});

describe('Primitives financières', () => {
  test('annuité constante de référence', () => {
    expect(annuiteConstante(100000, d('0.04').div(12), 60).toDecimalPlaces(2).toFixed(2)).toBe('1841.65');
    expect(annuiteConstante(1200, 0, 12).toFixed()).toBe('100');
  });
  test('VAN et TRI cohérents', () => {
    const flux = [-1000, 300, 400, 500];
    const r = tri(flux)!;
    expect(van(r, flux).abs().lessThan('1e-10')).toBe(true);
    expect(r.times(100).toDecimalPlaces(4).toFixed()).toBe('8.8963');
  });
  test('TRI introuvable si aucun changement de signe', () => {
    expect(tri([100, 200, 300])).toBeNull();
  });
  test('taux équivalent', () => {
    expect(tauxEquivalent('0.12682503', 12).toDecimalPlaces(6).toFixed()).toBe('0.01');
  });
  test('système linéaire', () => {
    const x = resoudreSysteme([[d(2), d(1)], [d(1), d(3)]], [d(5), d(10)]);
    expect(x.map((v) => v.toFixed())).toEqual(['1', '3']);
    expect(() => resoudreSysteme([[d(1), d(2)], [d(2), d(4)]], [d(1), d(2)])).toThrow(ErreurCalcul);
  });
  test('loi normale', () => {
    expect(normCdf(0).toFixed(6)).toBe('0.500000');
    expect(normCdf('1.959963985').toFixed(4)).toBe('0.9750');
    expect(quantileNormal(d('0.975')).toFixed(4)).toBe('1.9600');
    expect(quantileNormal(d('0.001')).toFixed(3)).toBe('-3.090');
  });
});

describe('Barèmes versionnés', () => {
  bareme<{ v: string }>({
    code: 'test.bareme',
    moteur: 'base',
    libelle: 'Barème de test',
    versions: [
      { du: '2020-01-01', valeurs: { v: 'A' }, source: 'test', statut: 'officiel' },
      { du: '2022-07-01', au: '2022-12-31', valeurs: { v: 'B' }, source: 'test', statut: 'a_verifier' },
      { du: '2023-01-01', valeurs: { v: 'C' }, source: 'test', statut: 'officiel' },
    ],
  });
  test('application selon la date de l’opération', () => {
    expect(resoudreBareme<{ v: string }>('test.bareme', '2021-05-05').version.valeurs.v).toBe('A');
    expect(resoudreBareme<{ v: string }>('test.bareme', '2022-08-01').version.valeurs.v).toBe('B');
    expect(resoudreBareme<{ v: string }>('test.bareme', '2023-01-01').version.valeurs.v).toBe('C');
  });
  test('alerte « à vérifier » et alerte d’obsolescence', () => {
    expect(resoudreBareme('test.bareme', '2022-08-01').controles.map((c) => c.code)).toContain('BAREME_A_VERIFIER');
    expect(resoudreBareme('test.bareme', '2023-06-01').controles).toEqual([]);
    expect(resoudreBareme('test.bareme', '2024-06-01').controles.map((c) => c.code)).toContain('BAREME_OBSOLETE');
  });
  test('un barème modifié seulement par un texte n’est pas signalé pour ancienneté', () => {
    bareme<{ v: string }>({
      code: 'test.sur-texte',
      moteur: 'base',
      libelle: 'Taux légal stable',
      revision: 'sur-texte',
      versions: [{ du: '2014-01-01', valeurs: { v: 'A' }, source: 'test', statut: 'officiel' }],
    });
    expect(resoudreBareme('test.sur-texte', '2030-06-01').controles).toEqual([]);
    expect(estObsolete(obtenirBareme('test.sur-texte'), '2030-06-01')).toBe(false);
    expect(estObsolete(obtenirBareme('test.bareme'), '2024-06-01')).toBe(true);
  });
  test('erreur avant la première version', () => {
    expect(() => resoudreBareme('test.bareme', '2019-12-31')).toThrow(ErreurCalcul);
  });
  test('ajout d’une version (mise à jour loi de finances)', () => {
    ajouterVersion('test.bareme', { du: '2025-01-01', valeurs: { v: 'D' }, source: 'LF 2025', statut: 'officiel' });
    expect(resoudreBareme<{ v: string }>('test.bareme', '2025-03-01').version.valeurs.v).toBe('D');
    expect(resoudreBareme<{ v: string }>('test.bareme', '2024-03-01').version.valeurs.v).toBe('C');
  });
  test('les barèmes utilisés sont tracés dans le résultat', () => {
    const r = executer('paie', 'bulletin', { dateOperation: '2024-06-30' });
    expect(r.baremes.map((b) => b.code)).toEqual(expect.arrayContaining(['paie.constantes', 'paie.cotisations']));
    expect(r.baremes.find((b) => b.code === 'paie.constantes')!.du).toBe('2024-01-01');
  });
});

describe('Validation des entrées', () => {
  test('champ obligatoire manquant', () => {
    expect(() => executer('base', 'variation', { initiale: '', finale: '' })).not.toThrow(); // valeurs par défaut
    try {
      executer('base', 'echeance-paiement', { dateFacture: 'pas une date' });
      throw new Error('attendu : ErreurEntree');
    } catch (e) {
      expect(e).toBeInstanceOf(ErreurEntree);
      expect((e as ErreurEntree).erreurs[0]).toEqual({ champ: 'dateFacture', message: 'date AAAA-MM-JJ attendue' });
    }
  });
  test('nombre invalide, bornes et choix non autorisé', () => {
    expect(() => executer('tva', 'ht-ttc', { montant: 'abc' })).toThrow(ErreurEntree);
    expect(() => executer('tva', 'ht-ttc', { taux: '150' })).toThrow(/≤ 100/);
    expect(() => executer('tva', 'ht-ttc', { depuis: 'XYZ' })).toThrow(/non autorisée/);
  });
  test('erreurs dans une table : chemin de la ligne', () => {
    try {
      executer('base', 'equilibre-debit-credit', { lignes: [{ compte: '411', debit: 'x' }] });
    } catch (e) {
      expect((e as ErreurEntree).erreurs[0].champ).toBe('lignes[1].debit');
    }
  });
  test('les taux saisis en pourcentage sont normalisés', () => {
    const r = executer('tva', 'ht-ttc', { montant: '100', taux: '5,5' });
    expect(r.entrees.taux).toBe('5.5');
    expect(r.resultats.tva.valeur).toBe('5.50');
  });
  test('champ conditionnel ignoré quand il n’est pas visible', () => {
    const r = executer('base', 'arrondi', { valeur: '10.5', mode: 'fiscal', decimales: 'n’importe quoi' });
    expect(r.resultats.resultat.valeur).toBe('11');
  });
});

describe('Valeurs limites', () => {
  test('montants nuls', () => {
    expect(executer('tva', 'ht-ttc', { montant: '0' }).resultats.ttc.valeur).toBe('0.00');
    expect(executer('base', 'variation', { initiale: '0', finale: '10' }).controles.map((c) => c.code)).toContain('BASE_NULLE');
  });
  test('montants négatifs (avoirs)', () => {
    const r = executer('tva', 'ht-ttc', { montant: '-1000' });
    expect(r.resultats.tva.valeur).toBe('-200.00');
    expect(r.resultats.ttc.valeur).toBe('-1200.00');
  });
  test('très grands nombres (10^15 €)', () => {
    const r = executer('tva', 'ht-ttc', { montant: '1000000000000000.01' });
    expect(r.resultats.ttc.valeur).toBe('1200000000000000.01');
    const ca3 = executer('fiscal', 'impot-societes', { resultatFiscal: '999999999999', ca: '5000000000000', conditionsCapital: false });
    expect(ca3.resultats.isBrut.valeur).toBe('250000000000');
  });
  test('division par zéro signalée, jamais d’exception', () => {
    expect(executer('base', 'regle-de-trois', { a: '0' }).controles.map((c) => c.code)).toContain('DIVISION_ZERO');
    expect(executer('analytique', 'seuil-rentabilite', { chargesVariables: '1200000' }).controles.map((c) => c.code)).toContain('MCV_NEGATIVE');
  });
});

describe('Catalogue', () => {
  test('identifiants uniques et descriptions complètes', () => {
    const cat = catalogue();
    expect(cat).toHaveLength(13);
    const ids = cat.flatMap((m) => m.formules.map((f) => `${m.code}/${f.id}`));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(160);
    for (const m of cat) for (const f of m.formules) expect(f.champs.length).toBeGreaterThan(0);
  });
  test('formule inconnue', () => {
    expect(obtenirFormule('tva', 'inexistante')).toBeUndefined();
    expect(() => executer('tva', 'inexistante', {})).toThrow(/inconnue/);
  });
});
