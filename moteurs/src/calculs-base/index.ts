/**
 * MOTEUR 1 — Calculs de base : arithmétique comptable, arrondis, pourcentages,
 * moyennes, devises, dates et échéances, contrôles d'équilibre et de doublons.
 */
import {
  ajouterJours,
  ajouterMois,
  arrondi,
  booleen,
  centile,
  choix,
  compterJours,
  d,
  date,
  Decimal,
  diviser,
  ecartType,
  entier,
  estOuvrable,
  estOuvre,
  euros,
  fd,
  fe,
  finDeMois,
  formule,
  fp,
  fr,
  frn,
  joursEntre,
  jours30E360,
  joursDansAnnee,
  joursFeries,
  liste,
  ModeArrondi,
  montant,
  moyenne,
  nombre,
  parts,
  pct,
  somme,
  table,
  taux,
  texte,
  UN,
  ZERO,
  iso,
  comparer,
  numJour,
} from '../noyau';

const M = 'base' as const;

// ───────────────────────────── Arrondis ─────────────────────────────

export const arrondiComptable = formule({
  id: 'arrondi',
  moteur: M,
  nom: 'Arrondi comptable et fiscal',
  categorie: 'Arithmétique',
  description: "Arrondit une valeur selon les règles comptables (au centime), fiscales (à l'euro) ou bancaires, et mesure l'écart d'arrondi.",
  expression: 'arrondi(x, n) ; fiscal : fraction < 0,50 € négligée, ≥ 0,50 € comptée pour 1 €',
  references: [
    { texte: 'CGI art. 1657, 1-a — arrondi des bases et cotisations à l’euro le plus proche' },
    { texte: 'Règlement ANC 2014-03, art. 911-1 (tenue en euros et centimes)' },
  ],
  champs: [
    nombre('valeur', 'Valeur à arrondir', { defaut: '1234.5678' }),
    choix('mode', "Règle d'arrondi", [
      ['comptable', 'Comptable — au plus proche (0,5 → haut)'],
      ['fiscal', "Fiscal — à l'euro (CGI 1657)"],
      ['bancaire', 'Bancaire — au pair le plus proche'],
      ['troncature', 'Troncature'],
      ['exces', 'Par excès'],
    ]),
    entier('decimales', 'Décimales', { defaut: 2, min: '0', max: '10', visibleSi: { champ: 'mode', valeurs: ['comptable', 'bancaire', 'troncature', 'exces'] } }),
  ],
  exemples: [
    { titre: 'Centime', entrees: { valeur: '1234.565', mode: 'comptable', decimales: 2 }, attendu: { resultat: '1234.57' } },
    { titre: 'Fiscal', entrees: { valeur: '1234.50', mode: 'fiscal' }, attendu: { resultat: '1235' } },
    { titre: 'Bancaire', entrees: { valeur: '2.345', mode: 'bancaire', decimales: 2 }, attendu: { resultat: '2.34' } },
  ],
  calculer(e, c) {
    const fiscal = e.mode === 'fiscal';
    const n = fiscal ? 0 : (e.decimales as number);
    const r = arrondi(e.valeur, n, fiscal ? 'comptable' : (e.mode as ModeArrondi));
    c.etape('Valeur arrondie', `arrondi${fiscal ? 'Fiscal' : ''}(${frn(e.valeur, 12)} ; ${n} déc.)`, r);
    c.res('resultat', 'Valeur arrondie', r, 'nombre', { principal: true, decimales: n });
    c.calc('ecart', "Écart d'arrondi", `${frn(r, 12)} − ${frn(e.valeur, 12)}`, r.minus(e.valeur), 'nombre');
  },
});

export const equilibreDebitCredit = formule({
  id: 'equilibre-debit-credit',
  moteur: M,
  nom: 'Équilibre débit / crédit',
  categorie: 'Contrôles',
  description: "Totalise une écriture ou un journal, vérifie l'équilibre à 0,01 € près et propose l'écart d'arrondi à passer.",
  expression: 'Σ Débits − Σ Crédits = 0 (tolérance 0,01 €)',
  references: [
    { texte: 'Code de commerce art. L.123-12 et R.123-173 (partie double)' },
    { texte: 'PCG art. 420-1 et suivants' },
  ],
  champs: [
    table(
      'lignes',
      'Lignes',
      [
        { nom: 'compte', libelle: 'Compte', type: 'texte' },
        montant('debit', 'Débit', { optionnel: true }),
        montant('credit', 'Crédit', { optionnel: true }),
      ],
      {
        min: '1',
        defaut: [
          { compte: '607000', debit: '1000.00' },
          { compte: '445660', debit: '200.00' },
          { compte: '401000', credit: '1200.00' },
        ],
      },
    ),
    montant('tolerance', 'Tolérance', { defaut: '0.01', min: '0' }),
  ],
  exemples: [
    {
      titre: 'Facture équilibrée',
      entrees: {},
      attendu: { totalDebit: '1200.00', totalCredit: '1200.00', ecart: '0.00', equilibre: 'oui' },
    },
    {
      titre: 'Écart de 1 centime',
      entrees: { lignes: [{ compte: '411', debit: '100.01' }, { compte: '706', credit: '100.00' }] },
      attendu: { ecart: '0.01', equilibre: 'oui' },
    },
  ],
  calculer(e, c) {
    const lignes = e.lignes as { compte: string; debit?: Decimal; credit?: Decimal }[];
    const td = c.calc('totalDebit', 'Total débit', 'Σ débits', somme(lignes.map((l) => l.debit ?? 0)));
    const tc = c.calc('totalCredit', 'Total crédit', 'Σ crédits', somme(lignes.map((l) => l.credit ?? 0)));
    const ecart = c.calc('ecart', 'Écart', 'Σ débits − Σ crédits', td.minus(tc), 'EUR', { principal: true });
    const ok = ecart.abs().lessThanOrEqualTo(e.tolerance);
    c.res('equilibre', 'Équilibrée', ok, 'booleen');
    lignes.forEach((l, i) => {
      if (l.debit && l.credit && !l.debit.isZero() && !l.credit.isZero())
        c.ctrl('avertissement', 'LIGNE_MIXTE', `Ligne ${i + 1} : débit et crédit renseignés simultanément.`);
      if (!/^\d{3,}/.test(l.compte)) c.ctrl('avertissement', 'COMPTE_INVALIDE', `Ligne ${i + 1} : numéro de compte « ${l.compte} » non conforme au PCG.`);
    });
    if (ecart.isZero()) c.ctrl('ok', 'EQUILIBRE', 'Écriture équilibrée.');
    else if (ok)
      c.ctrl('info', 'ECART_ARRONDI', `Écart d'arrondi de ${fe(ecart.abs())} : à solder en ${ecart.greaterThan(0) ? '758 (produit)' : '658 (charge)'} de gestion courante.`);
    else c.ctrl('erreur', 'DESEQUILIBRE', `Écriture déséquilibrée de ${fe(ecart)} (au-delà de la tolérance de ${fe(e.tolerance)}).`);
  },
});

// ─────────────────────────── Pourcentages ───────────────────────────

export const variation = formule({
  id: 'variation',
  moteur: M,
  nom: 'Variation, écart et coefficient multiplicateur',
  categorie: 'Pourcentages',
  description: "Calcule l'écart absolu, la variation en pourcentage, le coefficient multiplicateur et la variation réciproque entre deux valeurs.",
  expression: 'Variation = (Vf − Vi) / |Vi| ; CM = Vf / Vi ; réciproque = Vi / Vf − 1',
  references: [{ texte: 'Mathématiques financières — taux de variation' }],
  champs: [nombre('initiale', 'Valeur initiale', { defaut: '80000' }), nombre('finale', 'Valeur finale', { defaut: '92000' })],
  exemples: [
    { titre: 'Hausse de CA', entrees: {}, attendu: { ecart: '12000', variation: '15.00', coefficient: '1.150000', reciproque: '-13.04' } },
  ],
  calculer(e, c) {
    const vi: Decimal = e.initiale;
    const vf: Decimal = e.finale;
    c.calc('ecart', 'Écart absolu', `${fr(vf)} − ${fr(vi)}`, vf.minus(vi), 'nombre');
    if (vi.isZero()) {
      c.ctrl('erreur', 'BASE_NULLE', 'Valeur initiale nulle : variation en pourcentage non définie.');
      return;
    }
    const v = vf.minus(vi).div(vi.abs());
    c.calc('variation', 'Variation relative', `(${fr(vf)} − ${fr(vi)}) / |${fr(vi)}|`, v, '%', { principal: true });
    c.calc('coefficient', 'Coefficient multiplicateur', `${fr(vf)} / ${fr(vi)}`, vf.div(vi), 'nombre', { decimales: 6 });
    if (!vf.isZero()) c.calc('reciproque', 'Variation réciproque (retour à la valeur initiale)', `${fr(vi)} / ${fr(vf)} − 1`, vi.div(vf).minus(1), '%');
  },
});

export const appliquerPourcentage = formule({
  id: 'appliquer-pourcentage',
  moteur: M,
  nom: 'Augmentation / diminution en pourcentage',
  categorie: 'Pourcentages',
  description: "Applique une hausse ou une baisse en pourcentage, ou retrouve la valeur d'origine à partir de la valeur finale.",
  expression: 'Vf = Vi × (1 ± t) ; Vi = Vf / (1 ± t)',
  references: [{ texte: 'Mathématiques financières — coefficient multiplicateur' }],
  champs: [
    montant('valeur', 'Valeur', { defaut: '1500' }),
    taux('taux', 'Pourcentage', { defaut: '12' }),
    choix('sens', 'Opération', [
      ['augmentation', 'Augmenter de t %'],
      ['diminution', 'Diminuer de t %'],
      ['origine-augmentation', "Retrouver la valeur avant une hausse de t %"],
      ['origine-diminution', 'Retrouver la valeur avant une baisse de t %'],
    ]),
  ],
  exemples: [
    { titre: 'Hausse de 12 %', entrees: {}, attendu: { resultat: '1680.00', difference: '180.00' } },
    { titre: 'Remise de 20 %', entrees: { valeur: '250', taux: '20', sens: 'diminution' }, attendu: { resultat: '200.00' } },
    { titre: 'Prix avant hausse', entrees: { valeur: '1680', taux: '12', sens: 'origine-augmentation' }, attendu: { resultat: '1500.00' } },
  ],
  calculer(e, c) {
    const t: Decimal = e.taux;
    const coef = e.sens.endsWith('augmentation') ? UN.plus(t) : UN.minus(t);
    c.etape('Coefficient multiplicateur', `1 ${e.sens.endsWith('augmentation') ? '+' : '−'} ${fp(t)}`, coef, 'nombre');
    const origine = e.sens.startsWith('origine');
    if (origine && coef.isZero()) {
      c.ctrl('erreur', 'COEF_NUL', 'Baisse de 100 % : valeur d’origine indéterminée.');
      return;
    }
    const r = euros(origine ? d(e.valeur).div(coef) : d(e.valeur).times(coef));
    c.calc('resultat', origine ? "Valeur d'origine" : 'Valeur finale', origine ? `${fr(e.valeur)} / ${frn(coef)}` : `${fr(e.valeur)} × ${frn(coef)}`, r, 'EUR', { principal: true });
    c.calc('difference', 'Différence', 'résultat − valeur', r.minus(e.valeur).abs());
  },
});

export const partTotal = formule({
  id: 'part-total',
  moteur: M,
  nom: 'Part dans un total (ratio simple)',
  categorie: 'Pourcentages',
  description: "Calcule la part relative d'éléments dans un total et contrôle que la somme des parts n'excède pas le total.",
  expression: 'Part = élément / total',
  references: [{ texte: 'Analyse financière — ratios de structure' }],
  champs: [
    montant('total', 'Total', { defaut: '250000' }),
    table('elements', 'Éléments', [{ nom: 'libelle', libelle: 'Libellé', type: 'texte' }, montant('montant', 'Montant')], {
      min: '1',
      defaut: [
        { libelle: 'Produit A', montant: '120000' },
        { libelle: 'Produit B', montant: '80000' },
        { libelle: 'Produit C', montant: '50000' },
      ],
    }),
  ],
  exemples: [{ titre: 'Mix produits', entrees: {}, attendu: { part_1: '48.00', part_2: '32.00', part_3: '20.00', reste: '0.00' } }],
  calculer(e, c) {
    const total: Decimal = e.total;
    if (total.isZero()) {
      c.ctrl('erreur', 'TOTAL_NUL', 'Total nul : parts non définies.');
      return;
    }
    const lignes: Record<string, string>[] = [];
    (e.elements as { libelle: string; montant: Decimal }[]).forEach((el, i) => {
      const p = el.montant.div(total);
      c.calc(`part_${i + 1}`, `Part — ${el.libelle}`, `${fr(el.montant)} / ${fr(total)}`, p, '%');
      lignes.push({ libelle: el.libelle, montant: el.montant.toFixed(2), part: p.times(100).toFixed(2) });
    });
    const s = somme((e.elements as { montant: Decimal }[]).map((x) => x.montant));
    c.calc('reste', 'Non affecté', `${fr(total)} − Σ éléments`, total.minus(s));
    c.verifier(s.lessThanOrEqualTo(total), 'SOMME_PARTS', 'La somme des éléments ne dépasse pas le total.', 'La somme des éléments dépasse le total.');
    c.tableau({
      titre: 'Répartition',
      colonnes: [
        { cle: 'libelle', libelle: 'Élément', unite: 'texte' },
        { cle: 'montant', libelle: 'Montant', unite: 'EUR' },
        { cle: 'part', libelle: 'Part', unite: '%' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'libelle', series: ['montant'] },
    });
  },
});

export const regleDeTrois = formule({
  id: 'regle-de-trois',
  moteur: M,
  nom: 'Règle de trois (proportionnalité)',
  categorie: 'Pourcentages',
  description: 'Résout x dans la proportion a / b = c / x (directe) ou a × b = c × x (inverse).',
  expression: 'Directe : x = b × c / a ; inverse : x = a × b / c',
  references: [{ texte: 'Proportionnalité — produit en croix' }],
  champs: [
    nombre('a', 'a (référence)', { defaut: '3' }),
    nombre('b', 'b (valeur pour a)', { defaut: '45' }),
    nombre('c', 'c (nouvelle référence)', { defaut: '7' }),
    choix('sens', 'Proportionnalité', [
      ['directe', 'Directe (a → b ; c → x)'],
      ['inverse', 'Inverse (a × b = c × x)'],
    ]),
  ],
  exemples: [
    { titre: '3 kg → 45 € ; 7 kg ?', entrees: {}, attendu: { x: '105' } },
    { titre: '4 ouvriers 15 j ; 6 ouvriers ?', entrees: { a: '4', b: '15', c: '6', sens: 'inverse' }, attendu: { x: '10' } },
  ],
  calculer(e, c) {
    const directe = e.sens === 'directe';
    const den: Decimal = directe ? e.a : e.c;
    if (den.isZero()) {
      c.ctrl('erreur', 'DIVISION_ZERO', 'Diviseur nul.');
      return;
    }
    const x = directe ? d(e.b).times(e.c).div(e.a) : d(e.a).times(e.b).div(e.c);
    c.calc('x', 'x', directe ? `${frn(e.b)} × ${frn(e.c)} / ${frn(e.a)}` : `${frn(e.a)} × ${frn(e.b)} / ${frn(e.c)}`, x, 'nombre', { principal: true });
  },
});

export const repartitionProportionnelle = formule({
  id: 'repartition-proportionnelle',
  moteur: M,
  nom: 'Répartition proportionnelle au centime près',
  categorie: 'Arithmétique',
  description:
    "Répartit un montant selon des clés, arrondit chaque part au centime et affecte le reliquat d'arrondi par la méthode du plus fort reste : la somme des parts est toujours exactement égale au total.",
  expression: 'Part_i = Total × clé_i / Σ clés ; reliquat affecté aux plus forts restes',
  references: [{ texte: 'Méthode du plus fort reste (Hamilton)' }],
  champs: [
    montant('total', 'Montant à répartir', { defaut: '1000' }),
    table('cles', 'Clés de répartition', [{ nom: 'libelle', libelle: 'Bénéficiaire', type: 'texte' }, nombre('cle', 'Clé', { min: '0' })], {
      min: '1',
      defaut: [
        { libelle: 'Atelier', cle: '1' },
        { libelle: 'Bureau', cle: '1' },
        { libelle: 'Entrepôt', cle: '1' },
      ],
    }),
  ],
  exemples: [{ titre: '1 000 € en trois tiers', entrees: {}, attendu: { part_1: '333.34', part_2: '333.33', part_3: '333.33', controle: '0.00' } }],
  calculer(e, c) {
    const cles = e.cles as { libelle: string; cle: Decimal }[];
    const sc = somme(cles.map((x) => x.cle));
    if (sc.isZero()) {
      c.ctrl('erreur', 'CLES_NULLES', 'La somme des clés est nulle.');
      return;
    }
    const total: Decimal = e.total;
    const exactes = cles.map((x) => total.times(x.cle).div(sc));
    const parts_ = exactes.map((x) => arrondi(x, 2, 'troncature'));
    let reliquat = total.minus(somme(parts_)).times(100).round().toNumber();
    const ordre = exactes
      .map((x, i) => ({ i, reste: x.minus(parts_[i]) }))
      .sort((a, b) => b.reste.comparedTo(a.reste) || a.i - b.i);
    const sensReliquat = reliquat >= 0 ? 1 : -1;
    for (let k = 0; reliquat !== 0; k = (k + 1) % ordre.length) {
      parts_[ordre[k].i] = parts_[ordre[k].i].plus(d('0.01').times(sensReliquat));
      reliquat -= sensReliquat;
    }
    const lignes = cles.map((x, i) => {
      c.calc(`part_${i + 1}`, `Part — ${x.libelle}`, `${fr(total)} × ${frn(x.cle)} / ${frn(sc)}`, parts_[i]);
      return { libelle: x.libelle, cle: x.cle.toFixed(), exacte: exactes[i].toDecimalPlaces(6).toFixed(), part: parts_[i].toFixed(2) };
    });
    const ctrl = total.minus(somme(parts_));
    c.calc('controle', 'Total − Σ parts', `${fr(total)} − ${fr(somme(parts_))}`, ctrl);
    c.verifier(ctrl.isZero(), 'REPARTITION_EXACTE', 'La somme des parts égale exactement le total.', 'Écart résiduel de répartition.');
    c.tableau({
      titre: 'Répartition',
      colonnes: [
        { cle: 'libelle', libelle: 'Bénéficiaire', unite: 'texte' },
        { cle: 'cle', libelle: 'Clé', unite: 'nombre' },
        { cle: 'exacte', libelle: 'Part exacte', unite: 'nombre' },
        { cle: 'part', libelle: 'Part arrondie', unite: 'EUR' },
      ],
      lignes,
    });
  },
});

// ───────────────────────────── Moyennes ─────────────────────────────

export const statistiquesSerie = formule({
  id: 'moyenne-simple',
  moteur: M,
  nom: 'Moyenne simple et dispersion',
  categorie: 'Moyennes',
  description: "Moyenne arithmétique, médiane, minimum, maximum, étendue et écart-type d'une série.",
  expression: 'x̄ = Σ xi / n ; σ = √(Σ (xi − x̄)² / n)',
  references: [{ texte: 'Statistique descriptive' }],
  champs: [liste('valeurs', 'Valeurs', { min: '1', defaut: ['12500', '13800', '11900', '14600', '15200', '13100'] })],
  exemples: [{ titre: 'CA mensuel', entrees: {}, attendu: { moyenne: '13516.67', mediane: '13450.00', etendue: '3300.00' } }],
  calculer(e, c) {
    const v = e.valeurs as Decimal[];
    const s = somme(v);
    c.calc('somme', 'Somme', 'Σ xi', s, 'nombre', { decimales: 2 });
    c.calc('moyenne', 'Moyenne', `${fr(s)} / ${v.length}`, s.div(v.length), 'nombre', { principal: true, decimales: 2 });
    c.calc('mediane', 'Médiane', 'valeur centrale de la série triée', centile(v, '0.5'), 'nombre', { decimales: 2 });
    const mn = v.reduce((a, b) => (b.lessThan(a) ? b : a));
    const mx = v.reduce((a, b) => (b.greaterThan(a) ? b : a));
    c.res('min', 'Minimum', mn, 'nombre', { decimales: 2 });
    c.res('max', 'Maximum', mx, 'nombre', { decimales: 2 });
    c.calc('etendue', 'Étendue', 'max − min', mx.minus(mn), 'nombre', { decimales: 2 });
    const et = ecartType(v);
    c.calc('ecartType', 'Écart-type (population)', '√(Σ(xi − x̄)² / n)', et, 'nombre', { decimales: 4 });
    if (!s.isZero()) c.calc('cv', 'Coefficient de variation', 'σ / x̄', et.div(s.div(v.length)).abs(), '%');
  },
});

export const moyennePonderee = formule({
  id: 'moyenne-ponderee',
  moteur: M,
  nom: 'Moyenne pondérée',
  categorie: 'Moyennes',
  description: 'Moyenne de valeurs pondérées par des coefficients (quantités, durées, encours…).',
  expression: 'x̄p = Σ (xi × pi) / Σ pi',
  references: [{ texte: 'Statistique descriptive — moyenne pondérée' }],
  champs: [
    table('valeurs', 'Valeurs et poids', [nombre('valeur', 'Valeur'), nombre('poids', 'Poids', { min: '0' })], {
      min: '1',
      defaut: [
        { valeur: '4.20', poids: '300' },
        { valeur: '4.50', poids: '500' },
        { valeur: '4.05', poids: '200' },
      ],
    }),
  ],
  exemples: [{ titre: 'Prix moyen pondéré', entrees: {}, attendu: { moyenne: '4.320000', sommePoids: '1000' } }],
  calculer(e, c) {
    const v = e.valeurs as { valeur: Decimal; poids: Decimal }[];
    const sp = c.calc('sommePoids', 'Σ poids', 'Σ pi', somme(v.map((x) => x.poids)), 'nombre');
    const sxp = c.calc('sommeProduits', 'Σ valeur × poids', 'Σ xi × pi', somme(v.map((x) => x.valeur.times(x.poids))), 'nombre');
    if (sp.isZero()) {
      c.ctrl('erreur', 'POIDS_NULS', 'Somme des poids nulle.');
      return;
    }
    c.calc('moyenne', 'Moyenne pondérée', `${frn(sxp)} / ${frn(sp)}`, sxp.div(sp), 'nombre', { principal: true, decimales: 6 });
  },
});

export const moyenneMobile = formule({
  id: 'moyenne-mobile',
  moteur: M,
  nom: 'Moyenne mobile',
  categorie: 'Moyennes',
  description: "Lissage d'une série par moyenne mobile simple sur k périodes (tendance des ventes, saisonnalité).",
  expression: 'MMk(t) = (x(t) + … + x(t − k + 1)) / k',
  references: [{ texte: 'Analyse des séries chronologiques' }],
  champs: [
    liste('valeurs', 'Série', { min: '2', defaut: ['100', '120', '90', '130', '150', '110', '170', '160'] }),
    entier('periode', 'Nombre de périodes k', { defaut: 3, min: '2' }),
  ],
  exemples: [{ titre: 'MM3', entrees: {}, attendu: { derniere: '146.67' } }],
  calculer(e, c) {
    const v = e.valeurs as Decimal[];
    const k = e.periode as number;
    if (k > v.length) {
      c.ctrl('erreur', 'PERIODE_TROP_LONGUE', `La période (${k}) dépasse la longueur de la série (${v.length}).`);
      return;
    }
    const lignes: Record<string, string>[] = [];
    let derniere = ZERO;
    v.forEach((x, t) => {
      const ligne: Record<string, string> = { t: String(t + 1), valeur: x.toFixed() };
      if (t >= k - 1) {
        derniere = somme(v.slice(t - k + 1, t + 1)).div(k);
        ligne.mm = derniere.toFixed(2);
      }
      lignes.push(ligne);
    });
    c.calc('derniere', `Dernière moyenne mobile (${k})`, `Σ ${k} dernières valeurs / ${k}`, derniere, 'nombre', { principal: true, decimales: 2 });
    c.tableau({
      titre: 'Série lissée',
      colonnes: [
        { cle: 't', libelle: 'Période', unite: 'entier' },
        { cle: 'valeur', libelle: 'Valeur', unite: 'nombre' },
        { cle: 'mm', libelle: `MM${k}`, unite: 'nombre' },
      ],
      lignes,
      graphique: { type: 'lignes', x: 't', series: ['valeur', 'mm'] },
    });
  },
});

// ───────────────────────────── Devises ─────────────────────────────

export const conversionDevise = formule({
  id: 'conversion-devise',
  moteur: M,
  nom: 'Conversion de devises',
  categorie: 'Devises',
  description:
    "Convertit un montant entre l'euro et une devise au cours du jour, historique ou moyen de la période ; calcule le cours moyen si une série de cours est fournie.",
  expression: 'Montant € = Montant devise × cours (1 devise = x €) ; cours moyen = Σ cours / n',
  references: [
    { texte: 'PCG art. 420-5 — conversion au cours du jour de l’opération' },
    { texte: 'PCG art. 420-6 — cours moyen admis s’il est représentatif' },
  ],
  champs: [
    montant('montant', 'Montant à convertir', { defaut: '15000', unite: '' }),
    choix('sens', 'Sens', [
      ['vers-euro', 'Devise → euro'],
      ['depuis-euro', 'Euro → devise'],
    ]),
    { nom: 'codeDevise', libelle: 'Code devise (ISO 4217)', type: 'texte', defaut: 'USD' },
    choix('typeCours', 'Cours appliqué', [
      ['jour', 'Cours du jour de l’opération'],
      ['historique', 'Cours historique'],
      ['moyen', 'Cours moyen de la période'],
    ]),
    nombre('cours', '1 devise = … €', { defaut: '0.9235', min: '0', visibleSi: { champ: 'typeCours', valeurs: ['jour', 'historique'] } }),
    liste('coursPeriode', 'Cours de la période (1 devise = … €)', { min: '1', defaut: ['0.9210', '0.9255', '0.9198', '0.9301'], visibleSi: { champ: 'typeCours', valeurs: ['moyen'] } }),
  ],
  exemples: [
    { titre: '15 000 USD en euros', entrees: {}, attendu: { converti: '13852.50' } },
    { titre: 'Cours moyen', entrees: { typeCours: 'moyen' }, attendu: { cours: '0.924100', converti: '13861.50' } },
  ],
  calculer(e, c) {
    let cours: Decimal;
    if (e.typeCours === 'moyen') {
      const cs = e.coursPeriode as Decimal[];
      cours = c.etape('Cours moyen de la période', `Σ ${cs.length} cours / ${cs.length}`, somme(cs).div(cs.length), 'nombre');
    } else cours = e.cours;
    if (cours.isZero()) {
      c.ctrl('erreur', 'COURS_NUL', 'Cours nul.');
      return;
    }
    c.res('cours', 'Cours appliqué (1 devise = … €)', cours, 'nombre', { decimales: 6 });
    const versEuro = e.sens === 'vers-euro';
    const r = euros(versEuro ? d(e.montant).times(cours) : d(e.montant).div(cours));
    c.calc(
      'converti',
      versEuro ? 'Montant en euros' : `Montant en ${e.codeDevise}`,
      versEuro ? `${fr(e.montant)} ${e.codeDevise} × ${frn(cours)}` : `${fr(e.montant)} € / ${frn(cours)}`,
      r,
      versEuro ? 'EUR' : 'devise',
      { principal: true },
    );
    c.calc('coursInverse', `1 € = … ${e.codeDevise}`, `1 / ${frn(cours)}`, UN.div(cours), 'nombre', { decimales: 6 });
  },
});

export const ecartDeChange = formule({
  id: 'ecart-de-change',
  moteur: M,
  nom: 'Différence de change réalisée',
  categorie: 'Devises',
  description: 'Gain ou perte de change constaté au règlement d’une créance ou d’une dette en devise, avec écriture.',
  expression: 'Écart = Montant devise × (cours règlement − cours origine) (signe inversé pour une dette)',
  references: [
    { texte: 'PCG art. 420-7 — différences de change réalisées en résultat financier (666 / 766)' },
    { texte: 'PCG art. 946-66 et 947-76' },
  ],
  champs: [
    montant('montantDevise', 'Montant en devise', { defaut: '10000', unite: '' }),
    nombre('coursOrigine', "Cours à l'origine (1 devise = … €)", { defaut: '0.92', min: '0' }),
    nombre('coursReglement', 'Cours au règlement', { defaut: '0.95', min: '0' }),
    choix('nature', 'Nature', [
      ['creance', 'Créance client'],
      ['dette', 'Dette fournisseur'],
    ]),
  ],
  exemples: [
    { titre: 'Créance — gain', entrees: {}, attendu: { ecart: '300.00', valeurOrigine: '9200.00', valeurReglement: '9500.00' } },
    { titre: 'Dette — perte', entrees: { nature: 'dette' }, attendu: { ecart: '-300.00' } },
  ],
  calculer(e, c) {
    const vo = c.calc('valeurOrigine', "Valeur à l'origine", `${fr(e.montantDevise)} × ${frn(e.coursOrigine)}`, euros(d(e.montantDevise).times(e.coursOrigine)));
    const vr = c.calc('valeurReglement', 'Valeur au règlement', `${fr(e.montantDevise)} × ${frn(e.coursReglement)}`, euros(d(e.montantDevise).times(e.coursReglement)));
    const creance = e.nature === 'creance';
    const ecart = creance ? vr.minus(vo) : vo.minus(vr);
    c.calc('ecart', ecart.isNegative() ? 'Perte de change' : 'Gain de change', creance ? 'valeur règlement − valeur origine' : 'valeur origine − valeur règlement', ecart, 'EUR', { principal: true });
    const gain = ecart.greaterThan(0);
    if (creance)
      c.ecriture('Encaissement de la créance en devise', [
        { compte: '512', intitule: 'Banque', debit: vr },
        { compte: gain ? '766' : '666', intitule: gain ? 'Gains de change' : 'Pertes de change', debit: gain ? 0 : ecart.neg(), credit: gain ? ecart : 0 },
        { compte: '411', intitule: 'Clients', credit: vo },
      ], 'BQ');
    else
      c.ecriture('Règlement de la dette en devise', [
        { compte: '401', intitule: 'Fournisseurs', debit: vo },
        { compte: gain ? '766' : '666', intitule: gain ? 'Gains de change' : 'Pertes de change', debit: gain ? 0 : ecart.neg(), credit: gain ? ecart : 0 },
        { compte: '512', intitule: 'Banque', credit: vr },
      ], 'BQ');
  },
});

// ───────────────────────────── Dates ─────────────────────────────

export const echeancePaiement = formule({
  id: 'echeance-paiement',
  moteur: M,
  nom: "Date d'échéance et délai légal de paiement",
  categorie: 'Dates',
  description:
    "Calcule la date d'échéance d'une facture selon la condition de paiement et contrôle le respect des délais maximaux (60 jours date de facture ou 45 jours fin de mois).",
  expression: 'Net : date + n j ; fin de mois : FDM(date + n j) ; 45 j FDM : FDM(date) + 45 j',
  references: [
    { texte: 'Code de commerce art. L.441-10 I — délais maximaux de paiement' },
    { texte: 'Code de commerce art. L.441-11 — transport, 30 jours' },
  ],
  champs: [
    date('dateFacture', 'Date de facture', { defaut: '2025-03-14' }),
    choix('condition', 'Condition de paiement', [
      ['net', 'Net à n jours'],
      ['fin-de-mois', 'n jours fin de mois (fin de mois après n jours)'],
      ['fdm-plus', 'Fin de mois + n jours'],
      ['fdm-le', 'n jours fin de mois le X'],
    ]),
    entier('jours', 'Nombre de jours n', { defaut: 45, min: '0', max: '365' }),
    entier('jourDuMois', 'Jour X du mois suivant', { defaut: 10, min: '1', max: '31', visibleSi: { champ: 'condition', valeurs: ['fdm-le'] } }),
  ],
  exemples: [
    { titre: '45 jours fin de mois', entrees: { condition: 'fin-de-mois' }, attendu: { echeance: '2025-04-30', delaiJours: '47' } },
    { titre: 'Net 30', entrees: { condition: 'net', jours: 30 }, attendu: { echeance: '2025-04-13' } },
    { titre: 'FDM + 45', entrees: { condition: 'fdm-plus', jours: 45 }, attendu: { echeance: '2025-05-15' } },
  ],
  calculer(e, c) {
    const df: string = e.dateFacture;
    const n: number = e.jours;
    let ech: string;
    switch (e.condition) {
      case 'net':
        ech = c.etape('Échéance', `${fd(df)} + ${n} j`, ajouterJours(df, n));
        break;
      case 'fin-de-mois':
        ech = c.etape('Échéance', `fin du mois de (${fd(df)} + ${n} j)`, finDeMois(ajouterJours(df, n)));
        break;
      case 'fdm-plus':
        ech = c.etape('Échéance', `fin de mois (${fd(finDeMois(df))}) + ${n} j`, ajouterJours(finDeMois(df), n));
        break;
      default: {
        const base = finDeMois(ajouterJours(df, n));
        const p = parts(ajouterMois(base, 1));
        const j = Math.min(e.jourDuMois, parts(finDeMois(iso(p.a, p.m, 1))).j);
        ech = c.etape('Échéance', `le ${e.jourDuMois} du mois suivant ${fd(base)}`, iso(p.a, p.m, j));
      }
    }
    c.res('echeance', "Date d'échéance", ech, 'date', { principal: true });
    const delai = joursEntre(df, ech);
    c.calc('delaiJours', 'Délai effectif', `${fd(ech)} − ${fd(df)}`, d(delai), 'jours', { decimales: 0 });
    const max60 = ajouterJours(df, 60);
    const max45 = ajouterJours(finDeMois(df), 45);
    const plafond = comparer(max60, max45) > 0 ? max60 : max45;
    c.res('dateMaxLegale', 'Échéance maximale légale (la plus favorable)', plafond, 'date');
    c.verifier(
      comparer(ech, plafond) <= 0,
      'DELAI_LME',
      'Délai conforme à l’article L.441-10 du Code de commerce.',
      `Délai excédant le maximum légal (${fd(plafond)}) — amende administrative jusqu’à 2 M€ (L.441-16).`,
    );
  },
});

export const joursOuvres = formule({
  id: 'jours-ouvres',
  moteur: M,
  nom: 'Jours calendaires, ouvrés et ouvrables',
  categorie: 'Dates',
  description: 'Compte les jours calendaires, ouvrés (lundi-vendredi) et ouvrables (lundi-samedi) entre deux dates, hors jours fériés légaux.',
  expression: 'Ouvrés = jours lun→ven − fériés ; ouvrables = jours lun→sam − fériés',
  references: [
    { texte: 'Code du travail art. L.3133-1 — fêtes légales' },
    { texte: 'Code du travail art. L.3134-13 — Alsace-Moselle' },
  ],
  champs: [
    date('debut', 'Du (inclus)', { defaut: '2025-05-01' }),
    date('fin', 'Au (inclus)', { defaut: '2025-05-31' }),
    booleen('alsaceMoselle', 'Régime Alsace-Moselle'),
  ],
  exemples: [{ titre: 'Mai 2025', entrees: {}, attendu: { calendaires: '31', ouvres: '19', ouvrables: '24', feries: '3' } }],
  calculer(e, c) {
    const { debut, fin, alsaceMoselle } = e as { debut: string; fin: string; alsaceMoselle: boolean };
    if (comparer(fin, debut) < 0) {
      c.ctrl('erreur', 'PERIODE_INVERSEE', 'La date de fin précède la date de début.');
      return;
    }
    c.calc('calendaires', 'Jours calendaires', `${fd(fin)} − ${fd(debut)} + 1`, d(joursEntre(debut, fin) + 1), 'jours', { decimales: 0 });
    c.calc('ouvres', 'Jours ouvrés', 'lundi → vendredi hors fériés', d(compterJours(debut, fin, (s) => estOuvre(s, alsaceMoselle))), 'jours', { principal: true, decimales: 0 });
    c.calc('ouvrables', 'Jours ouvrables', 'lundi → samedi hors fériés', d(compterJours(debut, fin, (s) => estOuvrable(s, alsaceMoselle))), 'jours', { decimales: 0 });
    const lignes: Record<string, string>[] = [];
    for (let a = parts(debut).a; a <= parts(fin).a; a++)
      for (const [jour, nom] of joursFeries(a, alsaceMoselle))
        if (comparer(jour, debut) >= 0 && comparer(jour, fin) <= 0) lignes.push({ date: jour, nom });
    lignes.sort((x, y) => comparer(x.date, y.date));
    c.res('feries', 'Jours fériés dans la période', lignes.length, 'jours', { decimales: 0 });
    if (lignes.length)
      c.tableau({ titre: 'Jours fériés', colonnes: [{ cle: 'date', libelle: 'Date', unite: 'date' }, { cle: 'nom', libelle: 'Fête', unite: 'texte' }], lignes });
  },
});

export const prorataTemporis = formule({
  id: 'prorata-temporis',
  moteur: M,
  nom: 'Prorata temporis',
  categorie: 'Dates',
  description: "Proratise un montant annuel sur une période selon la convention de décompte (jours réels, exact/365, 30/360) ; utilisé pour les charges constatées d'avance, intérêts courus, loyers.",
  expression: 'Montant × jours de la période / base annuelle',
  references: [
    { texte: 'PCG art. 512-4 — rattachement des charges et produits à l’exercice' },
    { texte: 'Convention 30/360 (ISDA « 30E/360 »)' },
  ],
  champs: [
    montant('montantAnnuel', 'Montant annuel', { defaut: '12000' }),
    date('debut', 'Début de période (inclus)', { defaut: '2025-04-15' }),
    date('fin', 'Fin de période (incluse)', { defaut: '2025-12-31' }),
    choix('convention', 'Convention', [
      ['exact', 'Jours réels / jours de l’année (exact/exact)'],
      ['365', 'Jours réels / 365'],
      ['360', '30/360 (mois de 30 jours)'],
      ['exact360', 'Jours réels / 360 (usage bancaire)'],
    ]),
  ],
  exemples: [
    { titre: 'Loyer 15/04 → 31/12', entrees: {}, attendu: { jours: '261', prorata: '8580.82' } },
    { titre: '30/360', entrees: { convention: '360' }, attendu: { jours: '256', prorata: '8533.33' } },
  ],
  calculer(e, c) {
    const { debut, fin } = e as { debut: string; fin: string };
    if (comparer(fin, debut) < 0) {
      c.ctrl('erreur', 'PERIODE_INVERSEE', 'La date de fin précède la date de début.');
      return;
    }
    let jours: number;
    let base: number;
    switch (e.convention) {
      case '360':
        jours = jours30E360(debut, ajouterJours(fin, 1));
        base = 360;
        break;
      case 'exact360':
        jours = joursEntre(debut, fin) + 1;
        base = 360;
        break;
      case '365':
        jours = joursEntre(debut, fin) + 1;
        base = 365;
        break;
      default:
        jours = joursEntre(debut, fin) + 1;
        base = joursDansAnnee(parts(debut).a);
        if (parts(debut).a !== parts(fin).a) c.ctrl('info', 'MULTI_ANNEES', 'Période sur plusieurs années : base de l’année de début retenue.');
    }
    c.calc('jours', 'Jours de la période', `décompte ${e.convention}`, d(jours), 'jours', { decimales: 0 });
    c.res('base', 'Base annuelle', base, 'jours', { decimales: 0 });
    c.calc('prorata', 'Montant proratisé', `${fr(e.montantAnnuel)} × ${jours} / ${base}`, euros(d(e.montantAnnuel).times(jours).div(base)), 'EUR', { principal: true });
    c.calc('coefficient', 'Coefficient de prorata', `${jours} / ${base}`, d(jours).div(base), '%');
  },
});

export const conversionTauxPeriode = formule({
  id: 'conversion-taux-periode',
  moteur: M,
  nom: 'Conversion de taux entre périodes',
  categorie: 'Dates',
  description: 'Convertit un taux annuel en taux mensuel, trimestriel, hebdomadaire ou journalier, en taux proportionnel et en taux équivalent (actuariel).',
  expression: 'Proportionnel : t / k ; équivalent : (1 + t)^(1/k) − 1',
  references: [
    { texte: 'Code de la consommation art. R.314-2 — taux de période proportionnel' },
    { texte: 'Mathématiques financières — taux équivalents' },
  ],
  champs: [
    taux('tauxAnnuel', 'Taux annuel', { defaut: '6' }),
    choix('periode', 'Période cible', [
      ['12', 'Mois (12/an)'],
      ['4', 'Trimestre (4/an)'],
      ['2', 'Semestre (2/an)'],
      ['52', 'Semaine (52/an)'],
      ['360', 'Jour (base 360)'],
      ['365', 'Jour (base 365)'],
    ]),
  ],
  exemples: [{ titre: '6 % annuel → mensuel', entrees: {}, attendu: { proportionnel: '0.5000', equivalent: '0.4868' } }],
  calculer(e, c) {
    const k = Number(e.periode);
    const t: Decimal = e.tauxAnnuel;
    c.calc('proportionnel', 'Taux proportionnel', `${fp(t)} / ${k}`, t.div(k), '%', { principal: true, decimales: 4 });
    c.calc('equivalent', 'Taux équivalent (actuariel)', `(1 + ${fp(t)})^(1/${k}) − 1`, UN.plus(t).pow(UN.div(k)).minus(1), '%', { decimales: 4 });
    c.calc('annuelDepuisProportionnel', 'Taux annuel actuariel du taux proportionnel', `(1 + ${fp(t)}/${k})^${k} − 1`, UN.plus(t.div(k)).pow(k).minus(1), '%', { decimales: 4 });
  },
});

export const penalitesRetard = formule({
  id: 'penalites-retard',
  moteur: M,
  nom: 'Pénalités de retard et indemnité forfaitaire',
  categorie: 'Dates',
  description: "Calcule les pénalités de retard B2B (taux BCE + 10 points par défaut) et l'indemnité forfaitaire de recouvrement de 40 €.",
  expression: 'Pénalités = montant TTC × taux × jours de retard / 365 + 40 €',
  references: [
    { texte: 'Code de commerce art. L.441-10 II — taux minimal = 3 × taux d’intérêt légal ; défaut = taux BCE + 10 points' },
    { texte: 'Code de commerce art. D.441-5 — indemnité forfaitaire de 40 €' },
  ],
  champs: [
    montant('montantTTC', 'Montant TTC dû', { defaut: '6000' }),
    date('echeance', "Date d'échéance", { defaut: '2025-03-31' }),
    date('paiement', 'Date de paiement', { defaut: '2025-05-15' }),
    taux('taux', 'Taux annuel des pénalités', { defaut: '12.15', aide: 'Taux BCE de refinancement + 10 points, sauf taux contractuel.' }),
    booleen('indemnite', 'Appliquer l’indemnité forfaitaire de 40 €', { defaut: true }),
  ],
  exemples: [{ titre: '45 jours de retard', entrees: {}, attendu: { joursRetard: '45', penalites: '89.88', total: '129.88' } }],
  calculer(e, c) {
    const j = Math.max(0, joursEntre(e.echeance, e.paiement));
    c.calc('joursRetard', 'Jours de retard', `${fd(e.paiement)} − ${fd(e.echeance)}`, d(j), 'jours', { decimales: 0 });
    if (j === 0) c.ctrl('ok', 'SANS_RETARD', 'Paiement dans les délais : aucune pénalité.');
    const p = c.calc('penalites', 'Pénalités', `${fr(e.montantTTC)} × ${fp(e.taux)} × ${j} / 365`, euros(d(e.montantTTC).times(e.taux).times(j).div(365)));
    const ind = j > 0 && e.indemnite ? d(40) : ZERO;
    c.res('indemniteForfaitaire', 'Indemnité forfaitaire', ind);
    c.calc('total', 'Total exigible', 'pénalités + indemnité', p.plus(ind), 'EUR', { principal: true });
    if (j > 0)
      c.ecriture('Facturation des pénalités (hors champ TVA)', [
        { compte: '411', intitule: 'Clients', debit: p.plus(ind) },
        { compte: '7638', intitule: 'Revenus des créances diverses', credit: p.plus(ind) },
      ], 'VE');
  },
});

// ───────────────────────────── Contrôles ─────────────────────────────

export const detectionDoublons = formule({
  id: 'detection-doublons',
  moteur: M,
  nom: 'Détection des doublons',
  categorie: 'Contrôles',
  description: 'Repère les pièces potentiellement saisies deux fois : même tiers et même montant à quelques jours d’intervalle, ou même numéro de pièce.',
  expression: 'Doublon si (tiers, montant) identiques et |Δ dates| ≤ fenêtre, ou référence de pièce identique',
  references: [{ texte: 'Code de commerce art. R.123-174 — pièces justificatives ; contrôle interne' }],
  champs: [
    table(
      'pieces',
      'Pièces',
      [
        date('date', 'Date'),
        texte('piece', 'N° pièce', { optionnel: true }),
        texte('tiers', 'Tiers'),
        montant('montant', 'Montant'),
      ],
      {
        min: '1',
        defaut: [
          { date: '2025-02-03', piece: 'F-1021', tiers: 'ACME', montant: '1440.00' },
          { date: '2025-02-05', piece: 'F-1021B', tiers: 'ACME', montant: '1440.00' },
          { date: '2025-02-10', piece: 'F-1033', tiers: 'Durand', montant: '320.50' },
          { date: '2025-02-12', piece: 'F-1033', tiers: 'Durand SA', montant: '320.50' },
          { date: '2025-03-15', piece: 'F-1102', tiers: 'ACME', montant: '1440.00' },
        ],
      },
    ),
    entier('fenetre', 'Fenêtre (jours)', { defaut: 7, min: '0' }),
  ],
  exemples: [{ titre: 'Deux doublons', entrees: {}, attendu: { doublons: '2' } }],
  calculer(e, c) {
    const p = e.pieces as { date: string; piece?: string; tiers: string; montant: Decimal }[];
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(sa|sas|sarl|eurl)\b/g, '').replace(/\W/g, '');
    const lignes: Record<string, string>[] = [];
    for (let i = 0; i < p.length; i++)
      for (let k = i + 1; k < p.length; k++) {
        const a = p[i];
        const b = p[k];
        const memeRef = a.piece && b.piece && a.piece === b.piece;
        const proches = Math.abs(numJour(a.date) - numJour(b.date)) <= e.fenetre;
        const memeTiersMontant = norm(a.tiers) === norm(b.tiers) && a.montant.equals(b.montant);
        if (memeRef || (memeTiersMontant && proches))
          lignes.push({
            ligneA: String(i + 1),
            ligneB: String(k + 1),
            motif: memeRef ? 'Même n° de pièce' : `Même tiers et montant à ${Math.abs(numJour(a.date) - numJour(b.date))} j`,
            montant: a.montant.toFixed(2),
          });
      }
    c.calc('doublons', 'Doublons suspectés', 'paires correspondant aux critères', d(lignes.length), 'entier', { principal: true });
    if (lignes.length) {
      c.ctrl('avertissement', 'DOUBLONS', `${lignes.length} doublon(s) potentiel(s) à vérifier.`);
      c.tableau({
        titre: 'Doublons suspectés',
        colonnes: [
          { cle: 'ligneA', libelle: 'Ligne', unite: 'entier' },
          { cle: 'ligneB', libelle: 'Doublon de', unite: 'entier' },
          { cle: 'motif', libelle: 'Motif', unite: 'texte' },
          { cle: 'montant', libelle: 'Montant', unite: 'EUR' },
        ],
        lignes,
      });
    }
  },
});

export const formulesBase = [
  arrondiComptable,
  equilibreDebitCredit,
  variation,
  appliquerPourcentage,
  partTotal,
  regleDeTrois,
  repartitionProportionnelle,
  statistiquesSerie,
  moyennePonderee,
  moyenneMobile,
  conversionDevise,
  ecartDeChange,
  echeancePaiement,
  joursOuvres,
  prorataTemporis,
  conversionTauxPeriode,
  penalitesRetard,
  detectionDoublons,
];

// Ré-export utilitaire pour d'autres moteurs.
export { diviser, pct };
