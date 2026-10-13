/**
 * MOTEUR 12 — Consolidation et opérations internationales : périmètre et
 * pourcentages, écart d'acquisition, partage des capitaux propres, éliminations,
 * conversion des comptes, impôts différés, couverture de change.
 */
import {
  booleen,
  choix,
  d,
  Decimal,
  euros,
  fe,
  formule,
  fp,
  fr,
  frn,
  montant,
  nombre,
  normCdf,
  resoudreSysteme,
  somme,
  table,
  taux,
  texte,
  UN,
  ZERO,
} from '../noyau';

const M = 'consolidation' as const;
const REF_ANC = { texte: 'Règlement ANC n° 2020-01 relatif aux comptes consolidés' };

function methodeSelonControle(c: Decimal, conjoint: boolean): string {
  if (conjoint) return 'Intégration proportionnelle (contrôle conjoint, ANC 2020-01)';
  if (c.greaterThan('0.5')) return 'Intégration globale';
  if (c.greaterThanOrEqualTo('0.2')) return 'Mise en équivalence (influence notable présumée)';
  return 'Hors périmètre (titres de participation)';
}

export const perimetre = formule({
  id: 'perimetre',
  moteur: M,
  nom: 'Pourcentages de contrôle et d’intérêt, méthode de consolidation',
  categorie: 'Périmètre',
  description:
    'À partir de l’organigramme des participations (y compris détentions indirectes et croisées), calcule pour chaque société le pourcentage d’intérêt (produit des chaînes de détention), le pourcentage de contrôle (droits détenus par la mère et les sociétés qu’elle contrôle) et la méthode de consolidation.',
  expression: 'Intérêt : I(X) = Σ I(h) × p(h → X) ; contrôle : C(X) = Σ p(h → X) pour h = mère ou contrôlée ; méthode : > 50 % IG, 20-50 % ME',
  references: [REF_ANC, { texte: 'Code de commerce art. L.233-16 — contrôle exclusif, conjoint, influence notable' }],
  champs: [
    texte('mere', 'Société consolidante', { defaut: 'Mère' }),
    table('participations', 'Participations (droits de vote = capital)', [texte('detentrice', 'Société détentrice'), texte('detenue', 'Société détenue'), taux('pourcentage', '% détenu'), booleen('conjoint', 'Contrôle conjoint')], {
      min: '1',
      defaut: [
        { detentrice: 'Mère', detenue: 'A', pourcentage: '80', conjoint: false },
        { detentrice: 'Mère', detenue: 'B', pourcentage: '30', conjoint: false },
        { detentrice: 'A', detenue: 'B', pourcentage: '25', conjoint: false },
        { detentrice: 'A', detenue: 'C', pourcentage: '60', conjoint: false },
        { detentrice: 'B', detenue: 'D', pourcentage: '90', conjoint: false },
        { detentrice: 'Mère', detenue: 'E', pourcentage: '50', conjoint: true },
      ],
    }),
  ],
  exemples: [{ titre: 'Groupe à 5 filiales', entrees: {}, attendu: { interet_A: '80.00', interet_B: '50.00', controle_B: '55.00', interet_C: '48.00', interet_D: '45.00', controle_D: '90.00' } }],
  calculer(e, c) {
    type P = { detentrice: string; detenue: string; pourcentage: Decimal; conjoint: boolean };
    const ps = e.participations as P[];
    const mere = (e.mere as string).trim();
    const societes = [...new Set(ps.flatMap((p) => [p.detentrice.trim(), p.detenue.trim()]))].filter((s) => s !== mere);
    const idx = new Map(societes.map((s, i) => [s, i]));
    const p = (h: string, x: string) => somme(ps.filter((q) => q.detentrice.trim() === h && q.detenue.trim() === x).map((q) => q.pourcentage));
    for (const s of societes) {
      const total = somme(ps.filter((q) => q.detenue.trim() === s).map((q) => q.pourcentage));
      if (total.greaterThan(1)) c.ctrl('erreur', 'DETENTION_SUPERIEURE', `${s} est détenue à plus de 100 % (${fp(total)}).`);
    }
    // Intérêts : (Id − Pᵀ) I = p(mère → ·)
    const A = societes.map((x) => societes.map((h) => (h === x ? UN.minus(p(h, x)) : p(h, x).neg())));
    const I = resoudreSysteme(A, societes.map((x) => p(mere, x)));
    // Contrôle : itération jusqu'au point fixe
    let C = societes.map((x) => p(mere, x));
    for (let k = 0; k < societes.length + 2; k++) {
      C = societes.map((x) => p(mere, x).plus(somme(societes.filter((h) => C[idx.get(h)!].greaterThan('0.5')).map((h) => p(h, x)))));
    }
    const lignes = societes.map((s, i) => {
      const conjoint = ps.some((q) => q.detenue.trim() === s && q.detentrice.trim() === mere && q.conjoint);
      const meth = methodeSelonControle(C[i], conjoint);
      c.res(`interet_${s}`, `Pourcentage d’intérêt — ${s}`, I[i], '%');
      c.res(`controle_${s}`, `Pourcentage de contrôle — ${s}`, C[i], '%');
      c.etape(`Intérêt ${s}`, 'Σ intérêt du détenteur × % détenu', I[i], '%');
      return { societe: s, controle: C[i].times(100).toFixed(2), interet: I[i].times(100).toFixed(2), methode: meth };
    });
    c.tableau({
      titre: 'Périmètre de consolidation',
      colonnes: [
        { cle: 'societe', libelle: 'Société', unite: 'texte' },
        { cle: 'controle', libelle: '% contrôle', unite: '%' },
        { cle: 'interet', libelle: '% intérêt', unite: '%' },
        { cle: 'methode', libelle: 'Méthode', unite: 'texte' },
      ],
      lignes,
    });
    c.ctrl('info', 'DROITS_VOTE', 'Hypothèse : droits de vote proportionnels au capital ; vérifier les droits de vote double, pactes et contrôle de fait (L.233-16).');
  },
});

export const ecartAcquisition = formule({
  id: 'ecart-acquisition',
  moteur: M,
  nom: 'Écart d’acquisition (goodwill)',
  categorie: 'Retraitements',
  description: 'Détermine l’actif net réévalué de la cible (écarts d’évaluation nets d’impôts différés), puis l’écart d’acquisition selon la méthode du goodwill partiel ou complet, et les intérêts minoritaires.',
  expression: 'ANR = CP + écarts d’évaluation × (1 − t) ; GW partiel = prix − % × ANR ; GW complet = prix + JV des minoritaires − ANR',
  references: [REF_ANC, { texte: 'ANC 2020-01, art. 231-1 et s. ; IFRS 3 — regroupements d’entreprises' }],
  champs: [
    montant('prix', 'Coût d’acquisition des titres', { defaut: '9500000' }),
    taux('pourcentage', 'Pourcentage acquis', { defaut: '80' }),
    montant('capitauxPropres', 'Capitaux propres comptables de la cible', { defaut: '7200000' }),
    montant('ecartsEvaluation', 'Écarts d’évaluation (juste valeur − valeur comptable)', { defaut: '1600000' }),
    taux('tauxIs', 'Taux d’impôt différé', { defaut: '25' }),
    choix('methode', 'Méthode', [
      ['partiel', 'Goodwill partiel'],
      ['complet', 'Goodwill complet (juste valeur des minoritaires)'],
    ]),
    montant('jvMinoritaires', 'Juste valeur des intérêts minoritaires', { defaut: '2300000', visibleSi: { champ: 'methode', valeurs: ['complet'] } }),
  ],
  exemples: [
    { titre: 'Partiel', entrees: {}, attendu: { anr: '8400000.00', goodwill: '2780000.00', minoritaires: '1680000.00' } },
    { titre: 'Complet', entrees: { methode: 'complet' }, attendu: { goodwill: '3400000.00', minoritaires: '2300000.00' } },
  ],
  calculer(e, c) {
    const idp = c.calc('idp', 'Impôt différé passif sur écarts', `${fr(e.ecartsEvaluation)} × ${fp(e.tauxIs)}`, euros(d(e.ecartsEvaluation).times(e.tauxIs)));
    const anr = c.calc('anr', 'Actif net réévalué', `${fr(e.capitauxPropres)} + ${fr(e.ecartsEvaluation)} − ${fr(idp)}`, d(e.capitauxPropres).plus(e.ecartsEvaluation).minus(idp));
    const p: Decimal = e.pourcentage;
    let gw: Decimal;
    let mino: Decimal;
    if (e.methode === 'partiel') {
      gw = d(e.prix).minus(euros(anr.times(p)));
      mino = euros(anr.times(UN.minus(p)));
      c.etape('Goodwill partiel', `${fr(e.prix)} − ${fp(p)} × ${fr(anr)}`, gw, 'EUR');
    } else {
      gw = d(e.prix).plus(e.jvMinoritaires).minus(anr);
      mino = d(e.jvMinoritaires);
      c.etape('Goodwill complet', `${fr(e.prix)} + ${fr(e.jvMinoritaires)} − ${fr(anr)}`, gw, 'EUR');
    }
    c.res('goodwill', gw.isNegative() ? 'Écart d’acquisition négatif' : 'Écart d’acquisition', gw, 'EUR', { principal: true });
    c.res('minoritaires', 'Intérêts minoritaires à l’entrée', mino);
    if (gw.isNegative()) c.ctrl('avertissement', 'BADWILL', 'Écart négatif : revoir l’identification et l’évaluation des actifs et passifs ; le solde est rapporté au résultat.');
    else c.ctrl('info', 'TEST', 'Écart d’acquisition à durée non limitée : test de dépréciation annuel ; à durée limitée : amortissement (ANC 2020-01, art. 231-11).');
  },
});

export const partageCapitauxPropres = formule({
  id: 'partage-capitaux-propres',
  moteur: M,
  nom: 'Élimination des titres et partage des capitaux propres',
  categorie: 'Retraitements',
  description: 'Élimine les titres de la filiale contre sa quote-part de capitaux propres, calcule les réserves consolidées, le résultat part du groupe et les intérêts minoritaires (intégration globale).',
  expression: 'Réserves groupe = % × (capital + réserves) − titres − écart d’acquisition ; résultat groupe = % × résultat ; minoritaires = (1 − %) × CP',
  references: [REF_ANC],
  champs: [
    montant('capital', 'Capital de la filiale', { defaut: '1000000' }),
    montant('reserves', 'Réserves de la filiale', { defaut: '2600000' }),
    montant('resultat', 'Résultat de la filiale', { defaut: '450000' }),
    taux('interet', 'Pourcentage d’intérêt', { defaut: '75' }),
    montant('titres', 'Valeur des titres chez la mère', { defaut: '2400000' }),
    montant('goodwill', 'Écart d’acquisition', { defaut: '0' }),
  ],
  exemples: [{ titre: 'Filiale à 75 %', entrees: {}, attendu: { reservesGroupe: '300000.00', resultatGroupe: '337500.00', minoritaires: '1012500.00' } }],
  calculer(e, c) {
    const p: Decimal = e.interet;
    const cr = d(e.capital).plus(e.reserves);
    const rg = c.calc('reservesGroupe', 'Part du groupe dans les réserves (réserves consolidées)', `${fp(p)} × ${fr(cr)} − ${fr(e.titres)} − ${fr(e.goodwill)}`, euros(cr.times(p)).minus(e.titres).minus(e.goodwill), 'EUR', { principal: true });
    const resG = c.calc('resultatGroupe', 'Résultat part du groupe', `${fp(p)} × ${fr(e.resultat)}`, euros(d(e.resultat).times(p)));
    const mR = euros(cr.times(UN.minus(p)));
    const mRes = d(e.resultat).minus(resG);
    c.calc('minoritaires', 'Intérêts minoritaires', `(1 − ${fp(p)}) × (${fr(cr)} + ${fr(e.resultat)})`, mR.plus(mRes), 'EUR', { principal: true });
    c.ecriture('Élimination des titres et partage', [
      { compte: '101', intitule: 'Capital filiale', debit: e.capital },
      { compte: '106', intitule: 'Réserves filiale', debit: e.reserves },
      { compte: '120', intitule: 'Résultat filiale', debit: e.resultat },
      { compte: '207', intitule: 'Écart d’acquisition', debit: e.goodwill },
      { compte: '261', intitule: 'Titres de participation', credit: e.titres },
      { compte: '1068G', intitule: 'Réserves consolidées (part du groupe)', credit: rg },
      { compte: '120G', intitule: 'Résultat part du groupe', credit: resG },
      { compte: '108M', intitule: 'Intérêts minoritaires — réserves', credit: mR },
      { compte: '120M', intitule: 'Intérêts minoritaires — résultat', credit: mRes },
    ], 'CONSO');
  },
});

export const margesInternes = formule({
  id: 'marges-internes',
  moteur: M,
  nom: 'Élimination des marges internes en stock',
  categorie: 'Éliminations',
  description: 'Élimine la marge réalisée par une société du groupe sur des biens encore en stock chez une autre, constate l’impôt différé actif et répartit l’impact entre groupe et minoritaires.',
  expression: 'Marge = stock d’origine interne × taux de marge (sur prix de vente) ; IDA = marge × t ; impact net = marge × (1 − t), réparti selon le % d’intérêt du vendeur',
  references: [REF_ANC, { texte: 'ANC 2020-01, art. 272-1 — élimination des résultats internes' }],
  champs: [
    montant('stockInterne', 'Stock acheté à une société du groupe (prix de cession)', { defaut: '480000' }),
    taux('tauxMarge', 'Taux de marge du vendeur sur prix de vente', { defaut: '25' }),
    taux('tauxIs', 'Taux d’impôt différé', { defaut: '25' }),
    taux('interetVendeur', 'Pourcentage d’intérêt dans la société venderesse', { defaut: '80' }),
  ],
  exemples: [{ titre: 'Filiale vendeuse à 80 %', entrees: {}, attendu: { marge: '120000.00', ida: '30000.00', impactNet: '90000.00', partGroupe: '72000.00', partMinoritaires: '18000.00' } }],
  calculer(e, c) {
    const m = c.calc('marge', 'Marge interne à éliminer', `${fr(e.stockInterne)} × ${fp(e.tauxMarge)}`, euros(d(e.stockInterne).times(e.tauxMarge)), 'EUR', { principal: true });
    const ida = c.calc('ida', 'Impôt différé actif', `${fr(m)} × ${fp(e.tauxIs)}`, euros(m.times(e.tauxIs)));
    const net = c.calc('impactNet', 'Diminution du résultat net consolidé', `${fr(m)} − ${fr(ida)}`, m.minus(ida));
    const g = c.calc('partGroupe', 'Part du groupe', `${fr(net)} × ${fp(e.interetVendeur)}`, euros(net.times(e.interetVendeur)));
    c.calc('partMinoritaires', 'Part des minoritaires', `${fr(net)} − ${fr(g)}`, net.minus(g));
    c.ecriture('Élimination de la marge en stock', [
      { compte: '603', intitule: 'Variation des stocks', debit: m },
      { compte: '3', intitule: 'Stocks', credit: m },
      { compte: '133', intitule: 'Impôt différé actif', debit: ida },
      { compte: '692', intitule: 'Impôt différé (produit)', credit: ida },
    ], 'CONSO');
  },
});

export const comptesReciproques = formule({
  id: 'comptes-reciproques',
  moteur: M,
  nom: 'Rapprochement et élimination des comptes réciproques',
  categorie: 'Éliminations',
  description: 'Rapproche les soldes réciproques entre sociétés du groupe (créances/dettes, ventes/achats, produits/charges financiers), identifie les écarts à analyser et le montant éliminé.',
  expression: 'Écart = montant chez A − montant chez B ; élimination = montant chez A après ajustement des écarts',
  references: [REF_ANC, { texte: 'ANC 2020-01, art. 272-1 — opérations réciproques' }],
  champs: [
    table('soldes', 'Soldes réciproques', [texte('nature', 'Nature'), texte('societeA', 'Société A'), montant('montantA', 'Montant chez A'), texte('societeB', 'Société B'), montant('montantB', 'Montant chez B')], {
      min: '1',
      defaut: [
        { nature: 'Créance / dette commerciale', societeA: 'Mère', montantA: '245000', societeB: 'A', montantB: '245000' },
        { nature: 'Ventes / achats', societeA: 'A', montantA: '1820000', societeB: 'Mère', montantB: '1796000' },
        { nature: 'Prêt / emprunt', societeA: 'Mère', montantA: '500000', societeB: 'C', montantB: '500000' },
        { nature: 'Intérêts reçus / versés', societeA: 'Mère', montantA: '17500', societeB: 'C', montantB: '17000' },
      ],
    }),
    montant('seuil', 'Seuil de signification des écarts', { defaut: '1000' }),
  ],
  exemples: [{ titre: 'Rapprochement annuel', entrees: {}, attendu: { totalElimine: '2558000.00', ecartTotal: '24500.00', ecartsSignificatifs: '1' } }],
  calculer(e, c) {
    type S = { nature: string; societeA: string; montantA: Decimal; societeB: string; montantB: Decimal };
    let sig = 0;
    let ecTot = ZERO;
    const lignes = (e.soldes as S[]).map((s) => {
      const ec = s.montantA.minus(s.montantB);
      ecTot = ecTot.plus(ec.abs());
      const significatif = ec.abs().greaterThan(e.seuil);
      if (significatif) {
        sig++;
        c.ctrl('avertissement', 'ECART_RECIPROQUE', `${s.nature} ${s.societeA}/${s.societeB} : écart de ${fe(ec)} — décalage de comptabilisation ou désaccord à analyser.`);
      }
      return { nature: s.nature, sens: `${s.societeA} / ${s.societeB}`, montantA: s.montantA.toFixed(2), montantB: s.montantB.toFixed(2), ecart: ec.toFixed(2), statut: ec.isZero() ? 'Concordant' : significatif ? 'À analyser' : 'Écart non significatif' };
    });
    c.calc('totalElimine', 'Total éliminé', 'Σ min(A ; B)', somme((e.soldes as S[]).map((s) => Decimal.min(s.montantA, s.montantB))), 'EUR', { principal: true });
    c.calc('ecartTotal', 'Total des écarts', 'Σ |A − B|', ecTot);
    c.res('ecartsSignificatifs', 'Écarts significatifs', sig, 'entier');
    c.tableau({
      titre: 'Rapprochement',
      colonnes: [
        { cle: 'nature', libelle: 'Nature', unite: 'texte' },
        { cle: 'sens', libelle: 'Sociétés', unite: 'texte' },
        { cle: 'montantA', libelle: 'Chez A', unite: 'EUR' },
        { cle: 'montantB', libelle: 'Chez B', unite: 'EUR' },
        { cle: 'ecart', libelle: 'Écart', unite: 'EUR' },
        { cle: 'statut', libelle: 'Statut', unite: 'texte' },
      ],
      lignes,
    });
  },
});

export const conversionComptes = formule({
  id: 'conversion-comptes',
  moteur: M,
  nom: 'Conversion des comptes d’une filiale étrangère',
  categorie: 'International',
  description: 'Méthode du cours de clôture : actifs et passifs au cours de clôture, capitaux propres au cours historique, résultat au cours moyen ; détermine l’écart de conversion et son partage.',
  expression: 'Écart de conversion = actif net × cours de clôture − (CP historiques en € + résultat × cours moyen)',
  references: [REF_ANC, { texte: 'ANC 2020-01, art. 272-6 et s. — conversion des comptes des entités étrangères' }, { texte: 'IAS 21' }],
  champs: [
    texte('devise', 'Devise', { defaut: 'USD' }),
    montant('actif', 'Total actif (devise)', { defaut: '12500000', unite: '' }),
    montant('dettes', 'Total dettes (devise)', { defaut: '7300000', unite: '' }),
    montant('resultat', 'Résultat de l’exercice (devise)', { defaut: '600000', unite: '' }),
    montant('cpHistoriquesEuro', 'Capitaux propres hors résultat convertis aux cours historiques (€)', { defaut: '4350000' }),
    nombre('coursCloture', 'Cours de clôture (1 devise = … €)', { defaut: '0.9050' }),
    nombre('coursMoyen', 'Cours moyen de l’exercice', { defaut: '0.9240' }),
    taux('interet', 'Pourcentage d’intérêt', { defaut: '100' }),
  ],
  exemples: [{ titre: 'Filiale américaine', entrees: {}, attendu: { actifNetEuro: '4706000.00', resultatEuro: '554400.00', ecartConversion: '-198400.00' } }],
  calculer(e, c) {
    const an = c.calc('actifNetEuro', 'Actif net au cours de clôture', `(${fr(e.actif)} − ${fr(e.dettes)}) × ${frn(e.coursCloture)}`, euros(d(e.actif).minus(e.dettes).times(e.coursCloture)));
    c.etape('Actifs convertis', `${fr(e.actif)} × ${frn(e.coursCloture)}`, euros(d(e.actif).times(e.coursCloture)), 'EUR');
    const r = c.calc('resultatEuro', 'Résultat au cours moyen', `${fr(e.resultat)} × ${frn(e.coursMoyen)}`, euros(d(e.resultat).times(e.coursMoyen)));
    const ec = c.calc('ecartConversion', 'Écart de conversion', `${fr(an)} − (${fr(e.cpHistoriquesEuro)} + ${fr(r)})`, an.minus(e.cpHistoriquesEuro).minus(r), 'EUR', { principal: true });
    const g = c.calc('ecartGroupe', 'Part du groupe (capitaux propres)', `${fr(ec)} × ${fp(e.interet)}`, euros(ec.times(e.interet)));
    c.res('ecartMinoritaires', 'Part des minoritaires', ec.minus(g));
    c.ctrl('info', 'RECYCLAGE', 'L’écart de conversion est inscrit en capitaux propres et rapporté au résultat lors de la cession de la filiale.');
  },
});

export const impotsDifferes = formule({
  id: 'impots-differes',
  moteur: M,
  nom: 'Impôts différés',
  categorie: 'Retraitements',
  description: 'Calcule les impôts différés actifs et passifs sur les différences temporaires entre valeurs comptables et bases fiscales, et sur les déficits reportables.',
  expression: 'Actif : VC > base fiscale → IDP ; passif : VC > base fiscale → IDA ; ID = différence × taux ; IDA déficits = déficit × taux (si récupérable)',
  references: [REF_ANC, { texte: 'ANC 2020-01, art. 272-9 et s. — impôts différés (méthode du report variable)' }, { texte: 'IAS 12' }],
  champs: [
    table('elements', 'Éléments', [texte('libelle', 'Élément'), choix('nature', 'Nature', [['actif', 'Actif'], ['passif', 'Passif']]), montant('valeurComptable', 'Valeur comptable'), montant('baseFiscale', 'Base fiscale')], {
      min: '1',
      defaut: [
        { libelle: 'Immobilisation (amortissement fiscal accéléré)', nature: 'actif', valeurComptable: '800000', baseFiscale: '620000' },
        { libelle: 'Provision pour congés payés non déductible', nature: 'passif', valeurComptable: '95000', baseFiscale: '0' },
        { libelle: 'Provision retraite non déductible', nature: 'passif', valeurComptable: '140000', baseFiscale: '0' },
        { libelle: 'Écart d’évaluation sur terrain', nature: 'actif', valeurComptable: '1300000', baseFiscale: '900000' },
      ],
    }),
    montant('deficits', 'Déficits fiscaux reportables', { defaut: '0' }),
    booleen('deficitsRecuperables', 'Récupération des déficits probable'),
    taux('taux', 'Taux d’impôt applicable au dénouement', { defaut: '25' }),
  ],
  exemples: [{ titre: 'Retraitements', entrees: {}, attendu: { ida: '58750.00', idp: '145000.00', net: '-86250.00' } }],
  calculer(e, c) {
    type El = { libelle: string; nature: string; valeurComptable: Decimal; baseFiscale: Decimal };
    const t: Decimal = e.taux;
    let ida = ZERO;
    let idp = ZERO;
    const lignes = (e.elements as El[]).map((x) => {
      const diff = x.valeurComptable.minus(x.baseFiscale);
      // Actif : VC > BF → différence taxable (IDP) ; passif : VC > BF → différence déductible (IDA)
      const taxable = x.nature === 'actif' ? diff : diff.neg();
      const id = euros(taxable.abs().times(t));
      if (taxable.greaterThan(0)) idp = idp.plus(id);
      else ida = ida.plus(id);
      return { libelle: x.libelle, difference: diff.toFixed(2), type: taxable.greaterThan(0) ? 'Taxable (IDP)' : taxable.isZero() ? '—' : 'Déductible (IDA)', impot: id.toFixed(2) };
    });
    if (d(e.deficits).greaterThan(0)) {
      if (e.deficitsRecuperables) ida = ida.plus(euros(d(e.deficits).times(t)));
      else c.ctrl('info', 'DEFICITS', 'Déficits non activés : récupération non probable (ANC 2020-01, art. 272-10).');
    }
    c.calc('ida', 'Impôts différés actifs', 'Σ différences déductibles × taux', ida);
    c.calc('idp', 'Impôts différés passifs', 'Σ différences taxables × taux', idp);
    c.calc('net', 'Position nette (IDA − IDP)', `${fr(ida)} − ${fr(idp)}`, ida.minus(idp), 'EUR', { principal: true });
    c.tableau({
      titre: 'Différences temporaires',
      colonnes: [
        { cle: 'libelle', libelle: 'Élément', unite: 'texte' },
        { cle: 'difference', libelle: 'VC − base fiscale', unite: 'EUR' },
        { cle: 'type', libelle: 'Type', unite: 'texte' },
        { cle: 'impot', libelle: 'Impôt différé', unite: 'EUR' },
      ],
      lignes,
    });
  },
});

export const couvertureTerme = formule({
  id: 'couverture-terme',
  moteur: M,
  nom: 'Couverture de change à terme',
  categorie: 'International',
  description: 'Cours à terme par parité des taux d’intérêt, report ou déport, montant en euros garanti et résultat de la couverture comparé à une position non couverte.',
  expression: 'Cours à terme = spot × (1 + r€ × j/360) / (1 + rdevise × j/360) ; report si > spot, déport sinon',
  references: [{ texte: 'Parité couverte des taux d’intérêt' }, { texte: 'PCG art. 628-1 et s. — opérations de couverture' }],
  champs: [
    montant('montantDevise', 'Montant en devise', { defaut: '500000', unite: '' }),
    choix('sens', 'Opération', [
      ['vente', 'Vente à terme (créance export)'],
      ['achat', 'Achat à terme (dette import)'],
    ]),
    nombre('spot', 'Cours au comptant (1 devise = … €)', { defaut: '0.9200' }),
    taux('tauxEuro', 'Taux d’intérêt euro', { defaut: '3.25' }),
    taux('tauxDevise', 'Taux d’intérêt de la devise', { defaut: '4.75' }),
    nombre('jours', 'Durée (jours)', { defaut: '90' }),
    nombre('spotEcheance', 'Cours au comptant constaté à l’échéance (scénario)', { defaut: '0.8950' }),
  ],
  exemples: [{ titre: 'Export USD 90 j', entrees: {}, attendu: { coursTerme: '0.916590', montantGaranti: '458295.24', resultatCouverture: '10795.24' } }],
  calculer(e, c) {
    const f = UN.plus(d(e.tauxEuro).times(e.jours).div(360)).div(UN.plus(d(e.tauxDevise).times(e.jours).div(360)));
    const ct = c.calc('coursTerme', 'Cours à terme', `${frn(e.spot)} × (1 + ${fp(e.tauxEuro)} × ${frn(e.jours)}/360) / (1 + ${fp(e.tauxDevise)} × ${frn(e.jours)}/360)`, d(e.spot).times(f), 'nombre', { decimales: 6, principal: true });
    const rd = c.calc('reportDeport', ct.greaterThan(e.spot) ? 'Report' : 'Déport', 'cours à terme − spot', ct.minus(e.spot), 'nombre', { decimales: 6 });
    const g = c.calc('montantGaranti', 'Montant garanti en euros', `${fr(e.montantDevise)} × ${frn(ct, 6)}`, euros(d(e.montantDevise).times(ct)), 'EUR', { principal: true });
    const nc = c.calc('montantNonCouvert', 'Montant sans couverture (scénario)', `${fr(e.montantDevise)} × ${frn(e.spotEcheance)}`, euros(d(e.montantDevise).times(e.spotEcheance)));
    const res = e.sens === 'vente' ? g.minus(nc) : nc.minus(g);
    c.calc('resultatCouverture', 'Gain (+) / perte (−) de la couverture vs non-couverture', e.sens === 'vente' ? 'garanti − non couvert' : 'non couvert − garanti', res);
    c.res('tauxReportAnnualise', 'Report/déport annualisé', rd.div(e.spot).times(360).div(e.jours), '%');
  },
});

export const optionChange = formule({
  id: 'option-change',
  moteur: M,
  nom: 'Option de change (Garman-Kohlhagen)',
  categorie: 'International',
  description: 'Prime théorique d’une option de change européenne (call ou put) selon le modèle de Garman-Kohlhagen, avec les sensibilités delta et le cours plancher/plafond garanti.',
  expression: 'd1 = [ln(S/K) + (rd − rf + σ²/2) T] / (σ √T) ; call = S e^(−rf T) N(d1) − K e^(−rd T) N(d2) ; put = K e^(−rd T) N(−d2) − S e^(−rf T) N(−d1)',
  references: [{ texte: 'Garman & Kohlhagen (1983), « Foreign currency option values »' }],
  champs: [
    choix('type', 'Type d’option', [
      ['put', 'Put devise (protection d’une créance)'],
      ['call', 'Call devise (protection d’une dette)'],
    ]),
    montant('montantDevise', 'Nominal en devise', { defaut: '500000', unite: '' }),
    nombre('spot', 'Cours au comptant S (1 devise = … €)', { defaut: '0.9200' }),
    nombre('strike', 'Prix d’exercice K', { defaut: '0.9100' }),
    nombre('maturite', 'Maturité (années)', { defaut: '0.25' }),
    taux('tauxEuro', 'Taux sans risque euro (continu)', { defaut: '3.2' }),
    taux('tauxDevise', 'Taux sans risque devise (continu)', { defaut: '4.7' }),
    taux('volatilite', 'Volatilité annuelle', { defaut: '8' }),
  ],
  exemples: [{ titre: 'Put 3 mois', entrees: {}, attendu: { primeUnitaire: '0.011437', primeTotale: '5718.40' } }],
  calculer(e, c) {
    const S = d(e.spot);
    const K = d(e.strike);
    const T = d(e.maturite);
    const s = d(e.volatilite);
    const rd = d(e.tauxEuro);
    const rf = d(e.tauxDevise);
    const sT = s.times(T.sqrt());
    const d1 = c.etape('d1', `[ln(${frn(S)}/${frn(K)}) + (${fp(rd)} − ${fp(rf)} + σ²/2) × ${frn(T)}] / (σ√T)`, S.div(K).ln().plus(rd.minus(rf).plus(s.pow(2).div(2)).times(T)).div(sT), 'nombre');
    const d2 = c.etape('d2', 'd1 − σ√T', d1.minus(sT), 'nombre');
    const dfF = rf.times(T).neg().exp();
    const dfD = rd.times(T).neg().exp();
    const prime =
      e.type === 'call'
        ? S.times(dfF).times(normCdf(d1)).minus(K.times(dfD).times(normCdf(d2)))
        : K.times(dfD).times(normCdf(d2.neg())).minus(S.times(dfF).times(normCdf(d1.neg())));
    c.calc('primeUnitaire', 'Prime par unité de devise', e.type === 'call' ? 'S e^(−rf T) N(d1) − K e^(−rd T) N(d2)' : 'K e^(−rd T) N(−d2) − S e^(−rf T) N(−d1)', prime, 'nombre', { decimales: 6 });
    const pt = c.calc('primeTotale', 'Prime totale', `${fr(e.montantDevise)} × ${frn(prime, 6)}`, euros(d(e.montantDevise).times(prime)), 'EUR', { principal: true });
    const delta = e.type === 'call' ? dfF.times(normCdf(d1)) : dfF.times(normCdf(d1).minus(1));
    c.calc('delta', 'Delta', e.type === 'call' ? 'e^(−rf T) N(d1)' : 'e^(−rf T) (N(d1) − 1)', delta, 'nombre', { decimales: 4 });
    const garanti = e.type === 'put' ? K.times(e.montantDevise).minus(pt) : K.times(e.montantDevise).plus(pt);
    c.calc('montantGaranti', e.type === 'put' ? 'Encaissement minimum garanti (net de prime)' : 'Décaissement maximum garanti (prime incluse)', e.type === 'put' ? 'K × nominal − prime' : 'K × nominal + prime', euros(garanti));
  },
});

export const formulesConsolidation = [perimetre, ecartAcquisition, partageCapitauxPropres, margesInternes, comptesReciproques, conversionComptes, impotsDifferes, couvertureTerme, optionChange];
