/**
 * MOTEUR 6 — Fiscalité des entreprises.
 * Ce fichier : impôt sur les sociétés (IS, acomptes, solde, résultat fiscal,
 * déficits, carry-back, régime mère-fille, intégration fiscale, plus-values).
 * Voir taxes.ts (CFE, CVAE, TS, TVS, taxes diverses) et declarations.ts (FEC, DAS2, IFU).
 */
import './baremes';
import {
  ajouterJours,
  ajouterMois,
  arrondiFiscal,
  booleen,
  choix,
  d,
  date,
  dateOperation,
  Decimal,
  entier,
  euros,
  fd,
  fe,
  formule,
  fp,
  fr,
  min,
  montant,
  nombre,
  parts,
  pct,
  positif,
  somme,
  table,
  taux,
  texte,
  ZERO,
  iso,
} from '../noyau';
import { BaremeIs } from './baremes';
import { formulesTaxes } from './taxes';
import { formulesDeclarations } from './declarations';

const M = 'fiscal' as const;

/** IS brut (taux réduit PME + taux normal) — fonction pure. */
export function calculerIs(resultat: Decimal, pme: boolean, dureeMois: number, b: BaremeIs): { reduit: Decimal; normal: Decimal; baseReduite: Decimal } {
  if (!resultat.greaterThan(0) || resultat.isZero()) return { reduit: ZERO, normal: ZERO, baseReduite: ZERO };
  const plafond = d(b.plafondReduit).times(dureeMois).div(12);
  const baseReduite = pme ? min(resultat, plafond) : ZERO;
  return {
    baseReduite,
    reduit: baseReduite.times(pct(b.tauxReduit)),
    normal: resultat.minus(baseReduite).times(pct(b.tauxNormal)),
  };
}

export const impotSocietes = formule({
  id: 'impot-societes',
  moteur: M,
  nom: 'Impôt sur les sociétés',
  categorie: 'Impôt sur les sociétés',
  description:
    'Calcule l’IS au taux réduit PME (15 % jusqu’à 42 500 €, proratisé selon la durée de l’exercice) et au taux normal (25 %), la contribution sociale de 3,3 %, l’imputation des crédits d’impôt et le taux effectif.',
  expression: 'IS = 15 % × min(RF ; 42 500 × d/12) + 25 % × reste ; CSB = 3,3 % × (IS − 763 000) si CA ≥ 7,63 M€ ; IS net = IS + CSB − crédits',
  references: [
    { texte: 'CGI art. 219 I — taux de l’IS et taux réduit des PME' },
    { texte: 'CGI art. 235 ter ZC — contribution sociale sur l’IS' },
    { texte: 'CGI art. 1657 — arrondi à l’euro' },
  ],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de clôture', { defaut: '2024-12-31' }),
    montant('resultatFiscal', 'Résultat fiscal', { defaut: '186000' }),
    montant('ca', 'Chiffre d’affaires HT (ramené à 12 mois)', { defaut: '2400000' }),
    booleen('conditionsCapital', 'Capital entièrement libéré et détenu à 75 % par des personnes physiques', { defaut: true }),
    entier('dureeMois', 'Durée de l’exercice (mois)', { defaut: 12, min: '1', max: '24' }),
    montant('creditsImpot', 'Crédits et réductions d’impôt imputables (CIR, mécénat…)', { defaut: '0' }),
  ],
  exemples: [
    { titre: 'PME 186 000 €', entrees: {}, attendu: { isReduit: '6375', isNormal: '35875', isBrut: '42250', isNet: '42250' } },
    { titre: 'Grande entreprise', entrees: { resultatFiscal: '5000000', ca: '60000000', conditionsCapital: false }, attendu: { isBrut: '1250000', csb: '16071', isNet: '1266071' } },
  ],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const rf: Decimal = e.resultatFiscal;
    if (rf.lessThanOrEqualTo(0)) {
      c.res('isBrut', 'IS brut', 0, 'EUR', { principal: true });
      c.ctrl('info', 'DEFICIT', 'Résultat fiscal nul ou déficitaire : pas d’IS ; le déficit est reportable (voir « Déficits reportables » ou « Carry-back »).');
      return;
    }
    const pme = e.conditionsCapital && d(e.ca).lessThan(b.seuilCaPme);
    c.res('pme', 'Éligible au taux réduit', pme, 'booleen');
    if (!pme && e.conditionsCapital) c.ctrl('info', 'CA_PME', `CA ≥ ${fe(b.seuilCaPme)} : taux réduit non applicable.`);
    const r = calculerIs(rf, pme, e.dureeMois, b);
    const isR = c.calc('isReduit', `IS à ${b.tauxReduit} %`, `${fr(r.baseReduite)} × ${b.tauxReduit} %`, arrondiFiscal(r.reduit), 'EUR', { decimales: 0 });
    const isN = c.calc('isNormal', `IS à ${b.tauxNormal} %`, `${fr(rf.minus(r.baseReduite))} × ${b.tauxNormal} %`, arrondiFiscal(r.normal), 'EUR', { decimales: 0 });
    const brut = c.calc('isBrut', 'IS brut', 'IS réduit + IS normal', isR.plus(isN), 'EUR', { decimales: 0, principal: true });
    const csb = d(e.ca).greaterThanOrEqualTo(b.seuilCaCsb) ? arrondiFiscal(positif(brut.minus(b.abattementCsb)).times(pct(b.tauxCsb))) : ZERO;
    c.calc('csb', 'Contribution sociale de 3,3 %', `3,3 % × max(0 ; ${fr(brut, 0)} − ${fr(b.abattementCsb, 0)})`, csb, 'EUR', { decimales: 0 });
    const imputable = min(e.creditsImpot, brut);
    const net = c.calc('isNet', 'IS net à payer', 'IS brut + CSB − crédits imputés', brut.plus(csb).minus(imputable), 'EUR', { decimales: 0, principal: true });
    if (d(e.creditsImpot).greaterThan(brut)) c.res('creanceCredits', 'Excédent de crédits (créance sur l’État)', d(e.creditsImpot).minus(brut));
    c.calc('tauxEffectif', 'Taux effectif d’imposition', `${fr(net, 0)} / ${fr(rf, 0)}`, net.div(rf), '%');
    c.ecriture('Constatation de l’IS', [
      { compte: '695', intitule: 'Impôts sur les bénéfices', debit: brut.plus(csb) },
      { compte: '444', intitule: 'État — impôt sur les bénéfices', credit: brut.plus(csb) },
    ]);
  },
});

export const acomptesIs = formule({
  id: 'acomptes-is',
  moteur: M,
  nom: 'Acomptes d’IS et de contribution sociale',
  categorie: 'Impôt sur les sociétés',
  description: 'Calcule les quatre acomptes d’IS (et de CSB) à partir de l’impôt de référence, leurs dates d’exigibilité selon la date d’ouverture de l’exercice, et la dispense éventuelle.',
  expression: 'Acompte = IS de référence / 4 (dispense si IS < 3 000 €) ; échéances le 15 des 3e, 6e, 9e et 12e mois',
  references: [
    { texte: 'CGI art. 1668 — acomptes et solde de l’IS' },
    { texte: 'BOI-IS-DECLA-20-10' },
  ],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Ouverture de l’exercice en cours', { defaut: '2025-01-01' }),
    montant('isReference', 'IS de référence (dernier exercice clos, hors CSB)', { defaut: '42250' }),
    montant('csbReference', 'CSB de référence', { defaut: '0' }),
  ],
  exemples: [{ titre: 'Exercice civil 2025', entrees: {}, attendu: { acompte: '10562.50', echeance1: '2025-03-15', echeance4: '2025-12-15' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const ref: Decimal = e.isReference;
    if (ref.lessThan(b.seuilAcomptes)) {
      c.ctrl('ok', 'DISPENSE', `IS de référence < ${fe(b.seuilAcomptes)} : dispense d’acomptes, paiement intégral au solde.`);
      c.res('acompte', 'Acompte trimestriel', 0, 'EUR', { principal: true });
      return;
    }
    const a = c.calc('acompte', 'Acompte d’IS', `${fr(ref)} / 4`, euros(ref.div(4)), 'EUR', { principal: true });
    const acsb = euros(d(e.csbReference).div(4));
    const lignes = [3, 6, 9, 12].map((m, i) => {
      const p = parts(ajouterMois(e.dateOperation, m - 1));
      const ech = iso(p.a, p.m, 15);
      c.res(`echeance${i + 1}`, `Échéance ${i + 1}`, ech, 'date');
      return { numero: String(i + 1), echeance: ech, is: a.toFixed(2), csb: acsb.toFixed(2), total: a.plus(acsb).toFixed(2) };
    });
    c.tableau({
      titre: 'Échéancier des acomptes',
      colonnes: [
        { cle: 'numero', libelle: 'Acompte', unite: 'entier' },
        { cle: 'echeance', libelle: 'Date limite', unite: 'date' },
        { cle: 'is', libelle: 'IS', unite: 'EUR' },
        { cle: 'csb', libelle: 'CSB', unite: 'EUR' },
        { cle: 'total', libelle: 'Total', unite: 'EUR' },
      ],
      lignes,
    });
    c.ctrl('info', 'MODULATION', 'Modulation possible du dernier acompte si l’IS prévisionnel est inférieur aux acomptes versés (tolérance 10 %).');
  },
});

export const soldeIs = formule({
  id: 'solde-is',
  moteur: M,
  nom: 'Solde d’IS (relevé 2572)',
  categorie: 'Impôt sur les sociétés',
  description: 'Détermine le solde à payer ou l’excédent à rembourser après imputation des acomptes et des crédits, et la date limite de paiement.',
  expression: 'Solde = IS dû + CSB − acomptes versés − crédits imputables ; échéance : le 15 du 4e mois suivant la clôture (15 mai pour un exercice civil)',
  references: [{ texte: 'CGI art. 1668 — liquidation du solde' }, { texte: 'Formulaire 2572-SD' }],
  champs: [
    date('cloture', 'Date de clôture', { defaut: '2024-12-31' }),
    montant('isDu', 'IS dû de l’exercice', { defaut: '42250' }),
    montant('csb', 'Contribution sociale', { defaut: '0' }),
    montant('acomptes', 'Acomptes versés', { defaut: '38000' }),
    montant('credits', 'Crédits d’impôt imputables', { defaut: '1200' }),
  ],
  exemples: [{ titre: 'Solde 2024', entrees: {}, attendu: { solde: '3050.00', dateLimite: '2025-05-15' } }],
  calculer(e, c) {
    const s = c.calc('solde', 'Solde', `${fr(e.isDu)} + ${fr(e.csb)} − ${fr(e.acomptes)} − ${fr(e.credits)}`, d(e.isDu).plus(e.csb).minus(e.acomptes).minus(e.credits), 'EUR', { principal: true });
    const p = parts(e.cloture);
    const limite = p.m === 12 && p.j === 31 ? iso(p.a + 1, 5, 15) : (() => { const x = parts(ajouterMois(ajouterJours(e.cloture, 1), 3)); return iso(x.a, x.m, 15); })();
    c.res('dateLimite', 'Date limite de paiement', limite, 'date');
    c.ctrl('info', 'SENS', s.isNegative() ? `Excédent de ${fe(s.neg())} remboursable dans les 30 jours du dépôt du relevé de solde.` : `Solde à payer au plus tard le ${fd(limite)}.`);
  },
});

export const resultatFiscal = formule({
  id: 'resultat-fiscal',
  moteur: M,
  nom: 'Détermination du résultat fiscal (2058-A)',
  categorie: 'Impôt sur les sociétés',
  description:
    'Passe du résultat comptable au résultat fiscal : réintégrations (IS, amendes, TVS, amortissements excédentaires, provisions non déductibles, QPFC…), déductions (dividendes mère-fille, reprises…), imputation des déficits antérieurs dans la limite légale.',
  expression: 'RF = résultat comptable + Σ réintégrations − Σ déductions − déficits imputés [≤ 1 M€ + 50 % × (bénéfice − 1 M€)]',
  references: [
    { texte: 'CGI art. 38 et 39 — bénéfice imposable, charges déductibles' },
    { texte: 'CGI art. 209 I — imputation des déficits' },
    { texte: 'Formulaire 2058-A-SD' },
  ],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de clôture', { defaut: '2024-12-31' }),
    montant('resultatComptable', 'Résultat comptable', { defaut: '152000' }),
    table('reintegrations', 'Réintégrations', [texte('libelle', 'Libellé'), texte('ligne', 'Ligne 2058-A', { optionnel: true }), montant('montant', 'Montant')], {
      defaut: [
        { libelle: 'Impôt sur les sociétés comptabilisé', ligne: 'I7', montant: '38000' },
        { libelle: 'Amendes et pénalités', ligne: 'WJ', montant: '1250' },
        { libelle: 'Taxes annuelles sur véhicules de tourisme', ligne: 'WG', montant: '1820' },
        { libelle: 'Amortissements excédentaires (art. 39-4)', ligne: 'WE', montant: '3950' },
        { libelle: 'Quote-part de frais et charges (dividendes)', ligne: 'WN', montant: '600' },
      ],
    }),
    table('deductions', 'Déductions', [texte('libelle', 'Libellé'), texte('ligne', 'Ligne 2058-A', { optionnel: true }), montant('montant', 'Montant')], {
      defaut: [{ libelle: 'Dividendes régime mère-fille', ligne: 'XA', montant: '12000' }],
    }),
    montant('deficitsAnterieurs', 'Déficits antérieurs reportables', { defaut: '20000' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { resultatAvantDeficits: '185620.00', deficitsImputes: '20000.00', resultatFiscal: '165620.00', deficitsRestants: '0.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    type L = { libelle: string; ligne?: string; montant: Decimal };
    const re = somme((e.reintegrations as L[]).map((x) => x.montant));
    const de = somme((e.deductions as L[]).map((x) => x.montant));
    c.calc('totalReintegrations', 'Total des réintégrations', 'Σ réintégrations', re);
    c.calc('totalDeductions', 'Total des déductions', 'Σ déductions', de);
    const avant = c.calc('resultatAvantDeficits', 'Résultat fiscal avant imputation des déficits', `${fr(e.resultatComptable)} + ${fr(re)} − ${fr(de)}`, d(e.resultatComptable).plus(re).minus(de));
    let imput = ZERO;
    if (avant.greaterThan(0)) {
      const plafond = avant.greaterThan(b.plafondDeficit) ? d(b.plafondDeficit).plus(avant.minus(b.plafondDeficit).times(pct(b.fractionDeficit))) : avant;
      imput = min(e.deficitsAnterieurs, plafond);
      c.etape('Plafond d’imputation', avant.greaterThan(b.plafondDeficit) ? `1 M€ + 50 % × (${fr(avant)} − 1 M€)` : 'bénéfice', plafond, 'EUR');
    }
    c.calc('deficitsImputes', 'Déficits imputés', 'min(stock ; plafond)', imput);
    const rf = c.calc('resultatFiscal', 'Résultat fiscal', `${fr(avant)} − ${fr(imput)}`, avant.minus(imput), 'EUR', { principal: true });
    c.calc('deficitsRestants', 'Déficits restant à reporter', `${fr(e.deficitsAnterieurs)} − ${fr(imput)} ${avant.isNegative() ? '+ déficit de l’exercice' : ''}`, d(e.deficitsAnterieurs).minus(imput).plus(positif(avant.neg())));
    c.tableau({
      titre: 'Tableau 2058-A simplifié',
      colonnes: [
        { cle: 'ligne', libelle: 'Ligne', unite: 'texte' },
        { cle: 'libelle', libelle: 'Libellé', unite: 'texte' },
        { cle: 'reintegration', libelle: 'Réintégration', unite: 'EUR' },
        { cle: 'deduction', libelle: 'Déduction', unite: 'EUR' },
      ],
      lignes: [
        { ligne: 'WA/WB', libelle: 'Résultat comptable', reintegration: d(e.resultatComptable).toFixed(2), deduction: '' },
        ...(e.reintegrations as L[]).map((x) => ({ ligne: x.ligne ?? '', libelle: x.libelle, reintegration: x.montant.toFixed(2), deduction: '' })),
        ...(e.deductions as L[]).map((x) => ({ ligne: x.ligne ?? '', libelle: x.libelle, reintegration: '', deduction: x.montant.toFixed(2) })),
        { ligne: 'XL', libelle: 'Déficits antérieurs imputés', reintegration: '', deduction: imput.toFixed(2) },
        { ligne: 'XN', libelle: 'Résultat fiscal', reintegration: rf.toFixed(2), deduction: '' },
      ],
    });
  },
});

export const deficitsReportables = formule({
  id: 'deficits-reportables',
  moteur: M,
  nom: 'Report en avant des déficits',
  categorie: 'Impôt sur les sociétés',
  description: 'Impute les déficits antérieurs sur le bénéfice de l’exercice dans la limite de 1 M€ majoré de 50 % de la fraction excédentaire, et suit le stock reportable sans limite de durée.',
  expression: 'Imputable = min(stock ; 1 000 000 + 50 % × max(0 ; bénéfice − 1 000 000)) ; nouveau stock = stock − imputé',
  references: [{ texte: 'CGI art. 209 I al. 3 — report en avant' }, { texte: 'BOI-IS-DEF-10-30' }],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de clôture', { defaut: '2024-12-31' }),
    montant('benefice', 'Bénéfice fiscal de l’exercice (avant imputation)', { defaut: '3000000' }),
    montant('stock', 'Stock de déficits reportables', { defaut: '2800000' }),
  ],
  exemples: [{ titre: 'Gros bénéfice', entrees: {}, attendu: { plafond: '2000000.00', impute: '2000000.00', beneficeImposable: '1000000.00', stockRestant: '800000.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const ben: Decimal = e.benefice;
    const plafond = c.calc('plafond', 'Plafond d’imputation', ben.greaterThan(b.plafondDeficit) ? `1 000 000 + 50 % × (${fr(ben)} − 1 000 000)` : 'bénéfice', ben.greaterThan(b.plafondDeficit) ? d(b.plafondDeficit).plus(ben.minus(b.plafondDeficit).times(pct(b.fractionDeficit))) : positif(ben));
    const imp = c.calc('impute', 'Déficits imputés', `min(${fr(e.stock)} ; ${fr(plafond)})`, min(e.stock, plafond));
    c.calc('beneficeImposable', 'Bénéfice imposable', `${fr(ben)} − ${fr(imp)}`, ben.minus(imp), 'EUR', { principal: true });
    c.calc('stockRestant', 'Stock restant reportable', `${fr(e.stock)} − ${fr(imp)}`, d(e.stock).minus(imp));
  },
});

export const carryBack = formule({
  id: 'carry-back',
  moteur: M,
  nom: 'Report en arrière (carry-back)',
  categorie: 'Impôt sur les sociétés',
  description: 'Option pour imputer le déficit sur le bénéfice de l’exercice précédent, dans la limite de 1 M€ et du bénéfice non distribué : génère une créance remboursable au bout de 5 ans.',
  expression: 'Imputable = min(déficit ; bénéfice N−1 non distribué ; 1 000 000) ; créance = imputable × taux normal',
  references: [{ texte: 'CGI art. 220 quinquies — report en arrière des déficits' }, { texte: 'BOI-IS-DEF-20' }],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de clôture de l’exercice déficitaire', { defaut: '2024-12-31' }),
    montant('deficit', 'Déficit de l’exercice', { defaut: '450000' }),
    montant('beneficeN1', 'Bénéfice de l’exercice précédent', { defaut: '380000' }),
    montant('distribue', 'Bénéfice N−1 distribué', { defaut: '50000' }),
  ],
  exemples: [{ titre: 'Déficit 450 k€', entrees: {}, attendu: { imputable: '330000.00', creance: '82500.00', solde: '120000.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const base = positif(d(e.beneficeN1).minus(e.distribue));
    const imp = c.calc('imputable', 'Déficit reporté en arrière', `min(${fr(e.deficit)} ; ${fr(base)} ; 1 000 000)`, min(e.deficit, base, b.plafondCarryBack));
    c.calc('creance', 'Créance de carry-back', `${fr(imp)} × ${b.tauxNormal} %`, euros(imp.times(pct(b.tauxNormal))), 'EUR', { principal: true });
    c.calc('solde', 'Déficit restant reportable en avant', `${fr(e.deficit)} − ${fr(imp)}`, d(e.deficit).minus(imp));
    c.ecriture('Constatation de la créance de carry-back', [
      { compte: '444', intitule: 'État — créance de report en arrière', debit: euros(imp.times(pct(b.tauxNormal))) },
      { compte: '699', intitule: 'Produits — report en arrière des déficits', credit: euros(imp.times(pct(b.tauxNormal))) },
    ]);
    c.ctrl('info', 'DELAI', 'Créance imputable sur l’IS des 5 exercices suivants, remboursable ensuite (mobilisable auprès d’un établissement de crédit).');
  },
});

export const mereFille = formule({
  id: 'regime-mere-fille',
  moteur: M,
  nom: 'Régime des sociétés mères',
  categorie: 'Groupes',
  description: 'Vérifie les conditions du régime mère-fille et calcule l’exonération des dividendes, la quote-part de frais et charges réintégrée et l’économie d’impôt.',
  expression: 'Déduction = dividendes ; réintégration QPFC = 5 % (1 % en groupe intégré / UE équivalent) × dividendes',
  references: [
    { texte: 'CGI art. 145 — conditions (5 % du capital, conservation 2 ans)' },
    { texte: 'CGI art. 216 — quote-part de frais et charges' },
  ],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de perception', { defaut: '2024-06-30' }),
    montant('dividendes', 'Dividendes perçus', { defaut: '120000' }),
    taux('detention', 'Pourcentage de détention', { defaut: '35', min: '0', max: '100' }),
    booleen('conservation2ans', 'Titres détenus (ou engagement de conservation) depuis 2 ans', { defaut: true }),
    booleen('groupeIntegre', 'Filiale membre du même groupe intégré (ou équivalent UE)'),
  ],
  exemples: [
    { titre: 'Filiale à 35 %', entrees: {}, attendu: { deduction: '120000.00', qpfc: '6000.00', economieIs: '28500.00' } },
    { titre: 'Groupe intégré', entrees: { groupeIntegre: true }, attendu: { qpfc: '1200.00' } },
  ],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const ok = d(e.detention).greaterThanOrEqualTo('0.05') && e.conservation2ans;
    c.res('eligible', 'Éligible au régime mère-fille', ok, 'booleen');
    if (!ok) {
      c.ctrl('avertissement', 'NON_ELIGIBLE', 'Conditions non remplies (≥ 5 % et conservation 2 ans) : dividendes imposables au taux normal.');
      c.res('deduction', 'Déduction', 0, 'EUR', { principal: true });
      c.calc('isDividendes', 'IS sur les dividendes', `${fr(e.dividendes)} × ${b.tauxNormal} %`, euros(d(e.dividendes).times(pct(b.tauxNormal))));
      return;
    }
    const div: Decimal = e.dividendes;
    const q = e.groupeIntegre ? b.qpfcDividendesGroupe : b.qpfcDividendes;
    c.calc('deduction', 'Déduction extra-comptable (2058-A ligne XA)', 'dividendes', div, 'EUR', { principal: true });
    const qp = c.calc('qpfc', 'Quote-part de frais et charges réintégrée', `${fr(div)} × ${q} %`, euros(div.times(pct(q))));
    c.calc('economieIs', 'Économie d’IS', `(${fr(div)} − ${fr(qp)}) × ${b.tauxNormal} %`, euros(div.minus(qp).times(pct(b.tauxNormal))));
    c.calc('tauxEffectif', 'Taux effectif d’imposition des dividendes', `${q} % × ${b.tauxNormal} %`, pct(q).times(pct(b.tauxNormal)), '%');
  },
});

export const integrationFiscale = formule({
  id: 'integration-fiscale',
  moteur: M,
  nom: 'Intégration fiscale : résultat d’ensemble',
  categorie: 'Groupes',
  description: 'Somme les résultats fiscaux des sociétés du groupe (≥ 95 % de détention), applique les neutralisations, calcule l’IS du groupe et l’économie d’intégration par rapport à une imposition séparée.',
  expression: 'Résultat d’ensemble = Σ résultats fiscaux + rectifications ; économie = Σ IS individuels − IS du groupe',
  references: [{ texte: 'CGI art. 223 A à 223 U — régime de groupe' }, { texte: 'Formulaires 2058-A-SD à 2058-ES' }],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de clôture', { defaut: '2024-12-31' }),
    table('societes', 'Sociétés du groupe', [texte('societe', 'Société'), montant('resultat', 'Résultat fiscal propre'), taux('detention', 'Détention par la mère', { defaut: '100' })], {
      min: '1',
      defaut: [
        { societe: 'Holding (tête de groupe)', resultat: '-120000', detention: '100' },
        { societe: 'Filiale industrielle', resultat: '640000', detention: '100' },
        { societe: 'Filiale commerciale', resultat: '-85000', detention: '98' },
        { societe: 'Filiale services', resultat: '210000', detention: '95' },
      ],
    }),
    montant('neutralisations', 'Rectifications (neutralisations intragroupe, ±)', { defaut: '-15000' }),
    booleen('pme', 'Taux réduit applicable au groupe'),
  ],
  exemples: [{ titre: 'Groupe de 4 sociétés', entrees: {}, attendu: { resultatEnsemble: '630000.00', isGroupe: '157500', economie: '55000' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    type S = { societe: string; resultat: Decimal; detention: Decimal };
    const ss = e.societes as S[];
    ss.filter((s) => s.detention.lessThan('0.95')).forEach((s) => c.ctrl('erreur', 'PERIMETRE', `${s.societe} : détention < 95 %, exclue du périmètre d’intégration.`));
    const membres = ss.filter((s) => s.detention.greaterThanOrEqualTo('0.95'));
    const ens = c.calc('resultatEnsemble', 'Résultat d’ensemble', 'Σ résultats + rectifications', somme(membres.map((s) => s.resultat)).plus(e.neutralisations), 'EUR', { principal: true });
    const isG = calculerIs(ens, e.pme, 12, b);
    const isGroupe = c.calc('isGroupe', 'IS du groupe', 'barème appliqué au résultat d’ensemble', arrondiFiscal(isG.reduit.plus(isG.normal)), 'EUR', { decimales: 0, principal: true });
    const lignes = membres.map((s) => {
      const i = calculerIs(s.resultat, e.pme, 12, b);
      const v = arrondiFiscal(i.reduit.plus(i.normal));
      return { societe: s.societe, resultat: s.resultat.toFixed(2), isIndividuel: v.toFixed(0) };
    });
    const sep = somme(lignes.map((l) => l.isIndividuel));
    c.calc('isSepare', 'Σ IS en imposition séparée', 'Σ IS individuels', sep, 'EUR', { decimales: 0 });
    c.calc('economie', 'Économie d’intégration', `${fr(sep, 0)} − ${fr(isGroupe, 0)}`, sep.minus(isGroupe), 'EUR', { decimales: 0 });
    c.tableau({
      titre: 'Contributions au résultat d’ensemble',
      colonnes: [
        { cle: 'societe', libelle: 'Société', unite: 'texte' },
        { cle: 'resultat', libelle: 'Résultat fiscal', unite: 'EUR' },
        { cle: 'isIndividuel', libelle: 'IS si imposition séparée', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'societe', series: ['resultat'] },
    });
  },
});

export const plusValuesIs = formule({
  id: 'plus-values-is',
  moteur: M,
  nom: 'Plus-values de cession à l’IS',
  categorie: 'Impôt sur les sociétés',
  description: 'Régime des plus-values selon la nature de l’actif : titres de participation (taux 0 % avec QPFC de 12 %), produits de brevets (10 %), autres actifs (taux normal).',
  expression: 'Titres de participation : IS = PV × 12 % × taux normal ; brevets : PV × 10 % ; autres : PV × taux normal',
  references: [
    { texte: 'CGI art. 219 I a quinquies — titres de participation' },
    { texte: 'CGI art. 238 — régime des brevets (taux de 10 %)' },
    { texte: 'CGI art. 39 duodecies et 219 I a — autres plus-values' },
  ],
  baremes: ['fiscal.is'],
  champs: [
    dateOperation('Date de cession', { defaut: '2024-09-30' }),
    choix('nature', 'Nature de l’actif', [
      ['titres-participation', 'Titres de participation détenus ≥ 2 ans'],
      ['brevets', 'Brevets et assimilés (cession / concession)'],
      ['autres', 'Autres actifs (taux normal)'],
    ]),
    montant('prixCession', 'Prix de cession', { defaut: '900000' }),
    montant('valeurFiscale', 'Valeur fiscale (prix de revient ou VNC fiscale)', { defaut: '400000' }),
  ],
  exemples: [
    { titre: 'Cession de participation', entrees: {}, attendu: { plusValue: '500000.00', baseImposable: '60000.00', impot: '15000.00' } },
    { titre: 'Brevet', entrees: { nature: 'brevets' }, attendu: { impot: '50000.00' } },
  ],
  calculer(e, c) {
    const b = c.bareme<BaremeIs>('fiscal.is', e.dateOperation);
    const pv = c.calc('plusValue', 'Plus-value fiscale', `${fr(e.prixCession)} − ${fr(e.valeurFiscale)}`, d(e.prixCession).minus(e.valeurFiscale));
    if (pv.isNegative()) {
      c.ctrl('info', 'MOINS_VALUE', e.nature === 'titres-participation' ? 'Moins-value LT sur titres de participation : non déductible (taux 0 %).' : 'Moins-value déductible du résultat imposable au taux normal.');
      c.res('impot', 'Impôt', 0, 'EUR', { principal: true });
      return;
    }
    let base: Decimal;
    let impot: Decimal;
    if (e.nature === 'titres-participation') {
      base = c.calc('baseImposable', 'Quote-part imposable (12 %)', `${fr(pv)} × ${b.qpfcPvTitres} %`, euros(pv.times(pct(b.qpfcPvTitres))));
      impot = euros(base.times(pct(b.tauxNormal)));
    } else if (e.nature === 'brevets') {
      base = c.calc('baseImposable', 'Base imposable', 'plus-value nette', pv);
      impot = euros(pv.times(pct(b.tauxBrevets)));
    } else {
      base = c.calc('baseImposable', 'Base imposable', 'plus-value', pv);
      impot = euros(pv.times(pct(b.tauxNormal)));
    }
    c.calc('impot', 'Impôt sur la plus-value', 'base × taux', impot, 'EUR', { principal: true });
    c.calc('tauxEffectif', 'Taux effectif', `${fr(impot)} / ${fr(pv)}`, impot.div(pv), '%');
  },
});

export const formulesFiscal = [
  impotSocietes,
  acomptesIs,
  soldeIs,
  resultatFiscal,
  deficitsReportables,
  carryBack,
  mereFille,
  integrationFiscale,
  plusValuesIs,
  ...formulesTaxes,
  ...formulesDeclarations,
];

