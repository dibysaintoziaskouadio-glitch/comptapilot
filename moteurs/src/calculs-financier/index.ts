/**
 * MOTEUR 7 — Analyse financière : états financiers depuis la balance, SIG, CAF,
 * bilan fonctionnel, ratios (rentabilité, structure, liquidité, activité,
 * boursiers), leviers.
 */
import {
  choix,
  Contexte,
  d,
  Decimal,
  diviser,
  euros,
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
} from '../noyau';

const M = 'financier' as const;

const REF_SIG = { texte: 'PCG art. 821-1 à 821-4 — modèles de compte de résultat ; liasse 2052-2053 et 2033-B' };
const REF_ANALYSE = { texte: 'Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière' };

export interface DonneesSig {
  ventesMarchandises: Decimal;
  achatsMarchandises: Decimal;
  variationStockMarchandises: Decimal;
  productionVendue: Decimal;
  productionStockee: Decimal;
  productionImmobilisee: Decimal;
  consommationsTiers: Decimal;
  subventionsExploitation: Decimal;
  impotsTaxes: Decimal;
  chargesPersonnel: Decimal;
  autresProduits: Decimal;
  reprisesTransferts: Decimal;
  autresCharges: Decimal;
  dotationsExploitation: Decimal;
  produitsFinanciers: Decimal;
  chargesFinancieres: Decimal;
  produitsExceptionnels: Decimal;
  chargesExceptionnelles: Decimal;
  participation: Decimal;
  impotBenefices: Decimal;
}

export interface Sig {
  margeCommerciale: Decimal;
  production: Decimal;
  valeurAjoutee: Decimal;
  ebe: Decimal;
  resultatExploitation: Decimal;
  rcai: Decimal;
  resultatExceptionnel: Decimal;
  resultatNet: Decimal;
}

export function calculerSig(s: DonneesSig): Sig {
  const margeCommerciale = s.ventesMarchandises.minus(s.achatsMarchandises).minus(s.variationStockMarchandises);
  const production = s.productionVendue.plus(s.productionStockee).plus(s.productionImmobilisee);
  const valeurAjoutee = margeCommerciale.plus(production).minus(s.consommationsTiers);
  const ebe = valeurAjoutee.plus(s.subventionsExploitation).minus(s.impotsTaxes).minus(s.chargesPersonnel);
  const resultatExploitation = ebe.plus(s.autresProduits).plus(s.reprisesTransferts).minus(s.autresCharges).minus(s.dotationsExploitation);
  const rcai = resultatExploitation.plus(s.produitsFinanciers).minus(s.chargesFinancieres);
  const resultatExceptionnel = s.produitsExceptionnels.minus(s.chargesExceptionnelles);
  const resultatNet = rcai.plus(resultatExceptionnel).minus(s.participation).minus(s.impotBenefices);
  return { margeCommerciale, production, valeurAjoutee, ebe, resultatExploitation, rcai, resultatExceptionnel, resultatNet };
}

function publierSig(c: Contexte, s: DonneesSig, sig: Sig): void {
  const ca = s.ventesMarchandises.plus(s.productionVendue);
  c.etape('Marge commerciale', 'ventes de marchandises − (achats + variation de stock)', sig.margeCommerciale, 'EUR');
  c.etape('Production de l’exercice', 'vendue + stockée + immobilisée', sig.production, 'EUR');
  c.etape('Valeur ajoutée', 'marge commerciale + production − consommations en provenance des tiers', sig.valeurAjoutee, 'EUR');
  c.etape('Excédent brut d’exploitation', 'VA + subventions − impôts et taxes − charges de personnel', sig.ebe, 'EUR');
  c.etape('Résultat d’exploitation', 'EBE + reprises + autres produits − dotations − autres charges', sig.resultatExploitation, 'EUR');
  c.etape('Résultat courant avant impôts', 'RE + produits financiers − charges financières', sig.rcai, 'EUR');
  c.etape('Résultat exceptionnel', 'produits exceptionnels − charges exceptionnelles', sig.resultatExceptionnel, 'EUR');
  c.etape('Résultat net', 'RCAI + résultat exceptionnel − participation − IS', sig.resultatNet, 'EUR');
  c.res('chiffreAffaires', 'Chiffre d’affaires', ca, 'EUR', { groupe: 'SIG' });
  c.res('margeCommerciale', 'Marge commerciale', sig.margeCommerciale, 'EUR', { groupe: 'SIG' });
  c.res('production', 'Production de l’exercice', sig.production, 'EUR', { groupe: 'SIG' });
  c.res('valeurAjoutee', 'Valeur ajoutée', sig.valeurAjoutee, 'EUR', { groupe: 'SIG' });
  c.res('ebe', 'EBE', sig.ebe, 'EUR', { groupe: 'SIG', principal: true });
  c.res('resultatExploitation', 'Résultat d’exploitation', sig.resultatExploitation, 'EUR', { groupe: 'SIG' });
  c.res('rcai', 'RCAI', sig.rcai, 'EUR', { groupe: 'SIG' });
  c.res('resultatExceptionnel', 'Résultat exceptionnel', sig.resultatExceptionnel, 'EUR', { groupe: 'SIG' });
  c.res('resultatNet', 'Résultat net', sig.resultatNet, 'EUR', { groupe: 'SIG', principal: true });
  const pc = (v: Decimal) => (ca.isZero() ? '' : v.div(ca).times(100).toFixed(2));
  c.tableau({
    titre: 'Soldes intermédiaires de gestion',
    colonnes: [
      { cle: 'solde', libelle: 'Solde', unite: 'texte' },
      { cle: 'montant', libelle: 'Montant', unite: 'EUR' },
      { cle: 'pctCa', libelle: '% du CA', unite: '%' },
    ],
    lignes: [
      ['Chiffre d’affaires', ca],
      ['Marge commerciale', sig.margeCommerciale],
      ['Production de l’exercice', sig.production],
      ['Valeur ajoutée', sig.valeurAjoutee],
      ['Excédent brut d’exploitation', sig.ebe],
      ['Résultat d’exploitation', sig.resultatExploitation],
      ['Résultat courant avant impôts', sig.rcai],
      ['Résultat exceptionnel', sig.resultatExceptionnel],
      ['Résultat net', sig.resultatNet],
    ].map(([solde, v]) => ({ solde: solde as string, montant: (v as Decimal).toFixed(2), pctCa: pc(v as Decimal) })),
    graphique: { type: 'barres', x: 'solde', series: ['montant'] },
  });
  if (!ca.isZero()) {
    c.res('tauxMarge', 'Taux de marge commerciale', diviser(sig.margeCommerciale, s.ventesMarchandises), '%', { groupe: 'Taux' });
    c.res('tauxVa', 'Taux de valeur ajoutée (VA / CA)', sig.valeurAjoutee.div(ca), '%', { groupe: 'Taux' });
    c.res('tauxEbe', 'Taux de marge brute d’exploitation (EBE / CA)', sig.ebe.div(ca), '%', { groupe: 'Taux' });
  }
  if (sig.ebe.isNegative()) c.ctrl('avertissement', 'EBE_NEGATIF', 'EBE négatif : l’exploitation ne dégage pas de ressources.');
}

const champsSig = [
  montant('ventesMarchandises', 'Ventes de marchandises (707)', { defaut: '850000', groupe: 'Commerce' }),
  montant('achatsMarchandises', 'Achats de marchandises (607)', { defaut: '520000', groupe: 'Commerce' }),
  montant('variationStockMarchandises', 'Variation de stock de marchandises (6037, SI − SF)', { defaut: '-12000', groupe: 'Commerce' }),
  montant('productionVendue', 'Production vendue (70 hors 707)', { defaut: '310000', groupe: 'Production' }),
  montant('productionStockee', 'Production stockée (71)', { defaut: '8000', groupe: 'Production' }),
  montant('productionImmobilisee', 'Production immobilisée (72)', { defaut: '0', groupe: 'Production' }),
  montant('consommationsTiers', 'Consommations en provenance des tiers (60 hors 607, 61, 62)', { defaut: '196000', groupe: 'Production' }),
  montant('subventionsExploitation', 'Subventions d’exploitation (74)', { defaut: '5000', groupe: 'Exploitation' }),
  montant('impotsTaxes', 'Impôts et taxes (63)', { defaut: '14500', groupe: 'Exploitation' }),
  montant('chargesPersonnel', 'Charges de personnel (64)', { defaut: '298000', groupe: 'Exploitation' }),
  montant('autresProduits', 'Autres produits (75)', { defaut: '1500', groupe: 'Exploitation' }),
  montant('reprisesTransferts', 'Reprises et transferts de charges (781, 791)', { defaut: '6000', groupe: 'Exploitation' }),
  montant('autresCharges', 'Autres charges (65)', { defaut: '3200', groupe: 'Exploitation' }),
  montant('dotationsExploitation', 'Dotations d’exploitation (681)', { defaut: '42000', groupe: 'Exploitation' }),
  montant('produitsFinanciers', 'Produits financiers (76, 786, 796)', { defaut: '1800', groupe: 'Financier' }),
  montant('chargesFinancieres', 'Charges financières (66, 686)', { defaut: '9400', groupe: 'Financier' }),
  montant('produitsExceptionnels', 'Produits exceptionnels (77, 787, 797)', { defaut: '4000', groupe: 'Exceptionnel' }),
  montant('chargesExceptionnelles', 'Charges exceptionnelles (67, 687)', { defaut: '2500', groupe: 'Exceptionnel' }),
  montant('participation', 'Participation des salariés (691)', { defaut: '0', groupe: 'Résultat' }),
  montant('impotBenefices', 'Impôt sur les bénéfices (695)', { defaut: '24000', groupe: 'Résultat' }),
];

export const sig = formule({
  id: 'sig',
  moteur: M,
  nom: 'Soldes intermédiaires de gestion',
  categorie: 'Compte de résultat',
  description: 'Calcule en cascade la marge commerciale, la production, la valeur ajoutée, l’EBE, le résultat d’exploitation, le RCAI, le résultat exceptionnel et le résultat net, et contrôle la concordance avec le résultat comptable.',
  expression: 'MC → VA = MC + production − consommations → EBE = VA + subventions − impôts − personnel → RE → RCAI → RN',
  references: [REF_SIG],
  champs: [...champsSig, montant('resultatComptable', 'Résultat comptable à rapprocher (optionnel)', { optionnel: true, groupe: 'Résultat' })],
  exemples: [{ titre: 'PME industrielle et commerciale', entrees: {}, attendu: { margeCommerciale: '342000.00', valeurAjoutee: '464000.00', ebe: '156500.00', resultatExploitation: '118800.00', resultatNet: '88700.00' } }],
  calculer(e, c) {
    const s = calculerSig(e as DonneesSig);
    publierSig(c, e as DonneesSig, s);
    if (e.resultatComptable !== undefined)
      c.verifier(s.resultatNet.equals(e.resultatComptable), 'CONCORDANCE_RN', 'Le résultat net des SIG concorde avec le résultat comptable.', `Écart de ${fe(s.resultatNet.minus(e.resultatComptable))} entre les SIG et le résultat comptable.`);
  },
});

export const caf = formule({
  id: 'caf',
  moteur: M,
  nom: 'Capacité d’autofinancement',
  categorie: 'Compte de résultat',
  description: 'Calcule la CAF par la méthode additive (depuis le résultat net) et par la méthode soustractive (depuis l’EBE), vérifie leur égalité, puis l’autofinancement et les ratios associés.',
  expression: 'Additive : RN + dotations − reprises + VNC cédées − produits de cession − QP subventions ; soustractive : EBE + autres produits − autres charges + PF encaissables − CF décaissables + PE encaissables − CE décaissables − participation − IS',
  references: [{ texte: 'PCG — tableau de financement (art. 832-13) ; liasse 2033-B / Banque de France' }],
  champs: [
    montant('resultatNet', 'Résultat net', { defaut: '88700', groupe: 'Additive' }),
    montant('dotations', 'Dotations aux amortissements, dépréciations et provisions (681, 686, 687)', { defaut: '43000', groupe: 'Additive' }),
    montant('reprises', 'Reprises (781, 786, 787)', { defaut: '6000', groupe: 'Additive' }),
    montant('vncCedees', 'Valeur comptable des éléments cédés (675)', { defaut: '1500', groupe: 'Additive' }),
    montant('produitsCessions', 'Produits des cessions d’éléments d’actif (775)', { defaut: '3000', groupe: 'Additive' }),
    montant('quotePartSubventions', 'Quote-part des subventions virée au résultat (777)', { defaut: '1000', groupe: 'Additive' }),
    montant('ebe', 'EBE', { defaut: '156500', groupe: 'Soustractive' }),
    montant('autresProduits', 'Autres produits d’exploitation (75)', { defaut: '1500', groupe: 'Soustractive' }),
    montant('autresCharges', 'Autres charges d’exploitation (65)', { defaut: '3200', groupe: 'Soustractive' }),
    montant('transfertsCharges', 'Transferts de charges (791)', { defaut: '0', groupe: 'Soustractive' }),
    montant('produitsFinanciersEnc', 'Produits financiers encaissables (76 + 796)', { defaut: '1800', groupe: 'Soustractive' }),
    montant('chargesFinancieresDec', 'Charges financières décaissables (66)', { defaut: '9400', groupe: 'Soustractive' }),
    montant('produitsExceptionnelsEnc', 'Produits exceptionnels encaissables (771, 778, 797)', { defaut: '0', groupe: 'Soustractive' }),
    montant('chargesExceptionnellesDec', 'Charges exceptionnelles décaissables (671, 678)', { defaut: '0', groupe: 'Soustractive' }),
    montant('participation', 'Participation (691)', { defaut: '0', groupe: 'Soustractive' }),
    montant('impot', 'Impôt sur les bénéfices (695)', { defaut: '24000', groupe: 'Soustractive' }),
    montant('dividendes', 'Dividendes versés dans l’exercice', { defaut: '30000', groupe: 'Autofinancement' }),
    montant('ca', 'Chiffre d’affaires HT', { defaut: '1160000', groupe: 'Autofinancement' }),
    montant('dettesFinancieres', 'Dettes financières', { defaut: '210000', groupe: 'Autofinancement' }),
  ],
  exemples: [{ titre: 'Concordance', entrees: {}, attendu: { cafAdditive: '123200.00', cafSoustractive: '123200.00', autofinancement: '93200.00' } }],
  calculer(e, c) {
    const add = c.calc('cafAdditive', 'CAF (méthode additive)', 'RN + dotations − reprises + VNC − produits de cession − QP subventions', somme([e.resultatNet, e.dotations, d(e.reprises).neg(), e.vncCedees, d(e.produitsCessions).neg(), d(e.quotePartSubventions).neg()]), 'EUR', { principal: true });
    const sou = c.calc('cafSoustractive', 'CAF (méthode soustractive)', 'EBE + AP − AC + TC + PF − CF + PE − CE − participation − IS', somme([e.ebe, e.autresProduits, d(e.autresCharges).neg(), e.transfertsCharges, e.produitsFinanciersEnc, d(e.chargesFinancieresDec).neg(), e.produitsExceptionnelsEnc, d(e.chargesExceptionnellesDec).neg(), d(e.participation).neg(), d(e.impot).neg()]));
    c.verifier(
      add.equals(sou),
      'CONCORDANCE_CAF',
      'Les deux méthodes donnent la même CAF.',
      `Écart de ${fe(add.minus(sou))} entre les méthodes : vérifier le classement des produits et charges exceptionnels (encaissables / calculés).`,
      'avertissement',
    );
    c.calc('autofinancement', 'Autofinancement', `${fr(add)} − dividendes ${fr(e.dividendes)}`, add.minus(e.dividendes));
    if (!d(e.ca).isZero()) c.calc('cafSurCa', 'CAF / CA', `${fr(add)} / ${fr(e.ca)}`, add.div(e.ca), '%');
    if (add.greaterThan(0)) {
      const cr = c.calc('capaciteRemboursement', 'Capacité de remboursement (dettes financières / CAF)', `${fr(e.dettesFinancieres)} / ${fr(add)}`, d(e.dettesFinancieres).div(add), 'annees', { decimales: 2 });
      if (cr.greaterThan(4)) c.ctrl('avertissement', 'CAPACITE_REMBOURSEMENT', 'Dettes financières > 4 années de CAF : endettement élevé au regard de la capacité de remboursement.');
    } else c.ctrl('erreur', 'CAF_NEGATIVE', 'CAF négative : insuffisance d’autofinancement.');
  },
});

export const bilanFonctionnel = formule({
  id: 'bilan-fonctionnel',
  moteur: M,
  nom: 'Bilan fonctionnel : FRNG, BFR, trésorerie',
  categorie: 'Bilan',
  description: 'Reclasse le bilan en emplois et ressources stables, calcule le fonds de roulement net global, le BFR d’exploitation et hors exploitation, la trésorerie nette, et vérifie l’identité FRNG − BFR = TN.',
  expression: 'FRNG = ressources stables − emplois stables ; BFR = stocks + créances − dettes non financières ; TN = disponibilités − concours bancaires = FRNG − BFR',
  references: [{ texte: 'PCG — tableau de financement (art. 832-13 et s.)' }, REF_ANALYSE],
  champs: [
    montant('capitauxPropres', 'Capitaux propres', { defaut: '420000', groupe: 'Ressources stables' }),
    montant('amortissementsProvisions', 'Amortissements, dépréciations et provisions', { defaut: '310000', groupe: 'Ressources stables' }),
    montant('dettesFinancieres', 'Dettes financières (hors concours bancaires courants)', { defaut: '210000', groupe: 'Ressources stables' }),
    montant('actifImmobiliseBrut', 'Actif immobilisé brut', { defaut: '760000', groupe: 'Emplois stables' }),
    montant('stocks', 'Stocks (bruts)', { defaut: '145000', groupe: 'Exploitation' }),
    montant('creancesExploitation', 'Créances d’exploitation (clients, TVA déductible…)', { defaut: '236000', groupe: 'Exploitation' }),
    montant('dettesExploitation', 'Dettes d’exploitation (fournisseurs, fiscales et sociales)', { defaut: '198000', groupe: 'Exploitation' }),
    montant('creancesHorsExploitation', 'Créances hors exploitation', { defaut: '12000', groupe: 'Hors exploitation' }),
    montant('dettesHorsExploitation', 'Dettes hors exploitation (IS, immobilisations…)', { defaut: '26000', groupe: 'Hors exploitation' }),
    montant('disponibilites', 'Disponibilités et VMP', { defaut: '11000', groupe: 'Trésorerie' }),
    montant('concoursBancaires', 'Concours bancaires courants', { defaut: '0', groupe: 'Trésorerie' }),
    montant('ca', 'Chiffre d’affaires HT (pour les jours de CA)', { defaut: '1160000', groupe: 'Trésorerie' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { frng: '180000.00', bfre: '183000.00', bfr: '169000.00', tresorerieNette: '11000.00', tresorerieBilan: '11000.00' } }],
  calculer(e, c) {
    const rs = c.calc('ressourcesStables', 'Ressources stables', 'CP + amortissements et provisions + dettes financières', somme([e.capitauxPropres, e.amortissementsProvisions, e.dettesFinancieres]));
    const fr_ = c.calc('frng', 'Fonds de roulement net global', `${fr(rs)} − ${fr(e.actifImmobiliseBrut)}`, rs.minus(e.actifImmobiliseBrut), 'EUR', { principal: true });
    const bfre = c.calc('bfre', 'BFR d’exploitation', 'stocks + créances d’exploitation − dettes d’exploitation', somme([e.stocks, e.creancesExploitation, d(e.dettesExploitation).neg()]));
    const bfrhe = c.calc('bfrhe', 'BFR hors exploitation', 'créances HE − dettes HE', d(e.creancesHorsExploitation).minus(e.dettesHorsExploitation));
    const bfr = c.calc('bfr', 'Besoin en fonds de roulement', 'BFRE + BFRHE', bfre.plus(bfrhe), 'EUR', { principal: true });
    const tn = c.calc('tresorerieNette', 'Trésorerie nette (FRNG − BFR)', `${fr(fr_)} − ${fr(bfr)}`, fr_.minus(bfr), 'EUR', { principal: true });
    const tb = c.calc('tresorerieBilan', 'Trésorerie nette (disponibilités − concours)', `${fr(e.disponibilites)} − ${fr(e.concoursBancaires)}`, d(e.disponibilites).minus(e.concoursBancaires));
    c.verifier(tn.equals(tb), 'IDENTITE_TRESORERIE', 'Identité vérifiée : FRNG − BFR = trésorerie nette (bilan équilibré).', `FRNG − BFR (${fe(tn)}) ≠ trésorerie du bilan (${fe(tb)}) : le bilan saisi n’est pas équilibré (écart ${fe(tn.minus(tb))}).`);
    if (!d(e.ca).isZero()) {
      c.calc('frngJours', 'FRNG en jours de CA', `${fr(fr_)} / ${fr(e.ca)} × 360`, fr_.div(e.ca).times(360), 'jours', { decimales: 1 });
      c.calc('bfreJours', 'BFRE en jours de CA', `${fr(bfre)} / ${fr(e.ca)} × 360`, bfre.div(e.ca).times(360), 'jours', { decimales: 1 });
    }
    c.calc('couvertureEmploisStables', 'Couverture des emplois stables', `${fr(rs)} / ${fr(e.actifImmobiliseBrut)}`, diviser(rs, e.actifImmobiliseBrut), 'fois', { decimales: 2 });
    if (fr_.isNegative()) c.ctrl('avertissement', 'FRNG_NEGATIF', 'FRNG négatif : des emplois stables sont financés par des ressources à court terme.');
    if (tn.isNegative()) c.ctrl('avertissement', 'TRESORERIE_NEGATIVE', 'Trésorerie nette négative : dépendance aux concours bancaires.');
  },
});

export const ratiosRentabilite = formule({
  id: 'ratios-rentabilite',
  moteur: M,
  nom: 'Ratios de rentabilité',
  categorie: 'Ratios',
  description: 'Marges (brute, d’EBE, nette), rentabilité financière (ROE), rentabilité des actifs (ROA), rentabilité économique, ROCE et ROIC (NOPAT / capitaux investis).',
  expression: 'ROE = RN / CP ; ROA = RN / total actif ; ROCE = RE / capitaux employés ; ROIC = RE × (1 − t) / capitaux investis',
  references: [REF_ANALYSE],
  champs: [
    montant('ca', 'Chiffre d’affaires HT', { defaut: '1160000' }),
    montant('coutAchat', 'Coût d’achat des marchandises vendues', { defaut: '508000' }),
    montant('ebe', 'EBE', { defaut: '156500' }),
    montant('resultatExploitation', 'Résultat d’exploitation (EBIT)', { defaut: '118800' }),
    montant('resultatNet', 'Résultat net', { defaut: '88700' }),
    montant('capitauxPropres', 'Capitaux propres', { defaut: '420000' }),
    montant('totalActif', 'Total actif', { defaut: '904000' }),
    montant('dettesFinancieres', 'Dettes financières', { defaut: '210000' }),
    montant('tresorerie', 'Trésorerie active', { defaut: '61000' }),
    taux('tauxIs', 'Taux d’impôt normatif', { defaut: '25' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { margeNette: '7.65', roe: '21.12', roa: '9.81', roce: '20.88', roic: '15.66' } }],
  calculer(e, c) {
    const ca: Decimal = e.ca;
    c.calc('margeBrute', 'Taux de marge brute', `(${fr(ca)} − ${fr(e.coutAchat)}) / ${fr(ca)}`, diviser(ca.minus(e.coutAchat), ca), '%');
    c.calc('margeEbe', 'Marge d’EBE', `${fr(e.ebe)} / ${fr(ca)}`, diviser(e.ebe, ca), '%');
    c.calc('margeExploitation', 'Marge opérationnelle', `${fr(e.resultatExploitation)} / ${fr(ca)}`, diviser(e.resultatExploitation, ca), '%');
    c.calc('margeNette', 'Marge nette', `${fr(e.resultatNet)} / ${fr(ca)}`, diviser(e.resultatNet, ca), '%');
    c.calc('roe', 'Rentabilité financière (ROE)', `${fr(e.resultatNet)} / ${fr(e.capitauxPropres)}`, diviser(e.resultatNet, e.capitauxPropres), '%', { principal: true });
    c.calc('roa', 'Rentabilité des actifs (ROA)', `${fr(e.resultatNet)} / ${fr(e.totalActif)}`, diviser(e.resultatNet, e.totalActif), '%');
    const ce = c.etape('Capitaux employés', 'CP + dettes financières − trésorerie', somme([e.capitauxPropres, e.dettesFinancieres, d(e.tresorerie).neg()]), 'EUR');
    c.calc('roce', 'ROCE (RE / capitaux employés)', `${fr(e.resultatExploitation)} / ${fr(ce)}`, diviser(e.resultatExploitation, ce), '%', { principal: true });
    const nopat = c.calc('nopat', 'NOPAT', `${fr(e.resultatExploitation)} × (1 − ${fp(e.tauxIs)})`, euros(d(e.resultatExploitation).times(UN.minus(e.tauxIs))));
    c.calc('roic', 'ROIC (NOPAT / capitaux investis)', `${fr(nopat)} / ${fr(ce)}`, diviser(nopat, ce), '%');
    if (d(e.capitauxPropres).lessThanOrEqualTo(0)) c.ctrl('erreur', 'CP_NEGATIFS', 'Capitaux propres nuls ou négatifs : ROE non significatif.');
  },
});

export const ratiosStructure = formule({
  id: 'ratios-structure',
  moteur: M,
  nom: 'Ratios de structure et d’endettement',
  categorie: 'Ratios',
  description: 'Autonomie financière, gearing brut et net, couverture des emplois stables, capacité de remboursement, poids des frais financiers.',
  expression: 'Autonomie = CP / total passif ; gearing = DF / CP ; gearing net = (DF − trésorerie) / CP ; capacité de remboursement = DF / CAF',
  references: [REF_ANALYSE],
  champs: [
    montant('capitauxPropres', 'Capitaux propres', { defaut: '420000' }),
    montant('totalPassif', 'Total du bilan', { defaut: '904000' }),
    montant('dettesFinancieres', 'Dettes financières', { defaut: '210000' }),
    montant('tresorerie', 'Trésorerie active', { defaut: '61000' }),
    montant('ressourcesStables', 'Ressources stables', { defaut: '940000' }),
    montant('emploisStables', 'Emplois stables', { defaut: '760000' }),
    montant('caf', 'CAF', { defaut: '124700' }),
    montant('chargesFinancieres', 'Charges financières', { defaut: '9400' }),
    montant('ebe', 'EBE', { defaut: '156500' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { autonomie: '46.46', gearing: '50.00', gearingNet: '35.48', capaciteRemboursement: '1.68' } }],
  calculer(e, c) {
    const aut = c.calc('autonomie', 'Autonomie financière', `${fr(e.capitauxPropres)} / ${fr(e.totalPassif)}`, diviser(e.capitauxPropres, e.totalPassif), '%', { principal: true });
    const g = c.calc('gearing', 'Endettement (gearing)', `${fr(e.dettesFinancieres)} / ${fr(e.capitauxPropres)}`, diviser(e.dettesFinancieres, e.capitauxPropres), '%');
    c.calc('gearingNet', 'Endettement net', `(${fr(e.dettesFinancieres)} − ${fr(e.tresorerie)}) / ${fr(e.capitauxPropres)}`, diviser(d(e.dettesFinancieres).minus(e.tresorerie), e.capitauxPropres), '%');
    c.calc('couverture', 'Couverture des emplois stables', `${fr(e.ressourcesStables)} / ${fr(e.emploisStables)}`, diviser(e.ressourcesStables, e.emploisStables), 'fois', { decimales: 2 });
    const cr = c.calc('capaciteRemboursement', 'Capacité de remboursement', `${fr(e.dettesFinancieres)} / ${fr(e.caf)}`, diviser(e.dettesFinancieres, e.caf), 'annees', { decimales: 2 });
    c.calc('fraisFinanciersEbe', 'Frais financiers / EBE', `${fr(e.chargesFinancieres)} / ${fr(e.ebe)}`, diviser(e.chargesFinancieres, e.ebe), '%');
    if (aut.lessThan('0.2')) c.ctrl('avertissement', 'AUTONOMIE', 'Autonomie financière < 20 % : structure fragile.');
    if (g.greaterThan(1)) c.ctrl('avertissement', 'GEARING', 'Dettes financières supérieures aux capitaux propres.');
    if (cr.greaterThan(4)) c.ctrl('avertissement', 'REMBOURSEMENT', 'Capacité de remboursement > 4 ans.');
  },
});

export const ratiosLiquidite = formule({
  id: 'ratios-liquidite',
  moteur: M,
  nom: 'Ratios de liquidité',
  categorie: 'Ratios',
  description: 'Liquidité générale, réduite (hors stocks) et immédiate, ratio de cash-flow.',
  expression: 'Générale = actif circulant / dettes CT ; réduite = (créances + trésorerie) / dettes CT ; immédiate = trésorerie / dettes CT',
  references: [REF_ANALYSE],
  champs: [
    montant('stocks', 'Stocks nets', { defaut: '145000' }),
    montant('creances', 'Créances à moins d’un an', { defaut: '248000' }),
    montant('tresorerie', 'Disponibilités et VMP', { defaut: '61000' }),
    montant('dettesCT', 'Dettes à moins d’un an', { defaut: '254000' }),
    montant('fluxExploitation', 'Flux de trésorerie d’exploitation', { defaut: '98000' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { generale: '1.79', reduite: '1.22', immediate: '0.24' } }],
  calculer(e, c) {
    const ac = somme([e.stocks, e.creances, e.tresorerie]);
    const g = c.calc('generale', 'Liquidité générale', `${fr(ac)} / ${fr(e.dettesCT)}`, diviser(ac, e.dettesCT), 'fois', { decimales: 2, principal: true });
    const r = c.calc('reduite', 'Liquidité réduite', `(${fr(e.creances)} + ${fr(e.tresorerie)}) / ${fr(e.dettesCT)}`, diviser(d(e.creances).plus(e.tresorerie), e.dettesCT), 'fois', { decimales: 2 });
    c.calc('immediate', 'Liquidité immédiate', `${fr(e.tresorerie)} / ${fr(e.dettesCT)}`, diviser(e.tresorerie, e.dettesCT), 'fois', { decimales: 2 });
    c.calc('cashFlowRatio', 'Ratio de cash-flow', `${fr(e.fluxExploitation)} / ${fr(e.dettesCT)}`, diviser(e.fluxExploitation, e.dettesCT), 'fois', { decimales: 2 });
    if (g.lessThan(1)) c.ctrl('avertissement', 'LIQUIDITE', 'Liquidité générale < 1 : l’actif circulant ne couvre pas les dettes à court terme.');
    if (r.lessThan('0.8')) c.ctrl('info', 'DEPENDANCE_STOCKS', 'Liquidité réduite < 0,8 : forte dépendance à l’écoulement des stocks.');
  },
});

export const ratiosActivite = formule({
  id: 'ratios-activite',
  moteur: M,
  nom: 'Ratios d’activité et de rotation (DSO, DPO)',
  categorie: 'Ratios',
  description: 'Rotation et durée de stockage, délai de recouvrement clients (DSO), délai de paiement fournisseurs (DPO), rotation de l’actif et des capitaux propres, cycle de conversion de trésorerie.',
  expression: 'Stock moyen = (SI + SF) / 2 ; rotation = coût des ventes / stock moyen ; DSO = clients / CA TTC × 360 ; DPO = fournisseurs / achats TTC × 360',
  references: [REF_ANALYSE],
  champs: [
    montant('caHT', 'Chiffre d’affaires HT', { defaut: '1160000' }),
    montant('achatsHT', 'Achats HT (marchandises et matières)', { defaut: '520000' }),
    montant('coutVentes', 'Coût d’achat des marchandises vendues', { defaut: '508000' }),
    montant('stockInitial', 'Stock initial', { defaut: '133000' }),
    montant('stockFinal', 'Stock final', { defaut: '145000' }),
    montant('clients', 'Créances clients TTC', { defaut: '212000' }),
    montant('fournisseurs', 'Dettes fournisseurs TTC', { defaut: '98000' }),
    taux('tva', 'Taux de TVA moyen', { defaut: '20' }),
    montant('totalActif', 'Total actif', { defaut: '904000' }),
    montant('capitauxPropres', 'Capitaux propres', { defaut: '420000' }),
    choix('base', 'Année commerciale', [
      ['360', '360 jours'],
      ['365', '365 jours'],
    ]),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { rotationStocks: '3.65', dureeStockage: '98.5', dso: '54.8', dpo: '56.5', cycleTresorerie: '96.8' } }],
  calculer(e, c) {
    const j = Number(e.base);
    const tva = UN.plus(e.tva);
    const sm = c.calc('stockMoyen', 'Stock moyen', `(${fr(e.stockInitial)} + ${fr(e.stockFinal)}) / 2`, d(e.stockInitial).plus(e.stockFinal).div(2));
    const rot = c.calc('rotationStocks', 'Rotation des stocks', `${fr(e.coutVentes)} / ${fr(sm)}`, diviser(e.coutVentes, sm), 'fois', { decimales: 2 });
    const ds = c.calc('dureeStockage', 'Durée moyenne de stockage', `${fr(sm)} / ${fr(e.coutVentes)} × ${j}`, diviser(sm, e.coutVentes).times(j), 'jours', { decimales: 1 });
    const dso = c.calc('dso', 'Délai clients (DSO)', `${fr(e.clients)} / (${fr(e.caHT)} × ${frn(tva)}) × ${j}`, diviser(e.clients, d(e.caHT).times(tva)).times(j), 'jours', { decimales: 1, principal: true });
    const dpo = c.calc('dpo', 'Délai fournisseurs (DPO)', `${fr(e.fournisseurs)} / (${fr(e.achatsHT)} × ${frn(tva)}) × ${j}`, diviser(e.fournisseurs, d(e.achatsHT).times(tva)).times(j), 'jours', { decimales: 1, principal: true });
    c.calc('cycleTresorerie', 'Cycle de conversion de trésorerie', 'stockage + DSO − DPO', ds.plus(dso).minus(dpo), 'jours', { decimales: 1 });
    c.calc('rotationActif', 'Rotation de l’actif', `${fr(e.caHT)} / ${fr(e.totalActif)}`, diviser(e.caHT, e.totalActif), 'fois', { decimales: 2 });
    c.calc('rotationCapitaux', 'Rotation des capitaux propres', `${fr(e.caHT)} / ${fr(e.capitauxPropres)}`, diviser(e.caHT, e.capitauxPropres), 'fois', { decimales: 2 });
    c.res('rotationStocksParCa', 'Rotation des stocks (sur CA)', diviser(e.caHT, sm), 'fois', { decimales: 2 });
    if (dso.greaterThan(60)) c.ctrl('avertissement', 'DSO', 'DSO > 60 jours : vérifier le respect des délais légaux par les clients (L.441-10).');
    if (dpo.greaterThan(60)) c.ctrl('avertissement', 'DPO', 'DPO > 60 jours : risque de non-respect des délais de paiement légaux.');
    if (rot.isZero()) c.ctrl('info', 'ROTATION', 'Rotation nulle : coût des ventes nul.');
  },
});

export const ratiosBoursiers = formule({
  id: 'ratios-boursiers',
  moteur: M,
  nom: 'Ratios boursiers',
  categorie: 'Ratios',
  description: 'Bénéfice par action, PER, dividende par action, taux de distribution, rendement, valeur comptable par action et Price-to-Book.',
  expression: 'BPA = RN / nb actions ; PER = cours / BPA ; rendement = DPA / cours ; PBR = cours / (CP / nb actions)',
  references: [{ texte: 'IAS 33 — résultat par action' }, REF_ANALYSE],
  champs: [
    montant('resultatNet', 'Résultat net part du groupe', { defaut: '12500000' }),
    nombre('nbActions', 'Nombre moyen pondéré d’actions', { defaut: '5000000', min: '1' }),
    montant('cours', 'Cours de l’action', { defaut: '38.40' }),
    montant('dividendes', 'Dividendes distribués', { defaut: '5000000' }),
    montant('capitauxPropres', 'Capitaux propres', { defaut: '96000000' }),
  ],
  exemples: [{ titre: 'Société cotée', entrees: {}, attendu: { bpa: '2.50', per: '15.36', dpa: '1.00', distribution: '40.00', rendement: '2.60', pbr: '2.00' } }],
  calculer(e, c) {
    const n: Decimal = e.nbActions;
    const bpa = c.calc('bpa', 'Bénéfice par action', `${fr(e.resultatNet)} / ${frn(n)}`, d(e.resultatNet).div(n), 'EUR', { principal: true });
    c.calc('per', 'PER', `${fr(e.cours)} / ${fr(bpa)}`, diviser(e.cours, bpa), 'fois', { decimales: 2, principal: true });
    const dpa = c.calc('dpa', 'Dividende par action', `${fr(e.dividendes)} / ${frn(n)}`, d(e.dividendes).div(n));
    c.calc('distribution', 'Taux de distribution', `${fr(e.dividendes)} / ${fr(e.resultatNet)}`, diviser(e.dividendes, e.resultatNet), '%');
    c.calc('rendement', 'Rendement du dividende', `${fr(dpa)} / ${fr(e.cours)}`, diviser(dpa, e.cours), '%');
    const vc = c.calc('valeurComptable', 'Valeur comptable par action', `${fr(e.capitauxPropres)} / ${frn(n)}`, d(e.capitauxPropres).div(n));
    c.calc('pbr', 'Price-to-Book', `${fr(e.cours)} / ${fr(vc)}`, diviser(e.cours, vc), 'fois', { decimales: 2 });
    c.calc('capitalisation', 'Capitalisation boursière', `${fr(e.cours)} × ${frn(n)}`, d(e.cours).times(n));
    if (bpa.isNegative()) c.ctrl('info', 'PER_NEGATIF', 'BPA négatif : PER non significatif.');
  },
});

export const leviers = formule({
  id: 'leviers',
  moteur: M,
  nom: 'Leviers opérationnel, financier et combiné',
  categorie: 'Ratios',
  description: 'Sensibilité du résultat aux variations d’activité (levier opérationnel), à l’endettement (levier financier, effet de levier sur la rentabilité des capitaux propres) et levier combiné.',
  expression: 'LO = MCV / RE ; LF = RE / (RE − charges financières) ; levier combiné = LO × LF ; Rf = [Re + (Re − i) × D / CP] × (1 − t)',
  references: [{ texte: 'Analyse financière — effet de levier (formule de Modigliani-Miller)' }],
  champs: [
    montant('ca', 'Chiffre d’affaires', { defaut: '1160000' }),
    montant('chargesVariables', 'Charges variables', { defaut: '696000' }),
    montant('chargesFixes', 'Charges fixes d’exploitation', { defaut: '345200' }),
    montant('chargesFinancieres', 'Charges financières (intérêts)', { defaut: '9400' }),
    montant('capitauxPropres', 'Capitaux propres', { defaut: '420000' }),
    montant('dettes', 'Dettes financières', { defaut: '210000' }),
    taux('tauxIs', 'Taux d’IS', { defaut: '25' }),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { resultatExploitation: '118800.00', levierOperationnel: '3.91', levierFinancier: '1.09', levierCombine: '4.24', rentabiliteFinanciere: '19.54' } }],
  calculer(e, c) {
    const mcv = c.calc('mcv', 'Marge sur coût variable', `${fr(e.ca)} − ${fr(e.chargesVariables)}`, d(e.ca).minus(e.chargesVariables));
    const re = c.calc('resultatExploitation', 'Résultat d’exploitation', `${fr(mcv)} − ${fr(e.chargesFixes)}`, mcv.minus(e.chargesFixes));
    if (re.lessThanOrEqualTo(0)) {
      c.ctrl('erreur', 'RE_NEGATIF', 'Résultat d’exploitation nul ou négatif : leviers non significatifs.');
      return;
    }
    const lo = c.calc('levierOperationnel', 'Levier opérationnel', `${fr(mcv)} / ${fr(re)}`, mcv.div(re), 'fois', { decimales: 2, principal: true });
    const rcai = re.minus(e.chargesFinancieres);
    const lf = c.calc('levierFinancier', 'Levier financier', `${fr(re)} / ${fr(rcai)}`, diviser(re, rcai), 'fois', { decimales: 2 });
    c.calc('levierCombine', 'Levier combiné', `${frn(lo, 4)} × ${frn(lf, 4)}`, lo.times(lf), 'fois', { decimales: 2 });
    const ae = d(e.capitauxPropres).plus(e.dettes);
    const reco = c.calc('rentabiliteEconomique', 'Rentabilité économique avant impôt', `${fr(re)} / ${fr(ae)}`, re.div(ae), '%');
    const i = c.calc('coutDette', 'Coût de la dette', `${fr(e.chargesFinancieres)} / ${fr(e.dettes)}`, diviser(e.chargesFinancieres, e.dettes), '%');
    c.calc('rentabiliteFinanciere', 'Rentabilité financière après impôt', `[${fp(reco, 2)} + (${fp(reco, 2)} − ${fp(i, 2)}) × ${fr(e.dettes)} / ${fr(e.capitauxPropres)}] × (1 − ${fp(e.tauxIs)})`, reco.plus(reco.minus(i).times(diviser(e.dettes, e.capitauxPropres))).times(UN.minus(e.tauxIs)), '%');
    c.ctrl(reco.greaterThan(i) ? 'ok' : 'avertissement', 'EFFET_LEVIER', reco.greaterThan(i) ? `Effet de levier positif : Re (${fp(reco, 2)}) > coût de la dette (${fp(i, 2)}).` : 'Effet de massue : la rentabilité économique est inférieure au coût de la dette.');
    c.res('lecture', 'Lecture', `Une hausse de 1 % du CA entraîne une hausse de ${frn(lo, 2)} % du résultat d’exploitation et de ${frn(lo.times(lf), 2)} % du résultat courant.`, 'texte');
  },
});

// ──────────────────────── États financiers depuis une balance ────────────────────────

interface LigneBalance {
  compte: string;
  libelle?: string;
  debit: Decimal;
  credit: Decimal;
}

const commence = (compte: string, ...prefixes: string[]) => prefixes.some((p) => compte.startsWith(p));

export const etatsDepuisBalance = formule({
  id: 'etats-depuis-balance',
  moteur: M,
  nom: 'États financiers depuis la balance',
  categorie: 'États financiers',
  description:
    'À partir d’une balance générale, construit automatiquement le bilan (actif net / passif), le compte de résultat et les SIG, en classant chaque compte selon le PCG et selon le sens de son solde ; contrôle l’équilibre de la balance et du bilan.',
  expression: 'Résultat = Σ classe 7 − Σ classe 6 ; Actif net = Σ soldes débiteurs d’actif − amortissements ; Passif = CP + résultat + provisions + dettes ; actif = passif',
  references: [
    { texte: 'Règlement ANC 2014-03 — plan de comptes (art. 932-1) et modèles d’états (art. 821-1 et s.)' },
    { texte: 'Code de commerce art. L.123-12 à L.123-14 — comptes annuels' },
  ],
  champs: [
    table('balance', 'Balance générale (soldes)', [texte('compte', 'Compte'), texte('libelle', 'Libellé', { optionnel: true }), montant('debit', 'Solde débiteur', { defaut: '0' }), montant('credit', 'Solde créditeur', { defaut: '0' })], {
      min: '2',
      defaut: [
        { compte: '101000', libelle: 'Capital', debit: '0', credit: '50000' },
        { compte: '106100', libelle: 'Réserve légale', debit: '0', credit: '30000' },
        { compte: '164000', libelle: 'Emprunts', debit: '0', credit: '40000' },
        { compte: '215400', libelle: 'Matériel industriel', debit: '90000', credit: '0' },
        { compte: '281540', libelle: 'Amortissements matériel', debit: '0', credit: '36000' },
        { compte: '370000', libelle: 'Stock de marchandises', debit: '25000', credit: '0' },
        { compte: '401000', libelle: 'Fournisseurs', debit: '0', credit: '18000' },
        { compte: '411000', libelle: 'Clients', debit: '32000', credit: '0' },
        { compte: '421000', libelle: 'Personnel', debit: '0', credit: '4000' },
        { compte: '431000', libelle: 'URSSAF', debit: '0', credit: '3500' },
        { compte: '445660', libelle: 'TVA déductible', debit: '2500', credit: '0' },
        { compte: '445710', libelle: 'TVA collectée', debit: '0', credit: '6000' },
        { compte: '512000', libelle: 'Banque', debit: '45700', credit: '0' },
        { compte: '603700', libelle: 'Variation de stock', debit: '0', credit: '5000' },
        { compte: '606000', libelle: 'Achats non stockés', debit: '6000', credit: '0' },
        { compte: '607000', libelle: 'Achats de marchandises', debit: '120000', credit: '0' },
        { compte: '613200', libelle: 'Loyers', debit: '18000', credit: '0' },
        { compte: '622600', libelle: 'Honoraires', debit: '4000', credit: '0' },
        { compte: '635100', libelle: 'Impôts directs', debit: '2500', credit: '0' },
        { compte: '641000', libelle: 'Salaires', debit: '60000', credit: '0' },
        { compte: '645000', libelle: 'Charges sociales', debit: '25000', credit: '0' },
        { compte: '681120', libelle: 'Dotations aux amortissements', debit: '12000', credit: '0' },
        { compte: '661100', libelle: 'Intérêts des emprunts', debit: '1800', credit: '0' },
        { compte: '695000', libelle: 'Impôt sur les bénéfices', debit: '3000', credit: '0' },
        { compte: '706000', libelle: 'Prestations de services', debit: '0', credit: '45000' },
        { compte: '707000', libelle: 'Ventes de marchandises', debit: '0', credit: '210000' },
      ],
    }),
  ],
  exemples: [
    {
      titre: 'Balance de clôture',
      entrees: {},
      attendu: { resultat: '7700.00', totalActif: '159200.00', totalPassif: '159200.00', margeCommerciale: '95000.00', valeurAjoutee: '112000.00', ebe: '24500.00', resultatNet: '7700.00' },
    },
  ],
  calculer(e, c) {
    const bal = (e.balance as LigneBalance[]).map((l) => ({ ...l, compte: l.compte.trim(), solde: l.debit.minus(l.credit) }));
    const td = somme(bal.map((l) => l.debit));
    const tc = somme(bal.map((l) => l.credit));
    c.res('totalDebit', 'Total débit de la balance', td);
    c.res('totalCredit', 'Total crédit de la balance', tc);
    c.verifier(td.equals(tc), 'BALANCE_EQUILIBREE', 'La balance est équilibrée.', `Balance déséquilibrée : écart de ${fe(td.minus(tc))}.`);
    const nonClasses = bal.filter((l) => !/^[1-7]\d/.test(l.compte));
    nonClasses.forEach((l) => c.ctrl('avertissement', 'COMPTE_NON_CLASSE', `Compte « ${l.compte} » non reconnu : exclu des états.`));

    // Compte de résultat : C = solde débiteur des préfixes, P = solde créditeur
    const C = (...p: string[]) => somme(bal.filter((l) => commence(l.compte, ...p)).map((l) => l.solde));
    const P = (...p: string[]) => C(...p).neg();
    const produits = P('7');
    const charges = C('6');
    const resultat = c.calc('resultat', 'Résultat de l’exercice', `Σ classe 7 (${fr(produits)}) − Σ classe 6 (${fr(charges)})`, produits.minus(charges), 'EUR', { principal: true });

    const s: DonneesSig = {
      ventesMarchandises: P('707', '7097'),
      achatsMarchandises: C('607', '6087', '6097'),
      variationStockMarchandises: C('6037'),
      productionVendue: P('70', '73').minus(P('707', '7097')),
      productionStockee: P('71'),
      productionImmobilisee: P('72'),
      consommationsTiers: C('60').minus(C('607', '6087', '6097', '6037')).plus(C('61', '62')),
      subventionsExploitation: P('74'),
      impotsTaxes: C('63'),
      chargesPersonnel: C('64'),
      autresProduits: P('75'),
      reprisesTransferts: P('781', '791'),
      autresCharges: C('65'),
      dotationsExploitation: C('681'),
      produitsFinanciers: P('76', '786', '796'),
      chargesFinancieres: C('66', '686'),
      produitsExceptionnels: P('77', '787', '797'),
      chargesExceptionnelles: C('67', '687'),
      participation: C('691'),
      impotBenefices: C('69').minus(C('691')),
    };
    const sg = calculerSig(s);
    publierSig(c, s, sg);
    c.verifier(sg.resultatNet.equals(resultat), 'CONCORDANCE_SIG', 'Cohérence CR : le résultat net des SIG égale Σ produits − Σ charges.', `Écart SIG / résultat : ${fe(sg.resultatNet.minus(resultat))} (comptes 6/7 non classés ?).`);

    // Bilan
    const deb = (l: { solde: Decimal }) => positif(l.solde);
    const cre = (l: { solde: Decimal }) => positif(l.solde.neg());
    const S = (pred: (cpt: string) => boolean, f: (l: { solde: Decimal }) => Decimal) => somme(bal.filter((l) => pred(l.compte)).map(f));
    const net = (pred: (cpt: string) => boolean) => somme(bal.filter((l) => pred(l.compte)).map((l) => l.solde));

    const immobilisations = net((x) => commence(x, '20', '21', '22', '23', '25', '26', '27', '28', '29'));
    const stocks = net((x) => commence(x, '3'));
    const clients = net((x) => commence(x, '41') && !commence(x, '419')).plus(net((x) => commence(x, '491')));
    const tiersAutres = (x: string) => commence(x, '40', '42', '43', '44', '45', '46', '47', '419') && !commence(x, '486', '487', '481');
    const autresCreances = S(tiersAutres, deb).plus(net((x) => commence(x, '49') && !commence(x, '491')));
    const cca = net((x) => commence(x, '486', '481'));
    const disponibilites = S((x) => commence(x, '50', '51', '52', '53', '54', '58', '59'), deb);
    const totalActif = c.calc('totalActif', 'Total actif net', 'immobilisations nettes + stocks + créances + disponibilités + CCA', somme([immobilisations, stocks, clients, autresCreances, cca, disponibilites]), 'EUR', { principal: true, groupe: 'Bilan' });

    const capitauxPropres = net((x) => commence(x, '10', '11', '12', '13', '14')).neg().plus(resultat);
    const provisions = net((x) => commence(x, '15')).neg();
    const concours = S((x) => commence(x, '51', '52', '54', '58', '59'), cre);
    const dettesFinancieres = net((x) => commence(x, '16', '17')).neg().plus(concours);
    const fournisseurs = S((x) => commence(x, '40'), cre);
    const fiscalesSociales = S((x) => commence(x, '42', '43', '44'), cre);
    const autresDettes = S((x) => commence(x, '45', '46', '47', '419') && !commence(x, '486', '487', '481'), cre);
    const pca = net((x) => commence(x, '487')).neg();
    const totalPassif = c.calc('totalPassif', 'Total passif', 'CP (résultat inclus) + provisions + dettes + PCA', somme([capitauxPropres, provisions, dettesFinancieres, fournisseurs, fiscalesSociales, autresDettes, pca]), 'EUR', { principal: true, groupe: 'Bilan' });
    c.res('capitauxPropres', 'Capitaux propres', capitauxPropres, 'EUR', { groupe: 'Bilan' });
    c.verifier(totalActif.equals(totalPassif), 'BILAN_EQUILIBRE', 'Cohérence bilan : total actif = total passif.', `Bilan déséquilibré : actif ${fe(totalActif)} / passif ${fe(totalPassif)}.`);
    if (!net((x) => commence(x, '12')).isZero() && !net((x) => commence(x, '6', '7')).isZero())
      c.ctrl('avertissement', 'RESULTAT_DOUBLE', 'La balance contient à la fois un compte 12 et des comptes de gestion : le résultat risque d’être compté deux fois.');
    if (capitauxPropres.isNegative()) c.ctrl('avertissement', 'CP_NEGATIFS', 'Capitaux propres négatifs.');
    c.tableau({
      titre: 'Bilan simplifié',
      colonnes: [
        { cle: 'actif', libelle: 'Actif', unite: 'texte' },
        { cle: 'montantActif', libelle: 'Net', unite: 'EUR' },
        { cle: 'passif', libelle: 'Passif', unite: 'texte' },
        { cle: 'montantPassif', libelle: 'Montant', unite: 'EUR' },
      ],
      lignes: [
        { actif: 'Immobilisations nettes', montantActif: immobilisations.toFixed(2), passif: 'Capitaux propres (dont résultat)', montantPassif: capitauxPropres.toFixed(2) },
        { actif: 'Stocks', montantActif: stocks.toFixed(2), passif: 'Provisions pour risques et charges', montantPassif: provisions.toFixed(2) },
        { actif: 'Créances clients', montantActif: clients.toFixed(2), passif: 'Dettes financières', montantPassif: dettesFinancieres.toFixed(2) },
        { actif: 'Autres créances', montantActif: autresCreances.toFixed(2), passif: 'Dettes fournisseurs', montantPassif: fournisseurs.toFixed(2) },
        { actif: 'Disponibilités', montantActif: disponibilites.toFixed(2), passif: 'Dettes fiscales et sociales', montantPassif: fiscalesSociales.toFixed(2) },
        { actif: 'Charges constatées d’avance', montantActif: cca.toFixed(2), passif: 'Autres dettes et PCA', montantPassif: autresDettes.plus(pca).toFixed(2) },
      ],
      totaux: { actif: 'Total', montantActif: totalActif.toFixed(2), passif: 'Total', montantPassif: totalPassif.toFixed(2) },
    });
    c.tableau({
      titre: 'Compte de résultat par classe',
      colonnes: [
        { cle: 'rubrique', libelle: 'Rubrique', unite: 'texte' },
        { cle: 'charges', libelle: 'Charges', unite: 'EUR' },
        { cle: 'produits', libelle: 'Produits', unite: 'EUR' },
      ],
      lignes: [
        { rubrique: 'Exploitation', charges: C('60', '61', '62', '63', '64', '65', '681').toFixed(2), produits: P('70', '71', '72', '73', '74', '75', '781', '791').toFixed(2) },
        { rubrique: 'Financier', charges: C('66', '686').toFixed(2), produits: P('76', '786', '796').toFixed(2) },
        { rubrique: 'Exceptionnel', charges: C('67', '687').toFixed(2), produits: P('77', '787', '797').toFixed(2) },
        { rubrique: 'Participation et impôts', charges: C('69').toFixed(2), produits: '0.00' },
      ],
      totaux: { rubrique: 'Total', charges: charges.toFixed(2), produits: produits.toFixed(2) },
    });
  },
});

export const formulesFinancier = [etatsDepuisBalance, sig, caf, bilanFonctionnel, ratiosRentabilite, ratiosStructure, ratiosLiquidite, ratiosActivite, ratiosBoursiers, leviers];
