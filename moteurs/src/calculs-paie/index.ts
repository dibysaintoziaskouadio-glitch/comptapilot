/**
 * MOTEUR 5 — Paie et cotisations sociales : bulletin complet, net → brut,
 * heures supplémentaires, avantages en nature, congés payés, IJSS, maintien de
 * salaire, indemnités de rupture, activité partielle, PAS, masse salariale.
 */
import './baremes';
import {
  anciennete,
  booleen,
  Champ,
  choix,
  Contexte,
  d,
  date,
  Decimal,
  dichotomie,
  entier,
  euros,
  fd,
  fe,
  formule,
  fp,
  fr,
  frn,
  montant,
  nombre,
  positif,
  somme,
  table,
  taux,
  texte,
  UN,
  ZERO,
  dateOperation,
  min,
  arrondi,
  comparer,
} from '../noyau';
import { AvantagesNature, ConstantesPaie, GrillePas, IndemnitesJournalieres, TauxCotisations } from './baremes';
import { Bulletin, calculerBulletin, ParamsBulletin, tauxNeutre, TrancheEffectif } from './bulletin';
import { moisIndemniteLegale } from '../calculs-provisions';

const M = 'paie' as const;

const REF_CSS = { texte: 'Code de la sécurité sociale, art. L.241-1 à L.242-1 et D.242-3 et s.' };
const REF_URSSAF = { texte: 'URSSAF — taux et montants en vigueur', url: 'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes.html' };

const champsBulletin = (salaireDefaut = '3200'): Champ[] => [
  dateOperation('Période de paie (date)', { defaut: '2024-06-30' }),
  choix('statut', 'Statut', [
    ['non-cadre', 'Non-cadre'],
    ['cadre', 'Cadre'],
  ], { groupe: 'Salarié' }),
  choix('effectif', 'Effectif de l’entreprise', [
    ['1-10', '1 à 10 salariés'],
    ['11-19', '11 à 19 salariés'],
    ['20-49', '20 à 49 salariés'],
    ['50-249', '50 à 249 salariés'],
    ['250+', '250 salariés et plus'],
  ], { defaut: '20-49', groupe: 'Entreprise' }),
  montant('salaireBase', 'Salaire de base mensuel brut', { defaut: salaireDefaut, groupe: 'Rémunération' }),
  nombre('heuresContrat', 'Heures mensuelles contractuelles', { defaut: '151.67', min: '1', groupe: 'Rémunération' }),
  nombre('hs25', 'Heures supplémentaires à 25 %', { defaut: '0', min: '0', groupe: 'Rémunération' }),
  nombre('hs50', 'Heures supplémentaires à 50 %', { defaut: '0', min: '0', groupe: 'Rémunération' }),
  montant('primes', 'Primes soumises', { defaut: '0', groupe: 'Rémunération' }),
  montant('avantagesNature', 'Avantages en nature', { defaut: '0', groupe: 'Rémunération' }),
  montant('absences', 'Retenue pour absences', { defaut: '0', groupe: 'Rémunération' }),
  montant('fraisNonSoumis', 'Indemnités non soumises (transport, frais)', { defaut: '0', groupe: 'Rémunération' }),
  taux('tauxAT', 'Taux accident du travail', { defaut: '1.5', min: '0', groupe: 'Entreprise' }),
  taux('tauxVM', 'Taux de versement mobilité', { defaut: '0', min: '0', suggestions: ['0', '1.6', '2', '2.95', '3.2'], groupe: 'Entreprise' }),
  montant('mutuelleSalarie', 'Complémentaire santé — part salariale', { defaut: '0', groupe: 'Protection sociale' }),
  montant('mutuellePatronale', 'Complémentaire santé — part patronale', { defaut: '0', groupe: 'Protection sociale' }),
  montant('prevoyanceSalarie', 'Prévoyance — part salariale', { defaut: '0', groupe: 'Protection sociale' }),
  montant('prevoyancePatronale', 'Prévoyance — part patronale (hors minimum cadre)', { defaut: '0', groupe: 'Protection sociale' }),
  choix('modePas', 'Prélèvement à la source', [
    ['personnalise', 'Taux transmis par la DGFiP'],
    ['neutre', 'Taux neutre (grille)'],
  ], { groupe: 'Impôt' }),
  taux('tauxPAS', 'Taux de PAS', { defaut: '0', min: '0', max: '100', visibleSi: { champ: 'modePas', valeurs: ['personnalise'] }, groupe: 'Impôt' }),
  booleen('alsaceMoselle', 'Régime local Alsace-Moselle', { groupe: 'Salarié' }),
];

function parametres(e: Record<string, any>, salaireBase?: Decimal): ParamsBulletin {
  return {
    statut: e.statut,
    effectif: e.effectif as TrancheEffectif,
    salaireBase: salaireBase ?? e.salaireBase,
    heuresContrat: e.heuresContrat,
    hs25: e.hs25,
    hs50: e.hs50,
    primes: e.primes,
    avantagesNature: e.avantagesNature,
    absences: e.absences,
    fraisNonSoumis: e.fraisNonSoumis,
    tauxAT: e.tauxAT,
    tauxVM: e.tauxVM,
    mutuelleSalarie: e.mutuelleSalarie,
    mutuellePatronale: e.mutuellePatronale,
    prevoyanceSalarie: e.prevoyanceSalarie,
    prevoyancePatronale: e.prevoyancePatronale,
    tauxPAS: e.modePas === 'personnalise' ? e.tauxPAS : null,
    alsaceMoselle: e.alsaceMoselle,
  };
}

function baremesPaie(c: Contexte, dateOp: string, avecGrille: boolean) {
  const k = c.bareme<ConstantesPaie>('paie.constantes', dateOp);
  const t = c.bareme<TauxCotisations>('paie.cotisations', dateOp);
  const g = avecGrille ? c.bareme<GrillePas>('paie.pas-metropole', dateOp) : null;
  return { k, t, g };
}

const fx = (v?: Decimal) => (v ? v.toFixed(2) : '');
const ft = (v?: Decimal) => (v ? v.times(100).toDecimalPlaces(4).toFixed() : '');

function publierBulletin(c: Contexte, b: Bulletin, k: ConstantesPaie): void {
  c.etape('Taux horaire', `salaire de base / heures`, b.tauxHoraire, 'nombre');
  if (!b.montantHs.isZero()) c.etape('Heures supplémentaires', 'HS25 × TH × 1,25 + HS50 × TH × 1,5', b.montantHs, 'EUR');
  c.etape('Salaire brut', 'base + HS + primes + avantages − absences', b.brut, 'EUR');
  c.etape('Plafond de la sécurité sociale du mois', `PMSS ${fr(k.pmss)} × prorata temps de travail`, b.plafond, 'EUR');
  c.etape('Tranche 1 / Tranche 2', `T1 = min(brut ; PMSS) = ${fr(b.t1)} ; T2 = ${fr(b.t2)}`, b.t1.plus(b.t2), 'EUR');
  c.etape('SMIC du mois (heures rémunérées)', `${fr(k.smicHoraire)} × heures`, b.smicMois, 'EUR');
  if (!b.coefficientRG.isZero()) c.etape('Coefficient de réduction générale', 'T / 0,6 × (1,6 × SMIC / brut − 1), arrondi à 4 décimales', b.coefficientRG, 'nombre');
  c.etape('Total cotisations salariales', 'Σ parts salariales (CSG/CRDS incluses)', b.cotisationsSalariales, 'EUR');
  c.etape('Total cotisations patronales', 'Σ parts patronales − réductions', b.cotisationsPatronales, 'EUR');
  c.etape('Net avant impôt', 'brut − cotisations salariales', b.netAvantImpot, 'EUR');
  c.etape('Net imposable', 'net + CSG/CRDS non déductibles + santé patronale − HS exonérées', b.netImposable, 'EUR');
  c.etape('Prélèvement à la source', `${fr(b.netImposable)} × ${fp(b.tauxPasApplique)}`, b.pas, 'EUR');
  c.etape('Net à payer', 'net avant impôt − PAS − avantages en nature + frais', b.netAPayer, 'EUR');
  c.etape('Coût employeur', 'brut + cotisations patronales + frais', b.coutEmployeur, 'EUR');

  c.res('brut', 'Salaire brut', b.brut, 'EUR', { principal: true, groupe: 'Synthèse' });
  c.res('netAvantImpot', 'Net avant impôt', b.netAvantImpot, 'EUR', { groupe: 'Synthèse' });
  c.res('netImposable', 'Net imposable', b.netImposable, 'EUR', { groupe: 'Synthèse' });
  c.res('pas', 'Prélèvement à la source', b.pas, 'EUR', { groupe: 'Synthèse' });
  c.res('netAPayer', 'Net à payer', b.netAPayer, 'EUR', { principal: true, groupe: 'Synthèse' });
  c.res('cotisationsSalariales', 'Cotisations salariales', b.cotisationsSalariales, 'EUR', { groupe: 'Charges' });
  c.res('cotisationsPatronales', 'Cotisations patronales nettes', b.cotisationsPatronales, 'EUR', { groupe: 'Charges' });
  c.res('reductionGenerale', 'Réduction générale', b.reductionGenerale, 'EUR', { groupe: 'Charges' });
  c.res('coutEmployeur', 'Coût employeur', b.coutEmployeur, 'EUR', { principal: true, groupe: 'Synthèse' });
  c.res('tauxChargesPatronales', 'Charges patronales / brut', b.brut.isZero() ? 0 : b.cotisationsPatronales.div(b.brut), '%', { groupe: 'Charges' });
  c.res('ratioNetBrut', 'Net avant impôt / brut', b.brut.isZero() ? 0 : b.netAvantImpot.div(b.brut), '%', { groupe: 'Charges' });

  c.tableau({
    titre: 'Bulletin de paie',
    colonnes: [
      { cle: 'rubrique', libelle: 'Rubrique', unite: 'texte' },
      { cle: 'base', libelle: 'Base', unite: 'nombre' },
      { cle: 'tauxSal', libelle: 'Taux sal. %', unite: 'nombre' },
      { cle: 'montantSal', libelle: 'Part salariale', unite: 'EUR' },
      { cle: 'tauxPat', libelle: 'Taux pat. %', unite: 'nombre' },
      { cle: 'montantPat', libelle: 'Part patronale', unite: 'EUR' },
    ],
    lignes: b.lignes.map((l) => ({ rubrique: l.rubrique, base: fx(l.base), tauxSal: ft(l.tauxSal), montantSal: fx(l.montantSal), tauxPat: ft(l.tauxPat), montantPat: fx(l.montantPat) })),
    totaux: { rubrique: 'Total cotisations', montantSal: b.cotisationsSalariales.toFixed(2), montantPat: b.cotisationsPatronales.toFixed(2) },
  });

  // Contrôles de cohérence brut → net → coût
  c.verifier(
    b.netAvantImpot.plus(b.cotisationsSalariales).equals(b.brut),
    'COHERENCE_BRUT_NET',
    'Cohérence : net avant impôt + cotisations salariales = brut.',
    'Incohérence brut / net.',
  );
  c.verifier(
    b.netAPayer.plus(b.pas).plus(b.avantagesNature).minus(b.fraisNonSoumis).plus(b.cotisationsSalariales).equals(b.brut) &&
      b.coutEmployeur.equals(b.brut.plus(b.cotisationsPatronales).plus(b.fraisNonSoumis)),
    'COHERENCE_COUT',
    'Cohérence : net à payer + PAS + cotisations salariales = brut, et coût employeur = brut + cotisations patronales + frais.',
    'Incohérence entre net à payer, brut et coût employeur.',
  );
  if (b.tauxHoraire.lessThan(k.smicHoraire))
    c.ctrl('erreur', 'SMIC', `Taux horaire (${fr(b.tauxHoraire, 4)} €) inférieur au SMIC horaire (${fr(k.smicHoraire)} €).`);
  const ratio = b.brut.isZero() ? ZERO : b.netAvantImpot.div(b.brut);
  if (ratio.lessThan('0.70') || ratio.greaterThan('0.90')) c.ctrl('avertissement', 'RATIO_NET_BRUT', `Ratio net/brut inhabituel (${fp(ratio, 1)}).`);
  c.ecriture('Comptabilisation de la paie', [
    { compte: '6411', intitule: 'Salaires, appointements', debit: b.brut },
    { compte: '6451', intitule: 'Cotisations URSSAF et caisses', debit: b.cotisationsPatronales },
    { compte: '625', intitule: 'Frais professionnels remboursés', debit: b.fraisNonSoumis },
    { compte: '431', intitule: 'Sécurité sociale et organismes sociaux', credit: b.cotisationsSalariales.plus(b.cotisationsPatronales) },
    { compte: '4421', intitule: 'Prélèvement à la source', credit: b.pas },
    { compte: '421', intitule: 'Personnel — rémunérations dues', credit: b.netAPayer },
    { compte: '7911', intitule: 'Transfert de charges (avantages en nature)', credit: b.avantagesNature },
  ], 'PA');
}

export const bulletin = formule({
  id: 'bulletin',
  moteur: M,
  nom: 'Bulletin de paie complet',
  categorie: 'Bulletin',
  description:
    'Calcule intégralement un bulletin mensuel : brut, tranches, toutes les cotisations salariales et patronales, CSG/CRDS, réduction générale, dispositifs heures supplémentaires, net imposable, prélèvement à la source, net à payer et coût employeur, avec contrôles de cohérence.',
  expression: 'Brut → Σ cotisations (assiette × taux) → net = brut − cotisations salariales → PAS → net à payer ; coût = brut + cotisations patronales',
  references: [
    REF_CSS,
    REF_URSSAF,
    { texte: 'CSS art. L.136-1-1 et L.136-8 — CSG (assiette 98,25 %)' },
    { texte: 'CSS art. L.241-13 et D.241-7 — réduction générale' },
    { texte: 'CSS art. L.241-17 et L.241-18 — heures supplémentaires' },
    { texte: 'CGI art. 204 A et s. — prélèvement à la source' },
    { texte: 'Code du travail art. R.3243-1 — mentions du bulletin' },
  ],
  baremes: ['paie.constantes', 'paie.cotisations', 'paie.pas-metropole'],
  champs: champsBulletin(),
  exemples: [
    {
      titre: 'Non-cadre 3 200 €, juin 2024',
      entrees: { tauxPAS: '4.5' },
      attendu: { brut: '3200.00', cotisationsSalariales: '666.89', netAvantImpot: '2533.11', reductionGenerale: '0.00' },
    },
    {
      titre: 'Salarié au SMIC, 2024 (réduction générale)',
      entrees: { salaireBase: '1766.96', effectif: '1-10', dateOperation: '2024-03-31' },
      attendu: { brut: '1766.96', reductionGenerale: '563.84' },
      source: 'Coefficient maximal T = 0,3191 (FNAL 0,10 %) au niveau du SMIC',
    },
  ],
  calculer(e, c) {
    const { k, t, g } = baremesPaie(c, e.dateOperation, e.modePas === 'neutre');
    const b = calculerBulletin(parametres(e), k, t, g);
    publierBulletin(c, b, k);
    if (t.reductionGenerale.formule === 'fillon') c.ctrl('info', 'RG_ANNUELLE', 'Réduction générale calculée au mois ; la régularisation annuelle progressive peut modifier le montant.');
  },
});

export const netVersBrut = formule({
  id: 'net-vers-brut',
  moteur: M,
  nom: 'Calcul inverse : net → brut',
  categorie: 'Bulletin',
  description: 'Détermine le salaire de base brut permettant d’atteindre un net avant impôt cible (ou un net à payer), en résolvant le bulletin complet par dichotomie.',
  expression: 'Trouver B tel que net(bulletin(B)) = net cible (|écart| < 0,005 €)',
  references: [REF_CSS, REF_URSSAF],
  baremes: ['paie.constantes', 'paie.cotisations'],
  champs: [
    montant('netCible', 'Net cible', { defaut: '2500' }),
    choix('typeNet', 'Net visé', [
      ['avant-impot', 'Net avant impôt'],
      ['a-payer', 'Net à payer (après PAS)'],
    ]),
    ...champsBulletin().filter((ch) => ch.nom !== 'salaireBase'),
  ],
  exemples: [{ titre: 'Net 2 500 €', entrees: {}, attendu: { salaireBase: '3158.16', netObtenu: '2500.00' } }],
  calculer(e, c) {
    const { k, t, g } = baremesPaie(c, e.dateOperation, e.modePas === 'neutre');
    const net = (b: Bulletin) => (e.typeNet === 'a-payer' ? b.netAPayer : b.netAvantImpot);
    const f = (base: Decimal) => net(calculerBulletin(parametres(e, base), k, t, g)).minus(e.netCible);
    const brut = arrondi(dichotomie(f, 0, d(e.netCible).times(3).plus(1000), 80, '0.0001'), 2);
    // Ajustement au centime : plus petit brut atteignant le net cible.
    let base = brut;
    for (let i = 0; i < 5 && f(base).isNegative(); i++) base = base.plus('0.01');
    const b = calculerBulletin(parametres(e, base), k, t, g);
    c.calc('salaireBase', 'Salaire de base brut nécessaire', 'résolution par dichotomie', base, 'EUR', { principal: true });
    c.calc('netObtenu', 'Net obtenu', 'bulletin recalculé', net(b));
    c.res('coutEmployeur', 'Coût employeur', b.coutEmployeur);
    c.res('brutTotal', 'Brut total', b.brut);
    c.verifier(net(b).minus(e.netCible).abs().lessThanOrEqualTo('0.01'), 'CIBLE_ATTEINTE', 'Net cible atteint à 0,01 € près.', 'Net cible non atteint exactement (effet de seuil ou d’arrondi).', 'avertissement');
  },
});

export const conversionSalaire = formule({
  id: 'conversion-salaire',
  moteur: M,
  nom: 'Conversion de salaire (horaire, mensuel, annuel)',
  categorie: 'Rémunération',
  description: 'Convertit un salaire entre ses expressions horaire, journalière, mensuelle et annuelle, à temps plein ou partiel, et le compare au SMIC.',
  expression: 'Mensuel = horaire × heures mensuelles (35 h → 151,67 h) ; annuel = mensuel × nombre de mois ; journalier = mensuel / 21,67',
  references: [{ texte: 'Code du travail art. L.3121-27 — durée légale 35 h' }, { texte: 'Code du travail art. L.3231-2 — SMIC' }],
  baremes: ['paie.constantes'],
  champs: [
    dateOperation('Date', { defaut: '2025-06-30' }),
    choix('depuis', 'Montant connu', [
      ['mensuel', 'Mensuel brut'],
      ['horaire', 'Horaire brut'],
      ['annuel', 'Annuel brut'],
    ]),
    montant('montant', 'Montant', { defaut: '2400' }),
    nombre('heuresHebdo', 'Heures hebdomadaires', { defaut: '35', min: '1', max: '48' }),
    nombre('nbMois', 'Nombre de mois versés par an', { defaut: '12', suggestions: ['12', '13', '13.5', '14'] }),
  ],
  exemples: [{ titre: '2 400 € mensuels', entrees: {}, attendu: { horaire: '15.8238', annuel: '28800.00', journalier: '110.75', ratioSmic: '133.20' } }],
  calculer(e, c) {
    const k = c.bareme<ConstantesPaie>('paie.constantes', e.dateOperation);
    const hm = c.etape('Heures mensuelles', `${frn(e.heuresHebdo)} × 52 / 12`, d(e.heuresHebdo).times(52).div(12), 'heures');
    const h = d(e.heuresHebdo).equals(35) ? d(k.dureeLegaleMensuelle) : hm;
    const mensuel = e.depuis === 'mensuel' ? d(e.montant) : e.depuis === 'horaire' ? d(e.montant).times(h) : d(e.montant).div(e.nbMois);
    c.calc('mensuel', 'Salaire mensuel brut', 'selon montant connu', euros(mensuel), 'EUR', { principal: true });
    c.calc('horaire', 'Taux horaire brut', `${fr(mensuel)} / ${frn(h)}`, mensuel.div(h), 'nombre', { decimales: 4 });
    c.calc('annuel', 'Salaire annuel brut', `${fr(mensuel)} × ${frn(e.nbMois)}`, euros(mensuel.times(e.nbMois)));
    c.calc('journalier', 'Salaire journalier (jours ouvrés)', `${fr(mensuel)} / 21,67`, euros(mensuel.div('21.67')));
    const ratio = c.calc('ratioSmic', 'Rapport au SMIC', `${fr(mensuel.div(h), 4)} / ${fr(k.smicHoraire)}`, mensuel.div(h).div(k.smicHoraire), '%');
    if (ratio.lessThan(1)) c.ctrl('erreur', 'SOUS_SMIC', 'Rémunération horaire inférieure au SMIC.');
  },
});

export const heuresSupplementaires = formule({
  id: 'heures-supplementaires',
  moteur: M,
  nom: 'Heures supplémentaires',
  categorie: 'Rémunération',
  description: 'Ventile les heures au-delà de 35 h par semaine entre majoration à 25 % (8 premières) et 50 %, calcule la rémunération, la réduction de cotisations salariales, la déduction patronale et contrôle les durées maximales.',
  expression: 'HS25 = min(h − 35 ; 8) ; HS50 = max(h − 43 ; 0) ; montant = TH × (1,25 × HS25 + 1,5 × HS50)',
  references: [
    { texte: 'Code du travail art. L.3121-28 et L.3121-36 — majorations' },
    { texte: 'Code du travail art. L.3121-20 — 48 h maximum par semaine' },
    { texte: 'CSS art. L.241-17 (réduction salariale) et L.241-18 (déduction patronale)' },
    { texte: 'CGI art. 81 quater — exonération d’IR jusqu’à 7 500 € par an' },
  ],
  baremes: ['paie.cotisations'],
  champs: [
    dateOperation('Date', { defaut: '2024-06-30' }),
    montant('tauxHoraire', 'Taux horaire brut', { defaut: '16.50' }),
    table('semaines', 'Heures travaillées par semaine', [texte('semaine', 'Semaine'), nombre('heures', 'Heures')], {
      min: '1',
      defaut: [
        { semaine: 'S23', heures: '39' },
        { semaine: 'S24', heures: '44.5' },
        { semaine: 'S25', heures: '35' },
        { semaine: 'S26', heures: '42' },
      ],
    }),
    choix('majorations', 'Majorations', [
      ['legales', 'Légales (25 % / 50 %)'],
      ['conventionnelles', 'Accord collectif'],
    ]),
    taux('majoration1', 'Majoration des premières heures', { defaut: '10', min: '10', visibleSi: { champ: 'majorations', valeurs: ['conventionnelles'] } }),
    taux('majoration2', 'Majoration au-delà de 8 heures', { defaut: '25', min: '10', visibleSi: { champ: 'majorations', valeurs: ['conventionnelles'] } }),
    choix('effectif', 'Effectif', [
      ['1-10', '< 20 salariés'],
      ['20-49', '20 à 249 salariés'],
      ['250+', '≥ 250 salariés'],
    ]),
  ],
  exemples: [{ titre: 'Mois de juin', entrees: {}, attendu: { hs25: '19', hs50: '1.5', montant: '429.00', deductionPatronale: '30.75', reductionSalariale: '48.52' } }],
  calculer(e, c) {
    const t = c.bareme<TauxCotisations>('paie.cotisations', e.dateOperation);
    const m1 = e.majorations === 'legales' ? d('0.25') : d(e.majoration1);
    const m2 = e.majorations === 'legales' ? d('0.5') : d(e.majoration2);
    let h25 = ZERO;
    let h50 = ZERO;
    const lignes = (e.semaines as { semaine: string; heures: Decimal }[]).map((s) => {
      const a = min(positif(s.heures.minus(35)), 8);
      const b = positif(s.heures.minus(43));
      h25 = h25.plus(a);
      h50 = h50.plus(b);
      if (s.heures.greaterThan(48)) c.ctrl('erreur', 'DUREE_MAX', `${s.semaine} : ${frn(s.heures)} h > 48 h (durée maximale absolue).`);
      return { semaine: s.semaine, heures: s.heures.toFixed(), hs25: a.toFixed(), hs50: b.toFixed() };
    });
    c.res('hs25', `Heures majorées à ${fp(m1)}`, h25, 'heures');
    c.res('hs50', `Heures majorées à ${fp(m2)}`, h50, 'heures');
    const th: Decimal = e.tauxHoraire;
    const mt = c.calc('montant', 'Rémunération des heures supplémentaires', `${fr(th)} × (${frn(h25)} × ${frn(UN.plus(m1))} + ${frn(h50)} × ${frn(UN.plus(m2))})`, euros(th.times(h25.times(UN.plus(m1)).plus(h50.times(UN.plus(m2))))), 'EUR', { principal: true });
    const forfait = e.effectif === '1-10' ? d(t.deductionHs.moins20) : e.effectif === '20-49' ? d(t.deductionHs.de20a249) : ZERO;
    c.calc('deductionPatronale', 'Déduction forfaitaire patronale', `${frn(h25.plus(h50))} h × ${fr(forfait)} €`, euros(h25.plus(h50).times(forfait)));
    c.calc('reductionSalariale', 'Réduction de cotisations salariales', `${fr(mt)} × ${t.reductionHsSalariale} %`, euros(mt.times(t.reductionHsSalariale).div(100)));
    c.res('exonereIR', 'Montant exonéré d’impôt (dans la limite annuelle)', mt);
    c.ctrl('info', 'CONTINGENT', 'Contingent annuel légal : 220 h (sauf accord) — au-delà, contrepartie obligatoire en repos.');
    c.tableau({
      titre: 'Décompte hebdomadaire',
      colonnes: [
        { cle: 'semaine', libelle: 'Semaine', unite: 'texte' },
        { cle: 'heures', libelle: 'Heures', unite: 'heures' },
        { cle: 'hs25', libelle: 'HS 1er palier', unite: 'heures' },
        { cle: 'hs50', libelle: 'HS 2e palier', unite: 'heures' },
      ],
      lignes,
      graphique: { type: 'barres-empilees', x: 'semaine', series: ['hs25', 'hs50'] },
    });
  },
});

export const heuresComplementaires = formule({
  id: 'heures-complementaires',
  moteur: M,
  nom: 'Heures complémentaires (temps partiel)',
  categorie: 'Rémunération',
  description: 'Calcule les heures complémentaires d’un salarié à temps partiel : majoration de 10 % jusqu’au dixième de la durée contractuelle, 25 % au-delà, dans la limite du tiers.',
  expression: 'HC10 = min(HC ; durée/10) ; HC25 = HC − HC10 ; plafond : durée/3 et < 35 h',
  references: [{ texte: 'Code du travail art. L.3123-8, L.3123-20 et L.3123-29' }],
  champs: [
    nombre('dureeContrat', 'Durée contractuelle hebdomadaire', { defaut: '24' }),
    nombre('heuresTravaillees', 'Heures travaillées dans la semaine', { defaut: '29' }),
    montant('tauxHoraire', 'Taux horaire brut', { defaut: '13.20' }),
    booleen('accordTiers', 'Accord collectif portant la limite au tiers', { defaut: true }),
  ],
  exemples: [{ titre: 'Contrat 24 h', entrees: {}, attendu: { hc10: '2.4', hc25: '2.6', montant: '77.75' } }],
  calculer(e, c) {
    const dur: Decimal = e.dureeContrat;
    const hc = positif(d(e.heuresTravaillees).minus(dur));
    const limite = dur.div(e.accordTiers ? 3 : 10);
    if (hc.greaterThan(limite)) c.ctrl('erreur', 'LIMITE_HC', `Heures complémentaires (${frn(hc)} h) au-delà de la limite (${frn(limite, 2)} h).`);
    if (d(e.heuresTravaillees).greaterThanOrEqualTo(35)) c.ctrl('erreur', 'DUREE_LEGALE', 'Les heures complémentaires ne peuvent porter la durée au niveau de la durée légale.');
    const a = min(hc, dur.div(10));
    const b = hc.minus(a);
    c.res('hc10', 'Heures à +10 %', a, 'heures');
    c.res('hc25', 'Heures à +25 %', b, 'heures');
    c.calc('montant', 'Rémunération des heures complémentaires', `${fr(e.tauxHoraire)} × (${frn(a)} × 1,10 + ${frn(b)} × 1,25)`, euros(d(e.tauxHoraire).times(a.times('1.1').plus(b.times('1.25')))), 'EUR', { principal: true });
  },
});

export const avantageVehicule = formule({
  id: 'avantage-vehicule',
  moteur: M,
  nom: 'Avantage en nature véhicule',
  categorie: 'Avantages en nature',
  description: 'Évaluation forfaitaire mensuelle de l’avantage lié à la mise à disposition permanente d’un véhicule (achat ou location, carburant pris en charge ou non, abattement des véhicules électriques).',
  expression: 'Achat : prix TTC × taux / 12 ; location : coût global annuel TTC × taux / 12 ; − abattement électrique plafonné',
  references: [
    { texte: 'Arrêté du 10/12/2002 relatif à l’évaluation des avantages en nature, art. 3' },
    { texte: 'BOSS — Avantages en nature, chapitre véhicule' },
  ],
  baremes: ['paie.avantages-nature'],
  champs: [
    dateOperation('Date', { defaut: '2024-06-30' }),
    choix('mode', 'Mode de détention', [
      ['achat', 'Véhicule acheté'],
      ['location', 'Location / LLD'],
    ]),
    montant('prixTTC', 'Prix d’achat TTC (remises incluses)', { defaut: '38000', visibleSi: { champ: 'mode', valeurs: ['achat'] } }),
    booleen('moinsDe5Ans', 'Véhicule de moins de 5 ans', { defaut: true, visibleSi: { champ: 'mode', valeurs: ['achat'] } }),
    montant('coutLocationAnnuel', 'Coût global annuel TTC (location, entretien, assurance)', { defaut: '9600', visibleSi: { champ: 'mode', valeurs: ['location'] } }),
    booleen('carburant', 'Carburant pris en charge par l’employeur'),
    booleen('electrique', 'Véhicule 100 % électrique'),
  ],
  exemples: [{ titre: 'Achat 38 000 €, juin 2024', entrees: {}, attendu: { avantageMensuel: '285.00', avantageAnnuel: '3420.00' } }],
  calculer(e, c) {
    const b = c.bareme<AvantagesNature>('paie.avantages-nature', e.dateOperation).vehicule;
    let annuel: Decimal;
    if (e.mode === 'achat') {
      const tx = e.carburant ? (e.moinsDe5Ans ? b.achatCarburantMoins5 : b.achatCarburantPlus5) : e.moinsDe5Ans ? b.achatMoins5 : b.achatPlus5;
      annuel = c.etape('Avantage annuel brut', `${fr(e.prixTTC)} × ${tx} %`, euros(d(e.prixTTC).times(tx).div(100)), 'EUR');
    } else {
      const tx = e.carburant ? b.locationCarburant : b.location;
      annuel = c.etape('Avantage annuel brut', `${fr(e.coutLocationAnnuel)} × ${tx} %`, euros(d(e.coutLocationAnnuel).times(tx).div(100)), 'EUR');
    }
    if (e.electrique) {
      const ab = min(annuel.times(b.abattementElectrique).div(100), b.plafondAbattementElectrique);
      c.etape('Abattement véhicule électrique', `min(${b.abattementElectrique} % ; ${fr(b.plafondAbattementElectrique)} €)`, euros(ab), 'EUR');
      annuel = annuel.minus(euros(ab));
    }
    c.calc('avantageAnnuel', 'Avantage annuel', 'après abattement', annuel);
    c.calc('avantageMensuel', 'Avantage mensuel', `${fr(annuel)} / 12`, euros(annuel.div(12)), 'EUR', { principal: true });
  },
});

export const avantageRepas = formule({
  id: 'avantage-repas',
  moteur: M,
  nom: 'Avantage en nature nourriture',
  categorie: 'Avantages en nature',
  description: 'Évaluation forfaitaire des repas fournis par l’employeur, après participation éventuelle du salarié.',
  expression: 'Avantage = nombre de repas × max(0 ; forfait − participation)',
  references: [{ texte: 'Arrêté du 10/12/2002, art. 1er — revalorisé chaque 1er janvier' }],
  baremes: ['paie.avantages-nature'],
  champs: [
    dateOperation('Date', { defaut: '2025-03-31' }),
    entier('repas', 'Nombre de repas du mois', { defaut: 20, min: '0' }),
    montant('participation', 'Participation du salarié par repas', { defaut: '0' }),
  ],
  exemples: [{ titre: '20 repas 2025', entrees: {}, attendu: { forfait: '5.45', avantage: '109.00' } }],
  calculer(e, c) {
    const f = d(c.bareme<AvantagesNature>('paie.avantages-nature', e.dateOperation).repas);
    c.res('forfait', 'Forfait par repas', f);
    c.calc('avantage', 'Avantage en nature', `${e.repas} × max(0 ; ${fr(f)} − ${fr(e.participation)})`, euros(d(e.repas).times(positif(f.minus(e.participation)))), 'EUR', { principal: true });
  },
});

export const congesPayes = formule({
  id: 'conges-payes',
  moteur: M,
  nom: 'Congés payés : acquisition et indemnité',
  categorie: 'Congés et absences',
  description: 'Calcule les jours acquis (2,5 jours ouvrables par mois de travail, 2 jours par mois d’arrêt maladie non professionnelle), le solde et l’indemnité selon la règle la plus favorable entre le dixième et le maintien de salaire.',
  expression: 'Acquis = ⌈2,5 × mois travaillés + 2 × mois de maladie⌉ (≤ 30 j) ; indemnité = max(1/10 × brut de référence × jours pris / jours acquis ; salaire × jours pris / jours ouvrables du mois)',
  references: [
    { texte: 'Code du travail art. L.3141-3 et L.3141-7 — acquisition, arrondi à l’entier supérieur' },
    { texte: 'Code du travail art. L.3141-5-1 (loi n° 2024-364) — maladie non professionnelle' },
    { texte: 'Code du travail art. L.3141-24 — règle du dixième / maintien' },
  ],
  champs: [
    nombre('moisTravailles', 'Mois de travail effectif sur la période de référence', { defaut: '11', min: '0', max: '12' }),
    nombre('moisMaladie', 'Mois d’arrêt maladie non professionnelle', { defaut: '1', min: '0', max: '12' }),
    nombre('joursPris', 'Jours ouvrables pris', { defaut: '12', min: '0' }),
    montant('brutReference', 'Brut de la période de référence', { defaut: '39600' }),
    montant('salaireMensuel', 'Salaire mensuel actuel', { defaut: '3400' }),
    nombre('joursOuvrablesMois', 'Jours ouvrables du mois de prise', { defaut: '26' }),
  ],
  exemples: [{ titre: '12 jours pris', entrees: {}, attendu: { joursAcquis: '30', solde: '18', indemniteDixieme: '1584.00', indemniteMaintien: '1569.23', indemnite: '1584.00' } }],
  calculer(e, c) {
    const travail = d(e.moisTravailles).times('2.5');
    const maladie = min(d(e.moisMaladie).times(2), 24);
    const acquis = min(travail.plus(maladie).ceil(), 30);
    c.calc('joursAcquis', 'Jours acquis', `⌈2,5 × ${frn(e.moisTravailles)} + 2 × ${frn(e.moisMaladie)}⌉ plafonné à 30`, acquis, 'jours', { decimales: 0 });
    c.calc('solde', 'Solde de congés', `${frn(acquis)} − ${frn(e.joursPris)}`, acquis.minus(e.joursPris), 'jours', { decimales: 0 });
    if (acquis.isZero()) return;
    const dix = c.calc('indemniteDixieme', 'Règle du dixième', `${fr(e.brutReference)} / 10 × ${frn(e.joursPris)} / ${frn(acquis)}`, euros(d(e.brutReference).div(10).times(e.joursPris).div(acquis)));
    const maint = c.calc('indemniteMaintien', 'Maintien de salaire', `${fr(e.salaireMensuel)} × ${frn(e.joursPris)} / ${frn(e.joursOuvrablesMois)}`, euros(d(e.salaireMensuel).times(e.joursPris).div(e.joursOuvrablesMois)));
    c.calc('indemnite', 'Indemnité de congés payés due', 'max(dixième ; maintien)', Decimal.max(dix, maint), 'EUR', { principal: true });
    c.res('methode', 'Méthode retenue', dix.greaterThanOrEqualTo(maint) ? 'Dixième' : 'Maintien de salaire', 'texte');
  },
});

function ancienneteAnnees(entree: string, sortie: string): Decimal {
  const a = anciennete(entree, sortie);
  return d(a.annees).plus(d(a.mois).div(12)).plus(d(a.jours).div(365));
}

export const indemniteLicenciement = formule({
  id: 'indemnite-licenciement',
  moteur: M,
  nom: 'Indemnité légale de licenciement',
  categorie: 'Rupture du contrat',
  description: 'Calcule l’ancienneté (préavis inclus), le salaire de référence le plus favorable et l’indemnité légale ; compare à l’indemnité conventionnelle et retient la plus élevée.',
  expression: 'Indemnité = S × [min(A ; 10) / 4 + max(A − 10 ; 0) / 3] ; S = max(moyenne 12 mois ; moyenne 3 mois)',
  references: [
    { texte: 'Code du travail art. L.1234-9 — droit à l’indemnité (8 mois d’ancienneté)' },
    { texte: 'Code du travail art. R.1234-2 et R.1234-4 — montant et salaire de référence' },
  ],
  champs: [
    date('dateEntree', 'Date d’entrée', { defaut: '2012-09-03' }),
    date('dateSortie', 'Date de fin du préavis', { defaut: '2025-06-30' }),
    montant('moyenne12', 'Moyenne brute des 12 derniers mois', { defaut: '3650' }),
    montant('moyenne3', 'Moyenne brute des 3 derniers mois (primes proratisées)', { defaut: '3580' }),
    montant('conventionnelle', 'Indemnité conventionnelle (si connue)', { defaut: '0' }),
  ],
  exemples: [{ titre: '12 ans 9 mois 27 jours', entrees: {}, attendu: { salaireReference: '3650.00', indemniteLegale: '12560.83', indemniteDue: '12560.83' } }],
  calculer(e, c) {
    if (comparer(e.dateSortie, e.dateEntree) <= 0) {
      c.ctrl('erreur', 'DATES', 'La date de sortie doit suivre la date d’entrée.');
      return;
    }
    const a = anciennete(e.dateEntree, e.dateSortie);
    const A = ancienneteAnnees(e.dateEntree, e.dateSortie);
    c.res('anciennete', 'Ancienneté', `${a.annees} an(s) ${a.mois} mois ${a.jours} j`, 'texte');
    c.etape('Ancienneté en années', `${a.annees} + ${a.mois}/12 + ${a.jours}/365`, A, 'annees');
    if (A.lessThan(d(8).div(12))) {
      c.ctrl('info', 'MOINS_8_MOIS', 'Ancienneté inférieure à 8 mois : pas d’indemnité légale.');
      c.res('indemniteLegale', 'Indemnité légale', 0);
      c.res('indemniteDue', 'Indemnité due', e.conventionnelle, 'EUR', { principal: true });
      return;
    }
    const S = c.calc('salaireReference', 'Salaire de référence', `max(${fr(e.moyenne12)} ; ${fr(e.moyenne3)})`, Decimal.max(e.moyenne12, e.moyenne3));
    const mois = moisIndemniteLegale(A);
    c.etape('Mois d’indemnité', `min(A;10)/4 + max(A−10;0)/3`, mois, 'mois');
    const leg = c.calc('indemniteLegale', 'Indemnité légale', `${fr(S)} × ${frn(mois, 6)}`, euros(S.times(mois)));
    c.calc('indemniteDue', 'Indemnité due', `max(légale ; conventionnelle ${fr(e.conventionnelle)})`, Decimal.max(leg, e.conventionnelle), 'EUR', { principal: true });
    c.ctrl('info', 'REGIME_SOCIAL', 'Régime social et fiscal : exonération dans les limites de CGI art. 80 duodecies et CSS art. L.242-1 (2 PASS).');
  },
});

export const ruptureConventionnelle = formule({
  id: 'rupture-conventionnelle',
  moteur: M,
  nom: 'Rupture conventionnelle : minimum et contribution patronale',
  categorie: 'Rupture du contrat',
  description: 'Vérifie que l’indemnité négociée atteint le minimum légal, détermine la fraction exonérée de cotisations (2 PASS) et la contribution patronale spécifique de 30 %.',
  expression: 'Minimum = indemnité légale ; exonéré social = min(indemnité ; 2 PASS) si indemnité ≤ 10 PASS ; contribution = 30 % × part exonérée',
  references: [
    { texte: 'Code du travail art. L.1237-13 — indemnité ≥ indemnité légale' },
    { texte: 'CSS art. L.137-12 (loi n° 2023-270) — contribution patronale de 30 % depuis le 01/09/2023' },
    { texte: 'CSS art. L.242-1 II 7° — exonération dans la limite de 2 PASS' },
  ],
  baremes: ['paie.constantes'],
  champs: [
    date('dateEntree', 'Date d’entrée', { defaut: '2016-02-01' }),
    { ...date('dateOperation', 'Date de rupture', { defaut: '2025-04-30' }) },
    montant('salaireReference', 'Salaire de référence', { defaut: '4200' }),
    montant('indemniteNegociee', 'Indemnité négociée', { defaut: '15000' }),
  ],
  exemples: [{ titre: '9 ans 2 mois 29 jours', entrees: {}, attendu: { minimumLegal: '9708.42', exonereSocial: '15000.00', contributionPatronale: '4500.00' } }],
  calculer(e, c) {
    const k = c.bareme<ConstantesPaie>('paie.constantes', e.dateOperation);
    const A = ancienneteAnnees(e.dateEntree, e.dateOperation);
    c.etape('Ancienneté', `du ${fd(e.dateEntree)} au ${fd(e.dateOperation)}`, A, 'annees');
    const minLeg = c.calc('minimumLegal', 'Minimum légal', `${fr(e.salaireReference)} × ${frn(moisIndemniteLegale(A), 6)}`, euros(d(e.salaireReference).times(moisIndemniteLegale(A))));
    const ind: Decimal = e.indemniteNegociee;
    c.verifier(ind.greaterThanOrEqualTo(minLeg), 'MINIMUM', 'Indemnité ≥ minimum légal.', `Indemnité inférieure au minimum légal (${fe(minLeg)}) : homologation refusée.`);
    const pass = d(k.pmss).times(12);
    const exo = ind.greaterThan(pass.times(10)) ? ZERO : min(ind, pass.times(2));
    c.calc('exonereSocial', 'Part exonérée de cotisations', ind.greaterThan(pass.times(10)) ? '> 10 PASS : aucune exonération' : `min(${fr(ind)} ; 2 × ${fr(pass)})`, exo);
    c.calc('soumisCotisations', 'Part soumise à cotisations', `${fr(ind)} − ${fr(exo)}`, ind.minus(exo));
    c.calc('contributionPatronale', 'Contribution patronale spécifique 30 %', `${fr(exo)} × 30 %`, euros(exo.times('0.3')), 'EUR', { principal: true });
    c.calc('coutTotal', 'Coût total de la rupture', 'indemnité + contribution', ind.plus(euros(exo.times('0.3'))));
  },
});

export const indemnitePrecarite = formule({
  id: 'indemnite-precarite',
  moteur: M,
  nom: 'Indemnité de fin de CDD',
  categorie: 'Rupture du contrat',
  description: 'Indemnité de précarité (10 %, ou 6 % avec accord et accès à la formation) et indemnité compensatrice de congés payés calculée sur la rémunération majorée de la précarité.',
  expression: 'Précarité = brut total × 10 % ; ICCP = (brut total + précarité) × 10 %',
  references: [{ texte: 'Code du travail art. L.1243-8 et L.1243-9 — indemnité de fin de contrat' }, { texte: 'Code du travail art. L.1242-16 — congés payés en CDD' }],
  champs: [
    montant('brutTotal', 'Rémunération brute totale du contrat', { defaut: '14800' }),
    taux('taux', 'Taux de l’indemnité de précarité', { defaut: '10', suggestions: ['10', '6'] }),
    booleen('iccpDejaVersee', 'Congés déjà pris ou payés'),
  ],
  exemples: [{ titre: 'CDD 6 mois', entrees: {}, attendu: { precarite: '1480.00', iccp: '1628.00', total: '3108.00' } }],
  calculer(e, c) {
    const p = c.calc('precarite', 'Indemnité de précarité', `${fr(e.brutTotal)} × ${fp(e.taux)}`, euros(d(e.brutTotal).times(e.taux)));
    const iccp = e.iccpDejaVersee ? ZERO : euros(d(e.brutTotal).plus(p).times('0.1'));
    c.calc('iccp', 'Indemnité compensatrice de congés payés', `(${fr(e.brutTotal)} + ${fr(p)}) × 10 %`, iccp);
    c.calc('total', 'Total des indemnités de fin de contrat', 'précarité + ICCP', p.plus(iccp), 'EUR', { principal: true });
  },
});

export const ijssMaladie = formule({
  id: 'ijss-maladie',
  moteur: M,
  nom: 'Indemnités journalières maladie (IJSS)',
  categorie: 'Congés et absences',
  description: 'Calcule le salaire journalier de base (3 derniers mois / 91,25, plafonné), l’IJ à 50 % et le total après délai de carence.',
  expression: 'SJB = min(Σ 3 brut / 91,25 ; plafond × SMIC mensuel × 3 / 91,25) ; IJ = 50 % × SJB ; jours indemnisés = jours d’arrêt − 3',
  references: [{ texte: 'CSS art. L.323-1, R.323-1, R.323-4 et R.323-9' }],
  baremes: ['paie.ijss', 'paie.constantes'],
  champs: [
    dateOperation('Date de début de l’arrêt', { defaut: '2024-09-02' }),
    montant('brut3Mois', 'Brut des 3 mois précédant l’arrêt', { defaut: '9300' }),
    entier('joursArret', 'Durée de l’arrêt (jours calendaires)', { defaut: 15, min: '1', max: '1095' }),
  ],
  exemples: [{ titre: 'Arrêt de 15 jours', entrees: {}, attendu: { sjb: '101.92', ij: '50.96', joursIndemnises: '12', total: '611.52' } }],
  calculer(e, c) {
    const b = c.bareme<IndemnitesJournalieres>('paie.ijss', e.dateOperation);
    const k = c.bareme<ConstantesPaie>('paie.constantes', e.dateOperation);
    const plafond = d(b.plafondSmic).times(k.smicHoraire).times(k.dureeLegaleMensuelle).times(3).div(b.diviseur);
    const brutJ = d(e.brut3Mois).div(b.diviseur);
    const sjb = c.calc('sjb', 'Salaire journalier de base', `min(${fr(e.brut3Mois)} / ${b.diviseur} ; plafond ${fr(plafond)})`, euros(min(brutJ, plafond)));
    if (brutJ.greaterThan(plafond)) c.ctrl('info', 'PLAFOND', `Salaire plafonné à ${b.plafondSmic} SMIC.`);
    const ij = c.calc('ij', 'Indemnité journalière', `${fr(sjb)} × 50 %`, euros(sjb.div(2)));
    const jours = Math.max(0, e.joursArret - Number(b.carence));
    c.res('joursIndemnises', 'Jours indemnisés', jours, 'jours', { decimales: 0 });
    c.calc('total', 'Total des IJSS', `${fr(ij)} × ${jours}`, euros(ij.times(jours)), 'EUR', { principal: true });
  },
});

export const maintienSalaire = formule({
  id: 'maintien-salaire',
  moteur: M,
  nom: 'Maintien de salaire légal (maladie)',
  categorie: 'Congés et absences',
  description: 'Complément employeur : 90 % puis 66,66 % de la rémunération brute, durées croissant de 10 jours par période de 5 ans d’ancienneté, après 7 jours de carence, sous déduction des IJSS.',
  expression: 'Complément = salaire journalier × (jours à 90 % × 90 % + jours à 66,66 % × 2/3) − IJSS',
  references: [{ texte: 'Code du travail art. L.1226-1, D.1226-1 à D.1226-3' }],
  champs: [
    montant('salaireMensuel', 'Salaire mensuel brut', { defaut: '3000' }),
    nombre('anciennete', 'Ancienneté (années)', { defaut: '7', min: '0' }),
    entier('joursArret', 'Durée de l’arrêt (jours)', { defaut: 60, min: '1', max: '1095' }),
    montant('ijJournaliere', 'IJSS journalière brute', { defaut: '49.32' }),
    entier('carence', 'Jours de carence employeur', { defaut: 7, min: '0', max: '365' }),
  ],
  exemples: [{ titre: '60 jours, 7 ans', entrees: {}, attendu: { jours90: '40', jours66: '13', complement: '1852.71' } }],
  calculer(e, c) {
    if (d(e.anciennete).lessThan(1)) {
      c.ctrl('info', 'ANCIENNETE', 'Moins d’un an d’ancienneté : pas de maintien légal.');
      c.res('complement', 'Complément employeur', 0, 'EUR', { principal: true });
      return;
    }
    const bonus = Math.min(60, Math.floor(d(e.anciennete).minus(1).div(5).toNumber()) * 10);
    const p1 = 30 + bonus;
    const p2 = 30 + bonus;
    const indemnisables = Math.max(0, e.joursArret - e.carence);
    const j90 = Math.min(indemnisables, p1);
    const j66 = Math.min(indemnisables - j90, p2);
    c.res('jours90', 'Jours indemnisés à 90 %', j90, 'jours', { decimales: 0 });
    c.res('jours66', 'Jours indemnisés à 66,66 %', j66, 'jours', { decimales: 0 });
    const sj = d(e.salaireMensuel).div(30);
    const garantie = c.etape('Rémunération garantie', `${fr(sj)} × (${j90} × 90 % + ${j66} × 2/3)`, euros(sj.times(d(j90).times('0.9').plus(d(j66).times(2).div(3)))), 'EUR');
    const ij = c.etape('IJSS sur la même période', `${fr(e.ijJournaliere)} × ${j90 + j66}`, euros(d(e.ijJournaliere).times(j90 + j66)), 'EUR');
    c.calc('complement', 'Complément employeur', `${fr(garantie)} − ${fr(ij)}`, positif(garantie.minus(ij)), 'EUR', { principal: true });
  },
});

export const activitePartielle = formule({
  id: 'activite-partielle',
  moteur: M,
  nom: 'Activité partielle',
  categorie: 'Congés et absences',
  description: 'Indemnité versée au salarié (60 % du brut horaire), allocation remboursée par l’État (36 %), plafonnées à 4,5 SMIC, et reste à charge employeur.',
  expression: 'Indemnité = heures chômées × TH × 60 % ; allocation = heures × min(TH ; 4,5 SMIC) × 36 %',
  references: [{ texte: 'Code du travail art. L.5122-1, R.5122-12 et R.5122-18 (taux de droit commun)' }],
  baremes: ['paie.constantes'],
  champs: [
    dateOperation('Mois', { defaut: '2024-05-31' }),
    montant('tauxHoraire', 'Taux horaire brut', { defaut: '18.40' }),
    nombre('heuresChomees', 'Heures chômées indemnisables', { defaut: '42' }),
  ],
  exemples: [{ titre: '42 heures', entrees: {}, attendu: { indemnite: '463.68', allocation: '278.21', resteACharge: '185.47' } }],
  calculer(e, c) {
    const k = c.bareme<ConstantesPaie>('paie.constantes', e.dateOperation);
    const th = min(e.tauxHoraire, d(k.smicHoraire).times('4.5'));
    if (d(e.tauxHoraire).greaterThan(th)) c.ctrl('info', 'PLAFOND', 'Taux horaire plafonné à 4,5 SMIC.');
    const ind = c.calc('indemnite', 'Indemnité salarié', `${frn(e.heuresChomees)} × ${fr(th)} × 60 %`, euros(d(e.heuresChomees).times(th).times('0.6')), 'EUR', { principal: true });
    const al = c.calc('allocation', 'Allocation employeur', `${frn(e.heuresChomees)} × ${fr(th)} × 36 %`, euros(d(e.heuresChomees).times(th).times('0.36')));
    c.calc('resteACharge', 'Reste à charge employeur', `${fr(ind)} − ${fr(al)}`, ind.minus(al));
    c.ctrl('info', 'PLANCHERS', 'Vérifier les planchers horaires de l’indemnité et de l’allocation en vigueur.');
  },
});

export const soldeToutCompte = formule({
  id: 'solde-tout-compte',
  moteur: M,
  nom: 'Solde de tout compte',
  categorie: 'Rupture du contrat',
  description: 'Récapitule les sommes dues à la sortie : salaire du dernier mois au prorata, indemnité compensatrice de congés payés, de préavis et indemnité de rupture.',
  expression: 'Total brut = salaire au prorata + ICCP + préavis + indemnité de rupture',
  references: [{ texte: 'Code du travail art. L.1234-20 — reçu pour solde de tout compte' }, { texte: 'Code du travail art. L.1234-5 et L.3141-28' }],
  champs: [
    montant('salaireMensuel', 'Salaire mensuel brut', { defaut: '2900' }),
    nombre('joursTravaillesMois', 'Jours ouvrés travaillés le dernier mois', { defaut: '12' }),
    nombre('joursOuvresMois', 'Jours ouvrés du mois', { defaut: '22' }),
    nombre('joursCpRestants', 'Jours ouvrables de congés restants', { defaut: '8.5' }),
    nombre('moisPreavisNonEffectue', 'Mois de préavis non effectué (dispense employeur)', { defaut: '0' }),
    montant('indemniteRupture', 'Indemnité de rupture (licenciement, RC…)', { defaut: '6800' }),
  ],
  exemples: [{ titre: 'Départ mi-mois', entrees: {}, attendu: { salaireProrata: '1581.82', iccp: '948.08', total: '9329.90' } }],
  calculer(e, c) {
    const s: Decimal = e.salaireMensuel;
    const pr = c.calc('salaireProrata', 'Salaire du dernier mois', `${fr(s)} × ${frn(e.joursTravaillesMois)} / ${frn(e.joursOuvresMois)}`, euros(s.times(e.joursTravaillesMois).div(e.joursOuvresMois)));
    const iccp = c.calc('iccp', 'Indemnité compensatrice de congés payés', `${fr(s)} / 26 × ${frn(e.joursCpRestants)}`, euros(s.div(26).times(e.joursCpRestants)));
    const pv = c.calc('preavis', 'Indemnité compensatrice de préavis', `${fr(s)} × ${frn(e.moisPreavisNonEffectue)}`, euros(s.times(e.moisPreavisNonEffectue)));
    c.calc('total', 'Total brut du solde de tout compte', 'somme des éléments', somme([pr, iccp, pv, e.indemniteRupture]), 'EUR', { principal: true });
    c.ctrl('info', 'DOCUMENTS', 'Remettre aussi le certificat de travail et l’attestation France Travail.');
  },
});

export const prelevementSource = formule({
  id: 'pas',
  moteur: M,
  nom: 'Prélèvement à la source',
  categorie: 'Impôt',
  description: 'Calcule la retenue à la source sur le net imposable avec le taux transmis par la DGFiP ou la grille du taux neutre.',
  expression: 'PAS = net imposable × taux (personnalisé ou grille neutre selon la base mensuelle)',
  references: [{ texte: 'CGI art. 204 A, 204 H et 204 J' }],
  baremes: ['paie.pas-metropole'],
  champs: [
    dateOperation('Mois de versement', { defaut: '2025-06-30' }),
    montant('netImposable', 'Net imposable du mois', { defaut: '2650' }),
    choix('mode', 'Taux', [
      ['neutre', 'Taux neutre (grille métropole)'],
      ['personnalise', 'Taux personnalisé'],
    ]),
    taux('taux', 'Taux personnalisé', { defaut: '6.2', visibleSi: { champ: 'mode', valeurs: ['personnalise'] } }),
  ],
  exemples: [{ titre: 'Grille 2025', entrees: {}, attendu: { taux: '5.30', pas: '140.45' } }],
  calculer(e, c) {
    const t = e.mode === 'neutre' ? tauxNeutre(c.bareme<GrillePas>('paie.pas-metropole', e.dateOperation), e.netImposable) : (e.taux as Decimal);
    c.res('taux', 'Taux appliqué', t, '%');
    c.calc('pas', 'Retenue à la source', `${fr(e.netImposable)} × ${fp(t)}`, euros(d(e.netImposable).times(t)), 'EUR', { principal: true });
    c.calc('netApresImpot', 'Net après impôt', 'net imposable − PAS (indicatif)', d(e.netImposable).minus(euros(d(e.netImposable).times(t))));
  },
});

export const masseSalariale = formule({
  id: 'masse-salariale',
  moteur: M,
  nom: 'Masse salariale et coût employeur',
  categorie: 'Coût employeur',
  description: 'Agrège la masse salariale annuelle, les charges patronales, le coût total, le coût moyen par salarié et le coût horaire moyen.',
  expression: 'Coût = Σ brut × mois × (1 + taux de charges) ; coût horaire = coût / heures annuelles',
  references: [{ texte: 'PCG comptes 641 et 645' }, { texte: 'DSN — déclaration sociale nominative' }],
  champs: [
    table('salaries', 'Salariés', [texte('nom', 'Salarié'), montant('brutMensuel', 'Brut mensuel'), nombre('mois', 'Mois versés', { defaut: '12' }), taux('charges', 'Charges patronales', { defaut: '42' }), nombre('heuresAnnuelles', 'Heures annuelles', { defaut: '1607' })], {
      min: '1',
      defaut: [
        { nom: 'Directrice', brutMensuel: '5800', mois: '13', charges: '45', heuresAnnuelles: '1607' },
        { nom: 'Comptable', brutMensuel: '3100', mois: '12', charges: '42', heuresAnnuelles: '1607' },
        { nom: 'Assistant', brutMensuel: '2050', mois: '12', charges: '28', heuresAnnuelles: '1607' },
      ],
    }),
  ],
  exemples: [{ titre: 'TPE', entrees: {}, attendu: { masse: '137200.00', charges: '56442.00', coutTotal: '193642.00' } }],
  calculer(e, c) {
    type S = { nom: string; brutMensuel: Decimal; mois: Decimal; charges: Decimal; heuresAnnuelles: Decimal };
    const ss = e.salaries as S[];
    let masse = ZERO;
    let charges = ZERO;
    let heures = ZERO;
    const lignes = ss.map((s) => {
      const brut = euros(s.brutMensuel.times(s.mois));
      const ch = euros(brut.times(s.charges));
      masse = masse.plus(brut);
      charges = charges.plus(ch);
      heures = heures.plus(s.heuresAnnuelles);
      return { nom: s.nom, brut: brut.toFixed(2), charges: ch.toFixed(2), cout: brut.plus(ch).toFixed(2), horaire: euros(brut.plus(ch).div(s.heuresAnnuelles)).toFixed(2) };
    });
    c.calc('masse', 'Masse salariale brute', 'Σ brut × mois', masse, 'EUR', { principal: true });
    c.calc('charges', 'Charges patronales', 'Σ brut × taux', charges);
    const cout = c.calc('coutTotal', 'Coût total employeur', 'masse + charges', masse.plus(charges), 'EUR', { principal: true });
    c.calc('coutMoyen', 'Coût moyen par salarié', `${fr(cout)} / ${ss.length}`, euros(cout.div(ss.length)));
    c.calc('coutHoraire', 'Coût horaire moyen', `${fr(cout)} / ${frn(heures)} h`, euros(cout.div(heures)));
    c.calc('ratioCharges', 'Charges / masse salariale', `${fr(charges)} / ${fr(masse)}`, charges.div(masse), '%');
    c.tableau({
      titre: 'Coût par salarié',
      colonnes: [
        { cle: 'nom', libelle: 'Salarié', unite: 'texte' },
        { cle: 'brut', libelle: 'Brut annuel', unite: 'EUR' },
        { cle: 'charges', libelle: 'Charges', unite: 'EUR' },
        { cle: 'cout', libelle: 'Coût total', unite: 'EUR' },
        { cle: 'horaire', libelle: 'Coût horaire', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres-empilees', x: 'nom', series: ['brut', 'charges'] },
    });
  },
});

export const formulesPaie = [
  bulletin,
  netVersBrut,
  conversionSalaire,
  heuresSupplementaires,
  heuresComplementaires,
  avantageVehicule,
  avantageRepas,
  congesPayes,
  indemniteLicenciement,
  ruptureConventionnelle,
  indemnitePrecarite,
  ijssMaladie,
  maintienSalaire,
  activitePartielle,
  soldeToutCompte,
  prelevementSource,
  masseSalariale,
];
