/**
 * MOTEUR 3 — Amortissements : linéaire, dégressif, unités d'œuvre, composants,
 * dérogatoires, cessions, véhicules de tourisme, incorporels, crédit-bail.
 */
import {
  ajouterJours,
  annuiteConstante,
  bareme,
  booleen,
  choix,
  comparer,
  Contexte,
  d,
  date,
  Decimal,
  entier,
  euros,
  fd,
  formule,
  fp,
  fr,
  frn,
  joursFiscaux360,
  liste,
  montant,
  nombre,
  parts,
  positif,
  somme,
  table,
  taux,
  texte,
  tri,
  UN,
  ZERO,
  anciennete,
} from '../noyau';
import { cloture, COLONNES_PLAN, coefficientDegressif, LignePlan, lignesTableau, planDegressif, planLineaire, Prorata } from './plans';

const M = 'amortissements' as const;

const champProrata = choix('prorata', 'Prorata temporis', [
  ['jours360', 'Jours (mois de 30 j / 360) — usage fiscal'],
  ['joursReels', 'Jours réels'],
  ['mois', 'Mois entamés'],
  ['aucun', 'Aucun (année pleine)'],
]);

const REF_PCG_AMORT = { texte: 'PCG art. 214-13 et 214-14 — plan d’amortissement' };

function publierPlan(c: Contexte, titre: string, plan: LignePlan[], avecMode = false): void {
  c.tableau({
    titre,
    colonnes: avecMode ? [...COLONNES_PLAN, { cle: 'mode', libelle: 'Mode', unite: 'texte' as const }] : COLONNES_PLAN,
    lignes: lignesTableau(plan),
    totaux: { rang: 'Total', dotation: somme(plan.map((l) => l.dotation)).toFixed(2) },
    graphique: { type: 'barres', x: 'rang', series: ['dotation', 'vnc'] },
  });
}

function controlerPlan(c: Contexte, plan: LignePlan[], base: Decimal): void {
  const total = somme(plan.map((l) => l.dotation));
  c.verifier(
    total.equals(base),
    'CUMUL_AMORTISSEMENTS',
    `Cohérence : le cumul des dotations (${fr(total)}) égale la base amortissable.`,
    `Le cumul des dotations (${fr(total)}) diffère de la base amortissable (${fr(base)}).`,
  );
}

export const lineaire = formule({
  id: 'lineaire',
  moteur: M,
  nom: 'Amortissement linéaire',
  categorie: 'Modes d’amortissement',
  description: 'Plan d’amortissement linéaire complet avec valeur résiduelle et prorata temporis la première année ; la dernière annuité solde exactement la base.',
  expression: 'Annuité = (VO − VR) / n ; 1re annuité × jours / 360 ; VNC = VO − cumul',
  references: [REF_PCG_AMORT, { texte: 'CGI art. 39-1-2° — amortissements déductibles' }, { texte: 'BOI-BIC-AMT-20-20-10 — prorata temporis' }],
  champs: [
    montant('vo', 'Valeur d’origine (HT)', { defaut: '24000' }),
    montant('vr', 'Valeur résiduelle', { defaut: '0', min: '0' }),
    nombre('duree', 'Durée d’utilisation (années)', { defaut: '5', min: '0.0001' }),
    date('miseEnService', 'Date de mise en service', { defaut: '2024-04-15' }),
    date('premiereCloture', 'Date de clôture du 1er exercice', { defaut: '2024-12-31' }),
    champProrata,
  ],
  exemples: [
    { titre: '24 000 € sur 5 ans, 15/04', entrees: {}, attendu: { annuite: '4800.00', dotation1: '3413.33', nbExercices: '6', totalDotations: '24000.00' } },
    { titre: 'Année pleine', entrees: { miseEnService: '2024-01-01' }, attendu: { dotation1: '4800.00', nbExercices: '5' } },
  ],
  calculer(e, c) {
    const base = c.calc('base', 'Base amortissable', `${fr(e.vo)} − ${fr(e.vr)}`, d(e.vo).minus(e.vr));
    if (!base.greaterThan(0) || base.isZero()) {
      c.ctrl('erreur', 'BASE_NULLE', 'Base amortissable nulle ou négative.');
      return;
    }
    if (comparer(e.premiereCloture, e.miseEnService) < 0) {
      c.ctrl('erreur', 'DATES', 'La clôture doit suivre la mise en service.');
      return;
    }
    c.calc('taux', 'Taux linéaire', `1 / ${frn(e.duree)}`, UN.div(e.duree), '%');
    c.calc('annuite', 'Annuité pleine', `${fr(base)} / ${frn(e.duree)}`, euros(base.div(e.duree)), 'EUR', { principal: true });
    const plan = planLineaire(e.vo, e.vr, e.duree, e.miseEnService, e.premiereCloture, e.prorata as Prorata);
    if (e.prorata === 'jours360') c.etape('Jours du 1er exercice', `du ${fd(e.miseEnService)} au ${fd(e.premiereCloture)} (mois de 30 j)`, d(joursFiscaux360(e.miseEnService, e.premiereCloture)), 'jours');
    c.calc('dotation1', 'Dotation du 1er exercice', 'annuité × prorata', plan[0].dotation);
    c.res('nbExercices', 'Nombre d’exercices', plan.length, 'entier');
    c.res('totalDotations', 'Total des dotations', somme(plan.map((l) => l.dotation)));
    publierPlan(c, 'Plan d’amortissement linéaire', plan);
    controlerPlan(c, plan, base);
    c.ecriture('Dotation du 1er exercice', [
      { compte: '68112', intitule: 'Dotations aux amortissements des immobilisations corporelles', debit: plan[0].dotation },
      { compte: '2815', intitule: 'Amortissements des installations', credit: plan[0].dotation },
    ]);
  },
});

export const degressif = formule({
  id: 'degressif',
  moteur: M,
  nom: 'Amortissement dégressif fiscal',
  categorie: 'Modes d’amortissement',
  description: 'Plan dégressif : taux linéaire × coefficient (1,25 / 1,75 / 2,25 selon la durée), prorata en mois dès le mois d’acquisition, bascule automatique en linéaire sur la durée restante.',
  expression: 'Taux = (1/n) × coef ; annuité = VNC × taux ; bascule quand VNC / années restantes ≥ VNC × taux',
  references: [
    { texte: 'CGI art. 39 A — amortissement dégressif' },
    { texte: 'CGI ann. II art. 15 bis — coefficients et biens éligibles' },
    { texte: 'BOI-BIC-AMT-20-20-20' },
  ],
  champs: [
    montant('vo', 'Valeur d’origine (HT)', { defaut: '10000' }),
    entier('duree', 'Durée (années, ≥ 3)', { defaut: 5, min: '3', max: '50' }),
    date('acquisition', 'Date d’acquisition', { defaut: '2024-04-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
    booleen('coefficientManuel', 'Forcer le coefficient'),
    nombre('coefficient', 'Coefficient', { defaut: '1.75', visibleSi: { champ: 'coefficientManuel', valeurs: [true] } }),
  ],
  exemples: [
    {
      titre: 'Manuel BOFiP-type : 10 000 €, 5 ans, 01/04',
      entrees: {},
      attendu: { taux: '35.00', dotation1: '2625.00', dotation2: '2581.25', dotation3: '1677.81', dotation4: '1557.97', dotation5: '1557.97', rangBascule: '4' },
      source: 'Calcul manuel conforme BOI-BIC-AMT-20-20-20-20',
    },
  ],
  calculer(e, c) {
    const coef: Decimal = e.coefficientManuel ? e.coefficient : coefficientDegressif(e.duree);
    c.etape('Coefficient', `durée ${e.duree} ans → ${frn(coef)}`, coef, 'nombre');
    const tx = c.calc('taux', 'Taux dégressif', `1/${e.duree} × ${frn(coef)}`, UN.div(e.duree).times(coef), '%', { principal: true });
    const plan = planDegressif(e.vo, e.duree, e.acquisition, e.premiereCloture, coef);
    c.etape('Prorata 1er exercice', `mois du ${fd(e.acquisition)} à la clôture / 12`, d(parts(e.acquisition).m <= parts(e.premiereCloture).m ? parts(e.premiereCloture).m - parts(e.acquisition).m + 1 : 12), 'mois');
    plan.forEach((l) => c.res(`dotation${l.rang}`, `Dotation exercice ${l.rang}`, l.dotation));
    const b = plan.find((l) => l.mode === 'Linéaire');
    c.res('rangBascule', 'Exercice de bascule en linéaire', b ? b.rang : 0, 'entier');
    publierPlan(c, 'Plan d’amortissement dégressif', plan, true);
    controlerPlan(c, plan, d(e.vo));
    if (tx.isZero()) c.ctrl('erreur', 'NON_ELIGIBLE', 'Durée < 3 ans : le dégressif n’est pas applicable.');
  },
});

export const unitesOeuvre = formule({
  id: 'unites-oeuvre',
  moteur: M,
  nom: 'Amortissement par unités d’œuvre',
  categorie: 'Modes d’amortissement',
  description: 'Amortissement variable en fonction de l’utilisation (kilomètres, heures machine, pièces produites).',
  expression: 'Dotation = (VO − VR) × unités de l’exercice / unités totales prévues',
  references: [REF_PCG_AMORT, { texte: 'PCG art. 214-13 — mode reflétant le rythme de consommation des avantages' }],
  champs: [
    montant('vo', 'Valeur d’origine', { defaut: '180000' }),
    montant('vr', 'Valeur résiduelle', { defaut: '20000' }),
    nombre('unitesTotales', 'Unités d’œuvre totales prévues', { defaut: '400000', min: '1' }),
    liste('unitesAnnuelles', 'Unités consommées par exercice', { min: '1', defaut: ['65000', '90000', '110000', '85000', '50000'] }),
  ],
  exemples: [{ titre: 'Machine 400 000 pièces', entrees: {}, attendu: { coutUnitaire: '0.4', dotation1: '26000.00', totalDotations: '160000.00' } }],
  calculer(e, c) {
    const base = d(e.vo).minus(e.vr);
    const cu = c.calc('coutUnitaire', 'Coût par unité d’œuvre', `${fr(base)} / ${frn(e.unitesTotales)}`, base.div(e.unitesTotales), 'nombre');
    const u = e.unitesAnnuelles as Decimal[];
    let cumul = ZERO;
    const lignes = u.map((x, i) => {
      let dot = euros(x.times(cu));
      if (cumul.plus(dot).greaterThan(base)) dot = base.minus(cumul);
      cumul = cumul.plus(dot);
      c.res(`dotation${i + 1}`, `Dotation exercice ${i + 1}`, dot);
      return { rang: String(i + 1), unites: x.toFixed(), dotation: dot.toFixed(2), cumul: cumul.toFixed(2), vnc: d(e.vo).minus(cumul).toFixed(2) };
    });
    c.res('totalDotations', 'Total des dotations', cumul, 'EUR', { principal: true });
    const totalU = somme(u);
    if (totalU.greaterThan(e.unitesTotales)) c.ctrl('avertissement', 'DEPASSEMENT_UO', 'Les unités consommées dépassent les unités prévues : dotations plafonnées à la base amortissable.');
    else if (totalU.lessThan(e.unitesTotales)) c.ctrl('info', 'PLAN_INCOMPLET', `Reste ${frn(d(e.unitesTotales).minus(totalU))} unités à consommer.`);
    c.tableau({
      titre: 'Plan par unités d’œuvre',
      colonnes: [
        { cle: 'rang', libelle: 'Exercice', unite: 'entier' },
        { cle: 'unites', libelle: 'Unités', unite: 'nombre' },
        { cle: 'dotation', libelle: 'Dotation', unite: 'EUR' },
        { cle: 'cumul', libelle: 'Cumul', unite: 'EUR' },
        { cle: 'vnc', libelle: 'VNC', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'rang', series: ['dotation'] },
    });
  },
});

export const composants = formule({
  id: 'composants',
  moteur: M,
  nom: 'Amortissement par composants',
  categorie: 'Modes d’amortissement',
  description: 'Décompose une immobilisation en structure et composants ayant des durées distinctes ; chaque composant suit son propre plan linéaire, les dotations sont consolidées par exercice.',
  expression: 'Structure = VO − Σ composants ; dotation(N) = Σ dotations linéaires des composants',
  references: [
    { texte: 'PCG art. 214-9 — approche par composants' },
    { texte: 'BOI-BIC-AMT-10-40-10' },
  ],
  champs: [
    montant('vo', 'Valeur d’origine totale', { defaut: '850000' }),
    nombre('dureeStructure', 'Durée de la structure (années)', { defaut: '40' }),
    date('miseEnService', 'Mise en service', { defaut: '2024-07-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
    table('composants', 'Composants', [texte('libelle', 'Composant'), montant('valeur', 'Valeur'), nombre('duree', 'Durée (années)')], {
      defaut: [
        { libelle: 'Toiture', valeur: '120000', duree: '25' },
        { libelle: 'Installations électriques', valeur: '85000', duree: '20' },
        { libelle: 'Chauffage / climatisation', valeur: '65000', duree: '15' },
        { libelle: 'Agencements', valeur: '40000', duree: '10' },
      ],
    }),
  ],
  exemples: [{ titre: 'Immeuble de bureaux', entrees: {}, attendu: { structure: '540000.00', dotation1: '15441.67', dotation2: '30883.33' } }],
  calculer(e, c) {
    type Co = { libelle: string; valeur: Decimal; duree: Decimal };
    const comps = e.composants as Co[];
    const sc = somme(comps.map((x) => x.valeur));
    const structure = c.calc('structure', 'Structure (VO − composants)', `${fr(e.vo)} − ${fr(sc)}`, d(e.vo).minus(sc));
    if (structure.isNegative()) {
      c.ctrl('erreur', 'COMPOSANTS_EXCESSIFS', 'La somme des composants dépasse la valeur d’origine.');
      return;
    }
    const tous: Co[] = [{ libelle: 'Structure', valeur: structure, duree: e.dureeStructure }, ...comps];
    const plans = tous.map((x) => planLineaire(x.valeur, 0, x.duree, e.miseEnService, e.premiereCloture, 'jours360'));
    const nb = Math.max(...plans.map((p) => p.length));
    const lignes: Record<string, string>[] = [];
    for (let r = 1; r <= nb; r++) {
      const ligne: Record<string, string> = { rang: String(r), cloture: cloture(e.premiereCloture, r) };
      let tot = ZERO;
      tous.forEach((x, i) => {
        const dot = plans[i][r - 1]?.dotation ?? ZERO;
        ligne[`c${i}`] = dot.toFixed(2);
        tot = tot.plus(dot);
      });
      ligne.total = tot.toFixed(2);
      lignes.push(ligne);
      if (r <= 3) c.res(`dotation${r}`, `Dotation totale exercice ${r}`, tot, 'EUR', { principal: r === 2 });
    }
    tous.forEach((x) => c.etape(`Annuité — ${x.libelle}`, `${fr(x.valeur)} / ${frn(x.duree)}`, euros(x.valeur.div(x.duree)), 'EUR'));
    c.tableau({
      titre: 'Dotations par composant',
      colonnes: [
        { cle: 'rang', libelle: 'Exercice', unite: 'entier' },
        { cle: 'cloture', libelle: 'Clôture', unite: 'date' },
        ...tous.map((x, i) => ({ cle: `c${i}`, libelle: x.libelle, unite: 'EUR' as const })),
        { cle: 'total', libelle: 'Total', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres-empilees', x: 'rang', series: tous.map((_, i) => `c${i}`) },
    });
    controlerPlan(c, plans.flat(), d(e.vo));
  },
});

/** Tableau des amortissements dérogatoires à partir d'un plan comptable et d'un plan fiscal. */
function tableauDerogatoire(c: Contexte, comptable: LignePlan[], fiscal: LignePlan[], premiereCloture: string): void {
  const nb = Math.max(comptable.length, fiscal.length);
  let solde = ZERO;
  const lignes: Record<string, string>[] = [];
  for (let r = 1; r <= nb; r++) {
    const ac = comptable[r - 1]?.dotation ?? ZERO;
    const af = fiscal[r - 1]?.dotation ?? ZERO;
    const ecart = af.minus(ac);
    solde = solde.plus(ecart);
    lignes.push({
      rang: String(r),
      cloture: cloture(premiereCloture, r),
      comptable: ac.toFixed(2),
      fiscal: af.toFixed(2),
      dotation: positif(ecart).toFixed(2),
      reprise: positif(ecart.neg()).toFixed(2),
      solde: solde.toFixed(2),
    });
    if (r === 1) {
      c.res('derogatoire1', 'Dotation dérogatoire exercice 1', positif(ecart), 'EUR', { principal: true });
      if (ecart.greaterThan(0))
        c.ecriture('Amortissement dérogatoire — exercice 1', [
          { compte: '68725', intitule: 'Dotations aux amortissements dérogatoires', debit: ecart },
          { compte: '145', intitule: 'Amortissements dérogatoires', credit: ecart },
        ]);
    }
  }
  c.verifier(solde.isZero(), 'SOLDE_DEROGATOIRE', 'Le compte 145 est soldé en fin de plan.', `Le compte 145 n’est pas soldé en fin de plan (${fr(solde)}).`, 'avertissement');
  c.tableau({
    titre: 'Amortissements dérogatoires',
    colonnes: [
      { cle: 'rang', libelle: 'Exercice', unite: 'entier' },
      { cle: 'cloture', libelle: 'Clôture', unite: 'date' },
      { cle: 'comptable', libelle: 'Amort. comptable', unite: 'EUR' },
      { cle: 'fiscal', libelle: 'Amort. fiscal', unite: 'EUR' },
      { cle: 'dotation', libelle: 'Dotation 6872', unite: 'EUR' },
      { cle: 'reprise', libelle: 'Reprise 7872', unite: 'EUR' },
      { cle: 'solde', libelle: 'Solde 145', unite: 'EUR' },
    ],
    lignes,
    graphique: { type: 'lignes', x: 'rang', series: ['comptable', 'fiscal', 'solde'] },
  });
}

export const derogatoire = formule({
  id: 'derogatoire',
  moteur: M,
  nom: 'Amortissements dérogatoires',
  categorie: 'Écarts comptable / fiscal',
  description: 'Compare le plan comptable (durée d’usage, linéaire) au plan fiscal (dégressif ou durée d’usage fiscale) et calcule les dotations et reprises dérogatoires année par année.',
  expression: 'Dérogatoire(N) = amortissement fiscal(N) − amortissement comptable(N) ; > 0 : dotation 6872 / 145 ; < 0 : reprise 145 / 7872',
  references: [
    { texte: 'PCG art. 214-17 — amortissements dérogatoires' },
    { texte: 'CGI art. 39 B — obligation d’amortissement minimal' },
    { texte: 'PCG art. 941-14 — compte 145' },
  ],
  champs: [
    montant('vo', 'Valeur d’origine', { defaut: '50000' }),
    date('acquisition', 'Acquisition / mise en service', { defaut: '2024-01-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
    nombre('dureeComptable', 'Durée comptable (usage réel)', { defaut: '8' }),
    choix('modeFiscal', 'Plan fiscal', [
      ['degressif', 'Dégressif'],
      ['lineaire', 'Linéaire sur la durée d’usage fiscale'],
    ]),
    entier('dureeFiscale', 'Durée fiscale (années)', { defaut: 5, min: '1' }),
  ],
  exemples: [{ titre: 'Linéaire 8 ans / dégressif 5 ans', entrees: {}, attendu: { derogatoire1: '11250.00' } }],
  calculer(e, c) {
    const comptable = planLineaire(e.vo, 0, e.dureeComptable, e.acquisition, e.premiereCloture, 'jours360');
    const fiscal =
      e.modeFiscal === 'degressif'
        ? planDegressif(e.vo, e.dureeFiscale, e.acquisition, e.premiereCloture)
        : planLineaire(e.vo, 0, e.dureeFiscale, e.acquisition, e.premiereCloture, 'jours360');
    c.etape('Amortissement comptable exercice 1', `plan linéaire ${frn(e.dureeComptable)} ans`, comptable[0].dotation, 'EUR');
    c.etape('Amortissement fiscal exercice 1', `plan ${e.modeFiscal} ${e.dureeFiscale} ans`, fiscal[0].dotation, 'EUR');
    tableauDerogatoire(c, comptable, fiscal, e.premiereCloture);
    if (d(e.dureeComptable).lessThan(e.dureeFiscale) && e.modeFiscal === 'lineaire')
      c.ctrl('avertissement', 'AMORT_EXCEDENTAIRE', 'Durée comptable plus courte que la durée fiscale : l’excédent d’amortissement est à réintégrer extra-comptablement (2058-A, ligne WE).');
  },
});

export const cession = formule({
  id: 'cession',
  moteur: M,
  nom: 'Cession d’immobilisation : dotation complémentaire et plus-value',
  categorie: 'Cessions',
  description:
    'Calcule la dotation complémentaire de l’exercice de cession, le cumul des amortissements, la VNC, la plus ou moins-value comptable et sa ventilation fiscale court terme / long terme, avec les écritures de sortie.',
  expression: 'VNC = VO − Σ amortissements ; PV = prix de cession − VNC ; PV CT = min(PV, amortissements) si détention ≥ 2 ans',
  references: [
    { texte: 'PCG art. 214-19 — sortie d’actif' },
    { texte: 'CGI art. 39 duodecies — plus-values à court et long terme' },
    { texte: 'PCG art. 946-67 et 947-77 — comptes 675 et 775' },
  ],
  champs: [
    montant('vo', 'Valeur d’origine', { defaut: '24000' }),
    nombre('duree', 'Durée d’amortissement (années)', { defaut: '5' }),
    date('miseEnService', 'Mise en service', { defaut: '2022-07-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2022-12-31' }),
    date('dateCession', 'Date de cession', { defaut: '2025-03-31' }),
    montant('prixCession', 'Prix de cession HT', { defaut: '12500' }),
    montant('derogatoiresCumules', 'Amortissements dérogatoires cumulés (145)', { defaut: '0' }),
  ],
  exemples: [
    {
      titre: 'Cession après 2 ans 9 mois',
      entrees: {},
      attendu: { dotationComplementaire: '1200.00', cumulAmortissements: '13200.00', vnc: '10800.00', plusValue: '1700.00', pvCourtTerme: '1700.00', pvLongTerme: '0.00' },
    },
  ],
  calculer(e, c) {
    const plan = planLineaire(e.vo, 0, e.duree, e.miseEnService, e.premiereCloture, 'jours360');
    const cessionDate: string = e.dateCession;
    const anterieures = plan.filter((l) => comparer(l.cloture, cessionDate) < 0);
    const cumulAnterieur = anterieures.length ? anterieures[anterieures.length - 1].cumul : ZERO;
    const ligneEx = plan.find((l) => comparer(l.cloture, cessionDate) >= 0);
    let compl = ZERO;
    if (ligneEx) {
      const debutEx = anterieures.length ? ajouterJours(anterieures[anterieures.length - 1].cloture, 1) : e.miseEnService;
      const jours = joursFiscaux360(debutEx, cessionDate);
      const annuite = d(e.vo).div(e.duree);
      compl = euros(Decimal.min(annuite.times(jours).div(360), d(e.vo).minus(cumulAnterieur)));
      c.etape('Jours de l’exercice de cession', `du ${fd(debutEx)} au ${fd(cessionDate)} (30/360)`, d(jours), 'jours');
    }
    c.calc('dotationComplementaire', 'Dotation complémentaire', 'annuité × jours / 360', compl);
    const cumul = c.calc('cumulAmortissements', 'Cumul des amortissements', `${fr(cumulAnterieur)} + ${fr(compl)}`, cumulAnterieur.plus(compl));
    const vnc = c.calc('vnc', 'Valeur nette comptable', `${fr(e.vo)} − ${fr(cumul)}`, d(e.vo).minus(cumul));
    const pv = c.calc('plusValue', 'Plus ou moins-value comptable', `${fr(e.prixCession)} − ${fr(vnc)}`, d(e.prixCession).minus(vnc), 'EUR', { principal: true });
    const det = anciennete(e.miseEnService, cessionDate);
    const deuxAns = det.annees >= 2;
    c.res('detention', 'Durée de détention', `${det.annees} an(s) ${det.mois} mois ${det.jours} j`, 'texte');
    let ct = ZERO;
    let lt = ZERO;
    if (pv.greaterThan(0)) {
      if (deuxAns) {
        ct = Decimal.min(pv, cumul);
        lt = pv.minus(ct);
      } else ct = pv;
    } else ct = pv; // moins-value sur bien amortissable : toujours à court terme
    c.calc('pvCourtTerme', pv.isNegative() ? 'Moins-value à court terme' : 'Plus-value à court terme', deuxAns ? 'min(PV ; amortissements)' : 'détention < 2 ans', ct);
    c.calc('pvLongTerme', 'Plus-value à long terme', 'PV − PV CT', lt);
    if (lt.greaterThan(0)) c.ctrl('info', 'PVLT_IS', 'À l’IS, la plus-value à long terme sur un bien amortissable est imposée au taux normal (le régime LT ne vise que certains titres et brevets).');
    if (d(e.derogatoiresCumules).greaterThan(0))
      c.ecriture('Reprise des amortissements dérogatoires', [
        { compte: '145', intitule: 'Amortissements dérogatoires', debit: e.derogatoiresCumules },
        { compte: '78725', intitule: 'Reprises sur amortissements dérogatoires', credit: e.derogatoiresCumules },
      ]);
    c.ecriture('Dotation complémentaire', [
      { compte: '68112', intitule: 'Dotations aux amortissements', debit: compl },
      { compte: '2815', intitule: 'Amortissements', credit: compl },
    ]);
    c.ecriture('Sortie de l’actif', [
      { compte: '2815', intitule: 'Amortissements', debit: cumul },
      { compte: '675', intitule: 'Valeurs comptables des éléments d’actif cédés', debit: vnc },
      { compte: '215', intitule: 'Installations techniques', credit: e.vo },
    ]);
    c.ecriture('Constatation du prix de cession', [
      { compte: '462', intitule: 'Créances sur cessions d’immobilisations', debit: e.prixCession },
      { compte: '775', intitule: 'Produits des cessions d’éléments d’actif', credit: e.prixCession },
    ]);
  },
});

interface PlafondsVp {
  tranches: { co2Max: number | null; plafond: string }[];
}

bareme<PlafondsVp>({
  code: 'amortissement.plafonds-vp',
  revision: 'sur-texte',
  moteur: M,
  libelle: 'Plafonds d’amortissement des véhicules de tourisme',
  versions: [
    {
      du: '2021-01-01',
      valeurs: {
        tranches: [
          { co2Max: 19, plafond: '30000' },
          { co2Max: 49, plafond: '20300' },
          { co2Max: 160, plafond: '18300' },
          { co2Max: null, plafond: '9900' },
        ],
      },
      source: 'CGI art. 39-4 (rédaction loi n° 2019-1479, norme WLTP)',
      statut: 'officiel',
    },
  ],
});

export const vehiculeTourisme = formule({
  id: 'vehicule-tourisme',
  moteur: M,
  nom: 'Véhicule de tourisme : amortissement non déductible',
  categorie: 'Écarts comptable / fiscal',
  description: 'Détermine le plafond fiscal selon le taux d’émission de CO₂ (WLTP) et la quote-part d’amortissement à réintégrer chaque année.',
  expression: 'Réintégration = amortissement × (prix TTC − plafond) / prix TTC',
  references: [{ texte: 'CGI art. 39-4 — plafonnement de l’amortissement des véhicules de tourisme' }, { texte: 'BOI-BIC-AMT-20-40-50' }],
  baremes: ['amortissement.plafonds-vp'],
  champs: [
    montant('prixTTC', 'Prix d’acquisition TTC (TVA non récupérable)', { defaut: '42000' }),
    entier('co2', 'Émissions CO₂ WLTP (g/km)', { defaut: 128, min: '0' }),
    nombre('duree', 'Durée d’amortissement (années)', { defaut: '5' }),
    date('dateOperation', 'Date d’acquisition', { defaut: '2024-03-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
  ],
  exemples: [{ titre: 'Berline 128 g', entrees: {}, attendu: { plafond: '18300.00', reintegration1: '3950.00', reintegrationTotale: '23700.00' } }],
  calculer(e, c) {
    const b = c.bareme<PlafondsVp>('amortissement.plafonds-vp', e.dateOperation);
    const tr = b.tranches.find((t) => t.co2Max === null || e.co2 <= t.co2Max)!;
    const plafond = c.calc('plafond', 'Plafond fiscal', `CO₂ ${e.co2} g/km → tranche`, d(tr.plafond));
    const prix: Decimal = e.prixTTC;
    const plan = planLineaire(prix, 0, e.duree, e.dateOperation, e.premiereCloture, 'jours360');
    const ratio = prix.greaterThan(plafond) ? prix.minus(plafond).div(prix) : ZERO;
    c.calc('quotePart', 'Quote-part non déductible', `(${fr(prix)} − ${fr(plafond)}) / ${fr(prix)}`, ratio, '%');
    let total = ZERO;
    const lignes = plan.map((l) => {
      const r = euros(l.dotation.times(ratio));
      total = total.plus(r);
      if (l.rang === 1) c.res('reintegration1', 'Réintégration exercice 1', r, 'EUR', { principal: true });
      return { rang: String(l.rang), cloture: l.cloture, dotation: l.dotation.toFixed(2), deductible: l.dotation.minus(r).toFixed(2), reintegration: r.toFixed(2) };
    });
    c.res('reintegrationTotale', 'Réintégration totale sur la durée', total);
    c.tableau({
      titre: 'Réintégrations annuelles (2058-A ligne WE)',
      colonnes: [
        { cle: 'rang', libelle: 'Exercice', unite: 'entier' },
        { cle: 'cloture', libelle: 'Clôture', unite: 'date' },
        { cle: 'dotation', libelle: 'Dotation', unite: 'EUR' },
        { cle: 'deductible', libelle: 'Déductible', unite: 'EUR' },
        { cle: 'reintegration', libelle: 'À réintégrer', unite: 'EUR' },
      ],
      lignes,
    });
    c.ctrl('info', 'TVS', 'Le véhicule est aussi soumis aux taxes annuelles sur les véhicules de tourisme (moteur Fiscal).');
  },
});

export const fondsCommercial = formule({
  id: 'fonds-commercial',
  moteur: M,
  nom: 'Fonds commercial',
  categorie: 'Incorporels',
  description:
    'Traitement comptable (non amortissable sauf durée limitée ou option des petites entreprises sur 10 ans) et fiscal (déduction temporaire de l’amortissement pour les fonds acquis du 01/01/2022 au 31/12/2025).',
  expression: 'Dotation = valeur / durée (si amortissable) ; déductible si acquisition dans la fenêtre fiscale, sinon réintégrée',
  references: [
    { texte: 'PCG art. 214-3 — durée d’utilisation non limitée, option 10 ans des petites entreprises' },
    { texte: 'CGI art. 39-1-2° al. 2 (loi de finances 2022, art. 23) — déduction temporaire' },
  ],
  champs: [
    montant('valeur', 'Valeur du fonds commercial', { defaut: '150000' }),
    date('acquisition', 'Date d’acquisition', { defaut: '2024-05-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
    choix('traitement', 'Traitement comptable', [
      ['non-amorti', 'Non amorti (durée non limitée)'],
      ['option-pe', 'Option petites entreprises — 10 ans'],
      ['duree-limitee', 'Durée d’utilisation limitée'],
    ]),
    nombre('duree', 'Durée (années)', { defaut: '10', visibleSi: { champ: 'traitement', valeurs: ['duree-limitee'] } }),
  ],
  exemples: [
    { titre: 'Option 10 ans, acquis 2024', entrees: { traitement: 'option-pe' }, attendu: { dotation1: '10000.00', deductible1: '10000.00' } },
    { titre: 'Non amorti', entrees: {}, attendu: { dotation1: '0.00' } },
  ],
  calculer(e, c) {
    if (e.traitement === 'non-amorti') {
      c.res('dotation1', 'Dotation exercice 1', 0, 'EUR', { principal: true });
      c.ctrl('info', 'TEST_DEPRECIATION', 'Fonds non amorti : test de dépréciation annuel obligatoire (PCG art. 214-15).');
      return;
    }
    const duree = e.traitement === 'option-pe' ? d(10) : d(e.duree);
    const plan = planLineaire(e.valeur, 0, duree, e.acquisition, e.premiereCloture, 'jours360');
    c.calc('dotation1', 'Dotation exercice 1', `${fr(e.valeur)} / ${frn(duree)} × prorata`, plan[0].dotation, 'EUR', { principal: true });
    const fenetre = comparer(e.acquisition, '2022-01-01') >= 0 && comparer(e.acquisition, '2025-12-31') <= 0;
    c.res('deductible1', 'Part fiscalement déductible (exercice 1)', fenetre ? plan[0].dotation : 0);
    c.res('reintegration1', 'Réintégration extra-comptable (exercice 1)', fenetre ? 0 : plan[0].dotation);
    c.ctrl(fenetre ? 'ok' : 'info', 'DEDUCTION_TEMPORAIRE', fenetre ? 'Acquisition entre le 01/01/2022 et le 31/12/2025 : amortissement déductible.' : 'Acquisition hors de la période 2022-2025 : amortissement non déductible, à réintégrer.');
    publierPlan(c, 'Plan d’amortissement du fonds commercial', plan);
  },
});

export const incorporels = formule({
  id: 'incorporels',
  moteur: M,
  nom: 'Frais d’établissement, R&D, logiciels, brevets',
  categorie: 'Incorporels',
  description: 'Plan comptable et plan fiscal propres à chaque incorporel (frais d’établissement ≤ 5 ans, développement, logiciel acquis amortissable fiscalement sur 12 mois, brevet ≥ 5 ans) et amortissements dérogatoires associés.',
  expression: 'Comptable : linéaire sur la durée d’usage ; fiscal : règle propre à l’actif ; dérogatoire = fiscal − comptable',
  references: [
    { texte: 'PCG art. 212-9 — frais d’établissement (5 ans maximum)' },
    { texte: 'PCG art. 212-3 et 212-9 — frais de développement' },
    { texte: 'CGI art. 236 I — déduction immédiate des dépenses de recherche' },
    { texte: 'CGI art. 236 II — logiciels acquis : amortissement exceptionnel sur 12 mois' },
    { texte: 'CGI art. 39-1-2° — brevets : 5 ans minimum' },
  ],
  champs: [
    choix('nature', 'Nature', [
      ['etablissement', 'Frais d’établissement'],
      ['developpement', 'Frais de développement'],
      ['logiciel', 'Logiciel acquis'],
      ['brevet', 'Brevet / licence'],
    ]),
    montant('valeur', 'Valeur', { defaut: '36000' }),
    nombre('dureeComptable', 'Durée comptable (années)', { defaut: '3' }),
    date('miseEnService', 'Mise en service', { defaut: '2024-10-01' }),
    date('premiereCloture', 'Clôture du 1er exercice', { defaut: '2024-12-31' }),
  ],
  exemples: [{ titre: 'Logiciel 3 ans / 12 mois fiscal', entrees: { nature: 'logiciel' }, attendu: { comptable1: '3000.00', fiscal1: '9000.00', derogatoire1: '6000.00' } }],
  calculer(e, c) {
    const nature: string = e.nature;
    let dureeC = d(e.dureeComptable);
    if (nature === 'etablissement' && dureeC.greaterThan(5)) {
      c.ctrl('avertissement', 'DUREE_MAX', 'Frais d’établissement : durée ramenée à 5 ans maximum.');
      dureeC = d(5);
    }
    const comptable = planLineaire(e.valeur, 0, dureeC, e.miseEnService, e.premiereCloture, 'jours360');
    let fiscal = comptable;
    if (nature === 'logiciel') fiscal = planLineaire(e.valeur, 0, 1, e.miseEnService, e.premiereCloture, 'jours360');
    if (nature === 'brevet' && dureeC.lessThan(5)) {
      c.ctrl('avertissement', 'BREVET_5ANS', 'Brevet : amortissement fiscal sur 5 ans minimum — excédent comptable à réintégrer.');
      fiscal = planLineaire(e.valeur, 0, 5, e.miseEnService, e.premiereCloture, 'jours360');
    }
    if (nature === 'developpement') c.ctrl('info', 'ART236', 'Option fiscale possible : déduction immédiate en charges (CGI art. 236 I).');
    c.calc('comptable1', 'Amortissement comptable exercice 1', `${fr(e.valeur)} / ${frn(dureeC)} × prorata`, comptable[0].dotation);
    c.calc('fiscal1', 'Amortissement fiscal exercice 1', 'selon règle fiscale', fiscal[0].dotation);
    if (fiscal[0].dotation.greaterThanOrEqualTo(comptable[0].dotation)) tableauDerogatoire(c, comptable, fiscal, e.premiereCloture);
    else c.res('derogatoire1', 'Dotation dérogatoire exercice 1', 0, 'EUR', { principal: true });
    publierPlan(c, 'Plan comptable', comptable);
  },
});

export const creditBail = formule({
  id: 'credit-bail',
  moteur: M,
  nom: 'Retraitement du crédit-bail',
  categorie: 'Crédit-bail',
  description:
    'Retraite un contrat de crédit-bail comme une acquisition financée par emprunt (méthode préférentielle) : taux implicite, tableau de la dette, amortissement théorique du bien et impact annuel sur le résultat.',
  expression: 'Valeur du bien = Σ redevances actualisées + option actualisée au taux implicite ; impact = redevances − (intérêts + dotation)',
  references: [
    { texte: 'Règlement ANC 2020-01, art. 272-2 — retraitement des contrats de location-financement (méthode préférentielle)' },
    { texte: 'PCG art. 212-5 et annexe — information sur les engagements de crédit-bail' },
    { texte: 'IFRS 16 — contrats de location' },
  ],
  champs: [
    montant('valeurBien', 'Valeur du bien à la signature', { defaut: '60000' }),
    montant('redevance', 'Redevance périodique HT', { defaut: '3300' }),
    entier('nbRedevances', 'Nombre de redevances', { defaut: 20, min: '1' }),
    choix('periodicite', 'Périodicité', [
      ['4', 'Trimestrielle'],
      ['12', 'Mensuelle'],
      ['1', 'Annuelle'],
      ['2', 'Semestrielle'],
    ]),
    choix('terme', 'Paiement', [
      ['echoir', 'Terme à échoir (début de période)'],
      ['echu', 'Terme échu (fin de période)'],
    ]),
    montant('optionAchat', 'Option d’achat', { defaut: '600' }),
    nombre('dureeUtilisation', 'Durée d’utilisation du bien (années)', { defaut: '7' }),
  ],
  exemples: [{ titre: 'Machine 60 000 € — 20 trimestres', entrees: {}, attendu: { tauxPeriodique: '1.1156', interets1: '2350.36', dotation1: '8571.43' } }],
  calculer(e, c) {
    const n: number = e.nbRedevances;
    const k = Number(e.periodicite);
    const echoir = e.terme === 'echoir';
    // Flux en t = 0 … n (périodes) : −valeur du bien, redevances, option d'achat en t = n.
    const flux: Decimal[] = Array.from({ length: n + 1 }, () => ZERO);
    flux[0] = d(e.valeurBien).neg();
    for (let p = 1; p <= n; p++) {
      const t = echoir ? p - 1 : p;
      flux[t] = flux[t].plus(e.redevance);
    }
    flux[n] = flux[n].plus(e.optionAchat);
    const i = tri(flux);
    if (!i || i.isNegative()) {
      c.ctrl('erreur', 'TAUX_IMPLICITE', 'Taux implicite introuvable ou négatif : vérifier redevances et valeur du bien.');
      return;
    }
    c.calc('tauxPeriodique', 'Taux implicite périodique', 'TRI des flux (−valeur ; redevances ; option)', i, '%', { decimales: 4, principal: true });
    c.calc('tauxAnnuel', 'Taux actuariel annuel équivalent', `(1 + i)^${k} − 1`, UN.plus(i).pow(k).minus(1), '%', { decimales: 4 });
    // Tableau de la dette par période
    let dette = d(e.valeurBien);
    const annees = new Map<number, { redevances: Decimal; interets: Decimal; capital: Decimal; dette: Decimal }>();
    for (let p = 1; p <= n; p++) {
      const an = Math.ceil(p / k);
      const a = annees.get(an) ?? { redevances: ZERO, interets: ZERO, capital: ZERO, dette: ZERO };
      let interets: Decimal;
      if (echoir) {
        dette = dette.minus(e.redevance);
        interets = dette.times(i);
        dette = dette.plus(interets);
      } else {
        interets = dette.times(i);
        dette = dette.plus(interets).minus(e.redevance);
      }
      a.redevances = a.redevances.plus(e.redevance);
      a.interets = a.interets.plus(interets);
      a.capital = a.capital.plus(d(e.redevance).minus(interets));
      a.dette = dette;
      annees.set(an, a);
    }
    const dotation = euros(d(e.valeurBien).div(e.dureeUtilisation));
    c.res('dotation1', 'Amortissement théorique annuel', dotation);
    const lignes = [...annees.entries()].map(([an, a]) => {
      const impact = a.redevances.minus(a.interets).minus(dotation);
      if (an === 1) {
        c.res('interets1', 'Intérêts de l’année 1', euros(a.interets));
        c.res('impact1', 'Impact sur le résultat avant impôt (année 1)', euros(impact));
      }
      return {
        annee: String(an),
        redevances: euros(a.redevances).toFixed(2),
        interets: euros(a.interets).toFixed(2),
        capital: euros(a.capital).toFixed(2),
        dette: euros(Decimal.max(a.dette, 0)).toFixed(2),
        dotation: dotation.toFixed(2),
        impact: euros(impact).toFixed(2),
      };
    });
    c.tableau({
      titre: 'Retraitement annuel',
      colonnes: [
        { cle: 'annee', libelle: 'Année', unite: 'entier' },
        { cle: 'redevances', libelle: 'Redevances annulées', unite: 'EUR' },
        { cle: 'interets', libelle: 'Intérêts', unite: 'EUR' },
        { cle: 'capital', libelle: 'Capital remboursé', unite: 'EUR' },
        { cle: 'dette', libelle: 'Dette fin', unite: 'EUR' },
        { cle: 'dotation', libelle: 'Dotation', unite: 'EUR' },
        { cle: 'impact', libelle: 'Impact résultat', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'annee', series: ['interets', 'capital', 'dotation'] },
    });
    c.verifier(dette.minus(e.optionAchat).abs().lessThan('0.01'), 'DETTE_SOLDEE', 'La dette retraitée est soldée par la levée d’option.', 'La dette résiduelle ne correspond pas à l’option d’achat.', 'avertissement');
    const a1 = annees.get(1)!;
    c.ecriture('Retraitement année 1 (comptes consolidés)', [
      { compte: '2154', intitule: 'Matériel (bien retraité)', debit: e.valeurBien },
      { compte: '1674', intitule: 'Dette de crédit-bail', credit: e.valeurBien },
      { compte: '1674', intitule: 'Dette — remboursement de capital', debit: euros(a1.capital) },
      { compte: '6611', intitule: 'Intérêts des emprunts', debit: euros(a1.interets) },
      { compte: '612', intitule: 'Redevances de crédit-bail (annulation)', credit: euros(a1.capital).plus(euros(a1.interets)) },
      { compte: '68112', intitule: 'Dotation aux amortissements', debit: dotation },
      { compte: '28154', intitule: 'Amortissements du matériel', credit: dotation },
    ]);
  },
});

export const formulesAmortissements = [lineaire, degressif, unitesOeuvre, composants, derogatoire, cession, vehiculeTourisme, fondsCommercial, incorporels, creditBail];

