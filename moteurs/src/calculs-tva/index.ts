/**
 * MOTEUR 2 — TVA : conversions, factures multi-taux, déclarations CA3 / CA12,
 * exigibilité, opérations intracommunautaires, autoliquidation, TVA sur marge,
 * coefficients de déduction, régularisations, FNP/FAE, importations.
 */
import {
  arrondi,
  arrondiFiscal,
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
  fe,
  formule,
  fp,
  fr,
  frn,
  montant,
  positif,
  somme,
  table,
  taux,
  TAUX_TVA_FR,
  texte,
  UN,
  ZERO,
} from '../noyau';
import './baremes';
import { SeuilsTva, TauxTva } from './baremes';

const M = 'tva' as const;

const REF_TAUX = { texte: 'CGI art. 278 à 281 nonies — taux de TVA' };

/** Contrôle qu'un taux saisi est un taux légal français à la date donnée. */
function controlerTaux(c: Contexte, t: Decimal, dateOp?: string): void {
  if (!dateOp) return;
  const b = c.bareme<TauxTva>('tva.taux', dateOp);
  const legaux = [b.normal, b.intermediaire, b.reduit, b.particulier, '0', b.dom.normal, b.dom.reduit, b.dom.particulier, ...b.corse];
  const enPct = t.times(100);
  if (!legaux.some((x) => d(x).equals(enPct)))
    c.ctrl('avertissement', 'TAUX_NON_LEGAL', `Le taux de ${fp(t)} n'est pas un taux légal de TVA en France au ${fd(dateOp)}.`);
}

export const htTtc = formule({
  id: 'ht-ttc',
  moteur: M,
  nom: 'Conversion HT ↔ TVA ↔ TTC',
  categorie: 'TVA France',
  description: 'À partir de n’importe lequel des trois montants (HT, TVA ou TTC) et du taux, calcule les deux autres. La TVA est arrondie au centime et le TTC est toujours égal à HT + TVA.',
  expression: 'TVA = HT × t ; TTC = HT + TVA ; HT = TTC / (1 + t) ; HT = TVA / t',
  references: [REF_TAUX, { texte: 'CGI art. 266 — base d’imposition' }, { texte: 'CGI ann. II art. 242 nonies A — arrondi de la TVA par taux' }],
  baremes: ['tva.taux'],
  champs: [
    choix('depuis', 'Montant connu', [
      ['HT', 'Montant HT'],
      ['TTC', 'Montant TTC'],
      ['TVA', 'Montant de TVA'],
    ]),
    montant('montant', 'Montant', { defaut: '1000' }),
    taux('taux', 'Taux de TVA', { defaut: '20', min: '0', max: '100', suggestions: TAUX_TVA_FR }),
    date('dateOperation', 'Date de l’opération (contrôle du taux)', { optionnel: true }),
  ],
  exemples: [
    { titre: 'HT → TTC à 20 %', entrees: {}, attendu: { ht: '1000.00', tva: '200.00', ttc: '1200.00' } },
    { titre: 'TTC → HT à 5,5 %', entrees: { depuis: 'TTC', montant: '105.50', taux: '5.5' }, attendu: { ht: '100.00', tva: '5.50' } },
    { titre: 'TTC non rond à 20 %', entrees: { depuis: 'TTC', montant: '99.99' }, attendu: { ht: '83.33', tva: '16.66', ttc: '99.99' } },
    { titre: 'TVA → HT à 10 %', entrees: { depuis: 'TVA', montant: '45', taux: '10' }, attendu: { ht: '450.00', ttc: '495.00' } },
  ],
  calculer(e, c) {
    const t: Decimal = e.taux;
    const m: Decimal = e.montant;
    controlerTaux(c, t, e.dateOperation);
    let ht: Decimal;
    let tva: Decimal;
    let ttc: Decimal;
    if (e.depuis === 'HT') {
      ht = c.etape('Montant HT', 'saisi', euros(m), 'EUR');
      tva = c.etape('TVA', `${fr(ht)} × ${fp(t)}`, euros(ht.times(t)), 'EUR');
      ttc = c.etape('TTC', `${fr(ht)} + ${fr(tva)}`, ht.plus(tva), 'EUR');
    } else if (e.depuis === 'TTC') {
      ttc = euros(m);
      ht = c.etape('Montant HT', `${fr(ttc)} / (1 + ${fp(t)})`, euros(ttc.div(UN.plus(t))), 'EUR');
      tva = c.etape('TVA', `${fr(ttc)} − ${fr(ht)}`, ttc.minus(ht), 'EUR');
    } else {
      if (t.isZero()) {
        c.ctrl('erreur', 'TAUX_NUL', 'Taux nul : impossible de retrouver la base HT depuis la TVA.');
        return;
      }
      tva = euros(m);
      ht = c.etape('Montant HT', `${fr(tva)} / ${fp(t)}`, euros(tva.div(t)), 'EUR');
      ttc = c.etape('TTC', `${fr(ht)} + ${fr(tva)}`, ht.plus(tva), 'EUR');
    }
    c.res('ht', 'Montant HT', ht, 'EUR', { principal: e.depuis !== 'HT' });
    c.res('tva', 'TVA', tva, 'EUR', { principal: true });
    c.res('ttc', 'Montant TTC', ttc, 'EUR', { principal: e.depuis === 'HT' });
    c.res('coefficient', 'Coefficient TTC/HT', UN.plus(t), 'nombre', { decimales: 4 });
    const recalc = euros(ht.times(t));
    c.verifier(
      recalc.minus(tva).abs().lessThanOrEqualTo('0.01'),
      'COHERENCE_TVA',
      'Cohérence vérifiée : TVA = HT × taux à 0,01 € près et TTC = HT + TVA.',
      `Écart entre la TVA (${fe(tva)}) et HT × taux (${fe(recalc)}).`,
      'avertissement',
    );
  },
});

export const factureMultiTaux = formule({
  id: 'facture-multi-taux',
  moteur: M,
  nom: 'Facture multi-taux',
  categorie: 'TVA France',
  description: 'Calcule chaque ligne (quantité × PU × remise), ventile les bases par taux, calcule la TVA par taux (arrondie une fois par taux) et les totaux de la facture.',
  expression: 'Ligne HT = Q × PU × (1 − remise) ; TVA(t) = arrondi(Σ bases(t) × t) ; TTC = Σ HT + Σ TVA',
  references: [
    REF_TAUX,
    { texte: 'CGI ann. II art. 242 nonies A — mentions obligatoires, TVA par taux' },
    { texte: 'CGI art. 289 — obligation de facturation' },
  ],
  champs: [
    table(
      'lignes',
      'Lignes de facture',
      [
        texte('designation', 'Désignation'),
        { nom: 'quantite', libelle: 'Quantité', type: 'nombre' },
        montant('prixUnitaire', 'PU HT'),
        taux('remise', 'Remise', { defaut: '0', min: '0', max: '100' }),
        taux('tva', 'TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
      ],
      {
        min: '1',
        defaut: [
          { designation: 'Prestation de conseil', quantite: '3', prixUnitaire: '650', remise: '0', tva: '20' },
          { designation: 'Ouvrage technique', quantite: '2', prixUnitaire: '42.65', remise: '0', tva: '5.5' },
          { designation: 'Repas séminaire', quantite: '12', prixUnitaire: '24.90', remise: '10', tva: '10' },
        ],
      },
    ),
    taux('remiseGlobale', 'Remise globale', { defaut: '0', min: '0', max: '100' }),
  ],
  exemples: [{ titre: 'Facture trois taux', entrees: {}, attendu: { totalHT: '2304.22', totalTVA: '421.58', totalTTC: '2725.80' } }],
  calculer(e, c) {
    type L = { designation: string; quantite: Decimal; prixUnitaire: Decimal; remise: Decimal; tva: Decimal };
    const lignes = e.lignes as L[];
    const rg: Decimal = e.remiseGlobale;
    const bases = new Map<string, Decimal>();
    const det: Record<string, string>[] = [];
    for (const l of lignes) {
      const brut = l.quantite.times(l.prixUnitaire);
      const ht = euros(brut.times(UN.minus(l.remise)));
      det.push({ designation: l.designation, quantite: l.quantite.toFixed(), pu: l.prixUnitaire.toFixed(2), remise: l.remise.times(100).toFixed(2), ht: ht.toFixed(2), taux: l.tva.times(100).toFixed(2) });
      const k = l.tva.toFixed();
      bases.set(k, (bases.get(k) ?? ZERO).plus(ht));
    }
    const ventilation: Record<string, string>[] = [];
    let totalHT = ZERO;
    let totalTVA = ZERO;
    for (const [k, b] of [...bases.entries()].sort((a, b) => d(b[0]).comparedTo(d(a[0])))) {
      const t = d(k);
      const base = euros(b.times(UN.minus(rg)));
      const tva = euros(base.times(t));
      c.etape(`TVA à ${fp(t)}`, `${fr(base)} × ${fp(t)}`, tva, 'EUR');
      ventilation.push({ taux: t.times(100).toFixed(2), base: base.toFixed(2), tva: tva.toFixed(2), ttc: base.plus(tva).toFixed(2) });
      totalHT = totalHT.plus(base);
      totalTVA = totalTVA.plus(tva);
    }
    c.calc('totalHT', 'Total HT', 'Σ bases HT après remise', totalHT);
    c.calc('totalTVA', 'Total TVA', 'Σ TVA par taux', totalTVA);
    c.calc('totalTTC', 'Net à payer TTC', 'Total HT + Total TVA', totalHT.plus(totalTVA), 'EUR', { principal: true });
    c.tableau({
      titre: 'Lignes',
      colonnes: [
        { cle: 'designation', libelle: 'Désignation', unite: 'texte' },
        { cle: 'quantite', libelle: 'Qté', unite: 'nombre' },
        { cle: 'pu', libelle: 'PU HT', unite: 'EUR' },
        { cle: 'remise', libelle: 'Remise', unite: '%' },
        { cle: 'ht', libelle: 'Total HT', unite: 'EUR' },
        { cle: 'taux', libelle: 'TVA', unite: '%' },
      ],
      lignes: det,
    });
    c.tableau({
      titre: 'Ventilation de la TVA par taux',
      colonnes: [
        { cle: 'taux', libelle: 'Taux', unite: '%' },
        { cle: 'base', libelle: 'Base HT', unite: 'EUR' },
        { cle: 'tva', libelle: 'TVA', unite: 'EUR' },
        { cle: 'ttc', libelle: 'TTC', unite: 'EUR' },
      ],
      lignes: ventilation,
      totaux: { taux: 'Total', base: totalHT.toFixed(2), tva: totalTVA.toFixed(2), ttc: totalHT.plus(totalTVA).toFixed(2) },
    });
    const lignesEcr: { compte: string; intitule: string; debit?: Decimal; credit?: Decimal }[] = [
      { compte: '411', intitule: 'Clients', debit: totalHT.plus(totalTVA) },
      { compte: '706', intitule: 'Prestations / ventes', credit: totalHT },
    ];
    for (const v of ventilation) lignesEcr.push({ compte: '44571', intitule: `TVA collectée ${v.taux} %`, credit: d(v.tva) });
    c.ecriture('Facture de vente', lignesEcr, 'VE');
  },
});

export const tvaAPayer = formule({
  id: 'tva-a-payer',
  moteur: M,
  nom: 'TVA à payer ou crédit de TVA',
  categorie: 'Déclarations',
  description: 'Détermine la TVA nette due ou le crédit de TVA, et l’éligibilité au remboursement du crédit selon le régime.',
  expression: 'TVA due = collectée − déductible (ABS + immobilisations) − crédit antérieur ; crédit si < 0',
  references: [
    { texte: 'CGI art. 271 — droit à déduction' },
    { texte: 'CGI ann. II art. 242-0 A à 242-0 C — remboursement des crédits de TVA' },
  ],
  baremes: ['tva.seuils'],
  champs: [
    montant('collectee', 'TVA collectée', { defaut: '18450' }),
    montant('deductibleAbs', 'TVA déductible sur ABS', { defaut: '9320' }),
    montant('deductibleImmo', 'TVA déductible sur immobilisations', { defaut: '4800' }),
    montant('creditAnterieur', 'Crédit de TVA antérieur reporté', { defaut: '0' }),
    montant('regularisations', 'TVA à reverser / régularisations (+)', { defaut: '0' }),
    choix('regime', 'Régime', [
      ['mensuel', 'Réel normal mensuel (CA3)'],
      ['trimestriel', 'Réel normal trimestriel (CA3)'],
      ['annuel', 'Réel simplifié (CA12)'],
    ]),
    { nom: 'dateOperation', libelle: 'Date de la déclaration', type: 'date', defaut: '2025-01-31' },
  ],
  exemples: [
    { titre: 'TVA due', entrees: {}, attendu: { tvaNette: '4330.00', credit: '0.00' } },
    { titre: 'Crédit remboursable', entrees: { collectee: '5000', deductibleImmo: '12000', deductibleAbs: '1000' }, attendu: { tvaNette: '0.00', credit: '8000.00', remboursable: 'oui' } },
  ],
  calculer(e, c) {
    const s = c.bareme<SeuilsTva>('tva.seuils', e.dateOperation);
    const brute = c.calc('tvaBrute', 'TVA brute due', 'collectée + régularisations', d(e.collectee).plus(e.regularisations));
    const ded = c.calc('totalDeductible', 'Total TVA déductible', 'ABS + immobilisations + crédit antérieur', somme([e.deductibleAbs, e.deductibleImmo, e.creditAnterieur]));
    const solde = brute.minus(ded);
    c.calc('tvaNette', 'TVA nette à payer', `max(0 ; ${fr(brute)} − ${fr(ded)})`, positif(solde), 'EUR', { principal: true });
    const credit = c.calc('credit', 'Crédit de TVA', `max(0 ; ${fr(ded)} − ${fr(brute)})`, positif(solde.neg()));
    if (credit.greaterThan(0)) {
      const seuil = d(e.regime === 'annuel' ? s.remboursementAnnuel : s.remboursementInfraAnnuel);
      const ok = credit.greaterThanOrEqualTo(seuil);
      c.res('remboursable', 'Remboursement possible', ok, 'booleen');
      c.ctrl(
        'info',
        'REMBOURSEMENT',
        ok
          ? `Crédit ≥ ${fe(seuil)} : remboursement demandable (formulaire 3519${e.regime === 'annuel' ? ', annuel' : ''}).`
          : `Crédit inférieur à ${fe(seuil)} : à reporter sur la déclaration suivante (ligne 22).`,
      );
      if (e.regime === 'trimestriel' || e.regime === 'mensuel')
        c.ctrl('info', 'REMBOURSEMENT_IMMO', 'En mensuel/trimestriel, le remboursement infra-annuel suppose un crédit ≥ 760 € (CGI ann. II art. 242-0 C).');
    }
    c.ecriture('Liquidation de la TVA', [
      { compte: '44571', intitule: 'TVA collectée', debit: e.collectee },
      { compte: '4458', intitule: 'TVA à régulariser', debit: d(e.regularisations) },
      { compte: '44566', intitule: 'TVA déductible sur ABS', credit: e.deductibleAbs },
      { compte: '44562', intitule: 'TVA déductible sur immobilisations', credit: e.deductibleImmo },
      { compte: '44567', intitule: 'Crédit de TVA à reporter', credit: d(e.creditAnterieur).minus(credit) },
      { compte: '44551', intitule: 'TVA à décaisser', credit: positif(solde) },
    ]);
  },
});

export const ca3 = formule({
  id: 'ca3',
  moteur: M,
  nom: 'Déclaration CA3 (3310-CA3)',
  categorie: 'Déclarations',
  description:
    'Remplit automatiquement les lignes du cadre B de la déclaration CA3 (taxation par taux, TVA brute, déductions, crédit ou TVA nette due) à partir des bases et de la TVA déductible, avec arrondi fiscal à l’euro par ligne.',
  expression: 'L16 = Σ TVA(08…11) + L15 + L5B ; L23 = L19 + L20 + L21 + L22 + L2C ; L28 = max(0, L16 − L23) ; L25 = max(0, L23 − L16)',
  references: [
    { texte: 'Formulaire 3310-CA3-SD (cerfa n° 10963) et notice' },
    { texte: 'CGI art. 287 — obligations déclaratives' },
    { texte: 'CGI art. 1657 — arrondi à l’euro' },
  ],
  champs: [
    montant('base20', 'Ventes et prestations à 20 % (base HT)', { defaut: '84250', groupe: 'Opérations imposables' }),
    montant('base10', 'à 10 % (base HT)', { defaut: '12400', groupe: 'Opérations imposables' }),
    montant('base55', 'à 5,5 % (base HT)', { defaut: '3150', groupe: 'Opérations imposables' }),
    montant('base21', 'à 2,1 % (base HT)', { defaut: '0', groupe: 'Opérations imposables' }),
    montant('base85', 'DOM à 8,5 % (base HT)', { defaut: '0', groupe: 'Opérations imposables' }),
    montant('acquisitionsIntra', 'Acquisitions intracommunautaires à 20 % (ligne 03)', { defaut: '6000', groupe: 'Autoliquidation' }),
    montant('prestationsUe', 'Achats de prestations UE à 20 % (ligne 2A)', { defaut: '1500', groupe: 'Autoliquidation' }),
    montant('importations', 'Importations autoliquidées à 20 % (ligne 2B)', { defaut: '0', groupe: 'Autoliquidation' }),
    montant('autresAutoliquidations', 'Autres autoliquidations à 20 % — BTP, déchets (ligne 3B/3C)', { defaut: '0', groupe: 'Autoliquidation' }),
    taux('coefficientAutoliquidation', 'Coefficient de déduction de la TVA autoliquidée', { defaut: '100', min: '0', max: '100', groupe: 'Autoliquidation' }),
    montant('ligne15', 'TVA antérieurement déduite à reverser (15)', { defaut: '0', groupe: 'Déductions' }),
    montant('ligne5B', 'Sommes à ajouter, y c. acompte congés (5B)', { defaut: '0', groupe: 'Déductions' }),
    montant('ligne19', 'TVA déductible sur immobilisations (19)', { defaut: '2400', groupe: 'Déductions' }),
    montant('deductibleAbs', 'TVA déductible sur autres biens et services, hors autoliquidation (20)', { defaut: '8640', groupe: 'Déductions' }),
    montant('ligne21', 'Autre TVA à déduire (21)', { defaut: '0', groupe: 'Déductions' }),
    montant('ligne22', 'Report du crédit de la déclaration précédente (22)', { defaut: '0', groupe: 'Déductions' }),
    montant('ligne2C', 'Sommes à imputer, y c. acompte congés (2C)', { defaut: '0', groupe: 'Déductions' }),
    montant('remboursementDemande', 'Remboursement de crédit demandé (26)', { defaut: '0', groupe: 'Crédit' }),
    montant('taxesAssimilees', 'Taxes assimilées (29)', { defaut: '0', groupe: 'Crédit' }),
  ],
  exemples: [{ titre: 'Mois type', entrees: {}, attendu: { l16: '19763', l23: '12540', l28: '7223', l25: '0', l32: '7223' } }],
  calculer(e, c) {
    const f = arrondiFiscal;
    const auto = somme([e.acquisitionsIntra, e.prestationsUe, e.importations, e.autresAutoliquidations]);
    const lignes: { ligne: string; libelle: string; base?: Decimal; taxe?: Decimal }[] = [];
    const taxer = (code: string, libelle: string, base: Decimal, t: string) => {
      const b = f(base);
      const tx = f(base.times(d(t).div(100)));
      lignes.push({ ligne: code, libelle, base: b, taxe: tx });
      c.etape(`Ligne ${code}`, `${fr(b, 0)} × ${t.replace('.', ',')} %`, tx, 'EUR');
      return tx;
    };
    const t08 = taxer('08', 'Taux normal 20 %', d(e.base20).plus(auto), '20');
    const t9B = taxer('9B', 'Taux 10 %', e.base10, '10');
    const t09 = taxer('09', 'Taux réduit 5,5 %', e.base55, '5.5');
    const t11 = taxer('11', 'Taux 2,1 %', e.base21, '2.1');
    const t10 = taxer('10', 'Taux DOM 8,5 %', e.base85, '8.5');
    const l15 = f(e.ligne15);
    const l5B = f(e.ligne5B);
    const l16 = c.calc('l16', 'Ligne 16 — Total TVA brute due', '08 + 9B + 09 + 11 + 10 + 15 + 5B', somme([t08, t9B, t09, t11, t10, l15, l5B]), 'EUR', { decimales: 0 });
    const l17 = c.calc('l17', 'Ligne 17 — dont TVA sur acquisitions intracommunautaires', `${fr(f(e.acquisitionsIntra), 0)} × 20 %`, f(d(e.acquisitionsIntra).times('0.2')), 'EUR', { decimales: 0 });
    const tvaAutoDed = f(auto.times('0.2').times(e.coefficientAutoliquidation));
    c.etape('TVA autoliquidée déductible', `${fr(auto)} × 20 % × ${fp(e.coefficientAutoliquidation)}`, tvaAutoDed, 'EUR');
    const l19 = f(e.ligne19);
    const l20 = c.calc('l20', 'Ligne 20 — Autres biens et services', 'ABS + TVA autoliquidée déductible', f(e.deductibleAbs).plus(tvaAutoDed), 'EUR', { decimales: 0 });
    const l21 = f(e.ligne21);
    const l22 = f(e.ligne22);
    const l2C = f(e.ligne2C);
    const l23 = c.calc('l23', 'Ligne 23 — Total TVA déductible', '19 + 20 + 21 + 22 + 2C', somme([l19, l20, l21, l22, l2C]), 'EUR', { decimales: 0 });
    const l25 = c.calc('l25', 'Ligne 25 — Crédit de TVA', 'max(0 ; 23 − 16)', positif(l23.minus(l16)), 'EUR', { decimales: 0 });
    const l26 = f(e.remboursementDemande);
    if (l26.greaterThan(l25)) c.ctrl('erreur', 'REMBOURSEMENT_EXCESSIF', 'Le remboursement demandé (26) excède le crédit (25).');
    const l27 = c.calc('l27', 'Ligne 27 — Crédit à reporter', '25 − 26', positif(l25.minus(l26)), 'EUR', { decimales: 0 });
    const l28 = c.calc('l28', 'Ligne 28 — TVA nette due', 'max(0 ; 16 − 23)', positif(l16.minus(l23)), 'EUR', { decimales: 0, principal: true });
    const l29 = f(e.taxesAssimilees);
    c.calc('l32', 'Ligne 32 — Total à payer', '28 + 29', l28.plus(l29), 'EUR', { decimales: 0, principal: true });
    const tab = [
      ...lignes.map((l) => ({ ligne: l.ligne, libelle: l.libelle, base: l.base!.toFixed(0), taxe: l.taxe!.toFixed(0) })),
      { ligne: '15', libelle: 'TVA antérieurement déduite à reverser', base: '', taxe: l15.toFixed(0) },
      { ligne: '5B', libelle: 'Sommes à ajouter', base: '', taxe: l5B.toFixed(0) },
      { ligne: '16', libelle: 'Total TVA brute due', base: '', taxe: l16.toFixed(0) },
      { ligne: '17', libelle: 'dont TVA sur acquisitions intracom.', base: '', taxe: l17.toFixed(0) },
      { ligne: '19', libelle: 'Biens constituant des immobilisations', base: '', taxe: l19.toFixed(0) },
      { ligne: '20', libelle: 'Autres biens et services', base: '', taxe: l20.toFixed(0) },
      { ligne: '21', libelle: 'Autre TVA à déduire', base: '', taxe: l21.toFixed(0) },
      { ligne: '22', libelle: 'Report du crédit antérieur', base: '', taxe: l22.toFixed(0) },
      { ligne: '2C', libelle: 'Sommes à imputer', base: '', taxe: l2C.toFixed(0) },
      { ligne: '23', libelle: 'Total TVA déductible', base: '', taxe: l23.toFixed(0) },
      { ligne: '25', libelle: 'Crédit de TVA', base: '', taxe: l25.toFixed(0) },
      { ligne: '26', libelle: 'Remboursement demandé', base: '', taxe: l26.toFixed(0) },
      { ligne: '27', libelle: 'Crédit à reporter', base: '', taxe: l27.toFixed(0) },
      { ligne: '28', libelle: 'TVA nette due', base: '', taxe: l28.toFixed(0) },
      { ligne: '29', libelle: 'Taxes assimilées', base: '', taxe: l29.toFixed(0) },
      { ligne: '32', libelle: 'Total à payer', base: '', taxe: l28.plus(l29).toFixed(0) },
    ];
    c.tableau({
      titre: 'Cadre B — Décompte de la TVA à payer',
      colonnes: [
        { cle: 'ligne', libelle: 'Ligne', unite: 'texte' },
        { cle: 'libelle', libelle: 'Libellé', unite: 'texte' },
        { cle: 'base', libelle: 'Base HT', unite: 'EUR' },
        { cle: 'taxe', libelle: 'Taxe due / déductible', unite: 'EUR' },
      ],
      lignes: tab,
    });
    if (auto.greaterThan(0)) c.ctrl('info', 'AUTOLIQUIDATION', 'Opérations autoliquidées valorisées au taux normal de 20 % ; ajuster si un autre taux s’applique.');
    c.verifier(l16.minus(l23).equals(l28.minus(l25)), 'COHERENCE_CA3', 'Cohérence CA3 : 16 − 23 = 28 − 25.', 'Incohérence entre lignes 16, 23, 25 et 28.');
  },
});

export const ca12 = formule({
  id: 'ca12',
  moteur: M,
  nom: 'Déclaration annuelle CA12 et acomptes',
  categorie: 'Déclarations',
  description:
    "Régime simplifié : TVA due de l'exercice, imputation des acomptes semestriels versés, solde à payer ou crédit, et calcul des acomptes de l'année suivante (55 % en juillet, 40 % en décembre).",
  expression: 'Solde = TVA brute − déductible − crédit antérieur − acomptes ; acomptes N+1 = 55 % / 40 % × (TVA due N avant déduction immobilisations)',
  references: [
    { texte: 'CGI art. 287-3 — régime simplifié, acomptes semestriels' },
    { texte: 'Formulaire 3517-S-SD (CA12)' },
  ],
  baremes: ['tva.seuils'],
  champs: [
    montant('tvaCollectee', 'TVA collectée de l’exercice', { defaut: '24600' }),
    montant('deductibleAbs', 'TVA déductible ABS', { defaut: '11300' }),
    montant('deductibleImmo', 'TVA déductible sur immobilisations', { defaut: '2500' }),
    montant('creditAnterieur', 'Crédit antérieur', { defaut: '0' }),
    montant('acompteJuillet', 'Acompte versé en juillet', { defaut: '5500' }),
    montant('acompteDecembre', 'Acompte versé en décembre', { defaut: '4000' }),
    { nom: 'dateOperation', libelle: 'Date de clôture', type: 'date', defaut: '2024-12-31' },
  ],
  exemples: [{ titre: 'Exercice 2024', entrees: {}, attendu: { tvaDue: '10800.00', solde: '1300.00', acompteJuilletN1: '7315.00', acompteDecembreN1: '5320.00' } }],
  calculer(e, c) {
    const s = c.bareme<SeuilsTva>('tva.seuils', e.dateOperation);
    const due = c.calc('tvaDue', 'TVA due de l’exercice', 'collectée − ABS − immobilisations − crédit antérieur', d(e.tvaCollectee).minus(e.deductibleAbs).minus(e.deductibleImmo).minus(e.creditAnterieur));
    const acomptes = d(e.acompteJuillet).plus(e.acompteDecembre);
    const solde = due.minus(acomptes);
    c.calc('solde', solde.isNegative() ? 'Excédent à imputer / rembourser' : 'Solde à payer', `${fr(due)} − ${fr(acomptes)}`, solde.abs(), 'EUR', { principal: true });
    const baseAcomptes = c.calc('baseAcomptes', 'Base des acomptes N+1', 'TVA due avant déduction des immobilisations', positif(due.plus(e.deductibleImmo)));
    if (baseAcomptes.lessThan(s.dispenseAcomptes)) {
      c.ctrl('info', 'DISPENSE_ACOMPTES', `Base < ${fe(s.dispenseAcomptes)} : dispense d’acomptes l’année suivante.`);
      c.res('acompteJuilletN1', 'Acompte de juillet N+1', 0);
      c.res('acompteDecembreN1', 'Acompte de décembre N+1', 0);
    } else {
      c.calc('acompteJuilletN1', 'Acompte de juillet N+1', `${fr(baseAcomptes)} × ${s.acompteJuillet} %`, arrondiFiscal(baseAcomptes.times(s.acompteJuillet).div(100)), 'EUR', { decimales: 2 });
      c.calc('acompteDecembreN1', 'Acompte de décembre N+1', `${fr(baseAcomptes)} × ${s.acompteDecembre} %`, arrondiFiscal(baseAcomptes.times(s.acompteDecembre).div(100)), 'EUR', { decimales: 2 });
    }
    c.ctrl('info', 'ECHEANCE_CA12', 'Dépôt de la CA12 au plus tard le 2e jour ouvré suivant le 1er mai (exercice civil) ou dans les 3 mois de la clôture.');
  },
});

export const exigibilite = formule({
  id: 'exigibilite',
  moteur: M,
  nom: 'Exigibilité : TVA sur les débits / sur les encaissements',
  categorie: 'TVA France',
  description:
    "Détermine pour chaque opération la date d'exigibilité (livraison pour les biens, encaissement pour les services sauf option pour les débits) et totalise la TVA exigible sur la période et la TVA en attente.",
  expression: 'Biens : exigible à la livraison ; services : à l’encaissement (ou à la facturation si option débits) ; TVA = TTC × t / (1 + t)',
  references: [
    { texte: 'CGI art. 269-2 a et c — fait générateur et exigibilité' },
    { texte: 'BOI-TVA-BASE-20-10' },
  ],
  champs: [
    date('debut', 'Début de période', { defaut: '2025-03-01' }),
    date('fin', 'Fin de période', { defaut: '2025-03-31' }),
    booleen('optionDebits', 'Option pour le paiement de la TVA d’après les débits'),
    table(
      'operations',
      'Opérations',
      [
        texte('libelle', 'Libellé'),
        choix('nature', 'Nature', [
          ['services', 'Prestation de services'],
          ['biens', 'Livraison de biens'],
        ]),
        date('dateFacture', 'Date facture / livraison'),
        date('dateEncaissement', 'Date encaissement', { optionnel: true }),
        montant('ttc', 'Montant TTC'),
        taux('taux', 'TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
      ],
      {
        min: '1',
        defaut: [
          { libelle: 'Mission audit', nature: 'services', dateFacture: '2025-02-20', dateEncaissement: '2025-03-10', ttc: '6000', taux: '20' },
          { libelle: 'Formation', nature: 'services', dateFacture: '2025-03-15', dateEncaissement: '', ttc: '2400', taux: '20' },
          { libelle: 'Vente matériel', nature: 'biens', dateFacture: '2025-03-22', dateEncaissement: '', ttc: '3600', taux: '20' },
        ],
      },
    ),
  ],
  exemples: [
    { titre: 'Encaissements', entrees: {}, attendu: { tvaExigible: '1600.00', tvaEnAttente: '400.00' } },
    { titre: 'Option débits', entrees: { optionDebits: true }, attendu: { tvaExigible: '1000.00', tvaEnAttente: '0.00' } },
  ],
  calculer(e, c) {
    type Op = { libelle: string; nature: string; dateFacture: string; dateEncaissement?: string; ttc: Decimal; taux: Decimal };
    const dans = (s?: string) => !!s && comparer(s, e.debut) >= 0 && comparer(s, e.fin) <= 0;
    let exig = ZERO;
    let attente = ZERO;
    const lignes = (e.operations as Op[]).map((o) => {
      const tva = euros(o.ttc.times(o.taux).div(UN.plus(o.taux)));
      const surDebits = o.nature === 'biens' || e.optionDebits;
      const dateExig = surDebits ? o.dateFacture : o.dateEncaissement;
      let statut: string;
      if (dans(dateExig)) {
        exig = exig.plus(tva);
        statut = 'Exigible sur la période';
      } else if (!dateExig || comparer(dateExig, e.fin) > 0) {
        if (comparer(o.dateFacture, e.fin) <= 0) attente = attente.plus(tva);
        statut = 'En attente d’encaissement';
      } else statut = 'Exigible sur une période antérieure';
      return { libelle: o.libelle, regle: surDebits ? 'Débits' : 'Encaissements', dateExigibilite: dateExig ?? '', tva: tva.toFixed(2), statut };
    });
    c.calc('tvaExigible', 'TVA exigible sur la période', 'Σ TVA des opérations exigibles', exig, 'EUR', { principal: true });
    c.calc('tvaEnAttente', 'TVA facturée en attente d’exigibilité', 'Σ TVA des services non encaissés', attente);
    c.tableau({
      titre: 'Exigibilité par opération',
      colonnes: [
        { cle: 'libelle', libelle: 'Opération', unite: 'texte' },
        { cle: 'regle', libelle: 'Règle', unite: 'texte' },
        { cle: 'dateExigibilite', libelle: 'Exigibilité', unite: 'date' },
        { cle: 'tva', libelle: 'TVA', unite: 'EUR' },
        { cle: 'statut', libelle: 'Statut', unite: 'texte' },
      ],
      lignes,
    });
    if (!e.optionDebits && attente.greaterThan(0))
      c.ctrl('info', 'TVA_ATTENTE', 'La TVA en attente est enregistrée en 44574 « TVA collectée en attente » jusqu’à l’encaissement.');
  },
});

export const intracommunautaire = formule({
  id: 'intracommunautaire',
  moteur: M,
  nom: 'TVA intracommunautaire',
  categorie: 'International',
  description: 'Traitement des acquisitions et livraisons intracommunautaires de biens et des prestations de services B2B : TVA autoliquidée, exonération, lignes CA3, mentions et obligations déclaratives.',
  expression: 'Acquisition : TVA due = HT × t, déductible = TVA × coefficient ; livraison : exonérée',
  references: [
    { texte: 'CGI art. 256 bis et 262 ter I — acquisitions et livraisons intracommunautaires' },
    { texte: 'CGI art. 259 et 283-2 — prestations B2B, autoliquidation' },
    { texte: 'CGI art. 289 B — déclaration européenne de services (DES)' },
  ],
  champs: [
    choix('operation', 'Opération', [
      ['acquisition', 'Acquisition intracommunautaire de biens'],
      ['livraison', 'Livraison intracommunautaire de biens'],
      ['prestation-recue', 'Prestation reçue d’un prestataire UE'],
      ['prestation-rendue', 'Prestation rendue à un client UE assujetti'],
    ]),
    montant('ht', 'Montant HT', { defaut: '12000' }),
    taux('taux', 'Taux de TVA français applicable', { defaut: '20', suggestions: TAUX_TVA_FR }),
    taux('coefficient', 'Coefficient de déduction', { defaut: '100', min: '0', max: '100' }),
    booleen('numeroValide', 'N° de TVA intracommunautaire du partenaire vérifié (VIES)', { defaut: true }),
  ],
  exemples: [
    { titre: 'Acquisition 12 000 € HT', entrees: {}, attendu: { tvaDue: '2400.00', tvaDeductible: '2400.00', coutNet: '0.00' } },
    { titre: 'Livraison', entrees: { operation: 'livraison' }, attendu: { tvaDue: '0.00' } },
    { titre: 'Acquisition, coefficient 80 %', entrees: { coefficient: '80' }, attendu: { tvaDeductible: '1920.00', coutNet: '480.00' } },
  ],
  calculer(e, c) {
    const ht: Decimal = e.ht;
    const recue = e.operation === 'acquisition' || e.operation === 'prestation-recue';
    if (!e.numeroValide)
      c.ctrl(
        e.operation === 'livraison' ? 'erreur' : 'avertissement',
        'VIES',
        e.operation === 'livraison' ? 'Sans numéro de TVA valide du client, l’exonération de la livraison intracommunautaire est refusée (art. 262 ter I).' : 'Numéro de TVA du partenaire à vérifier sur VIES.',
      );
    if (recue) {
      const due = c.calc('tvaDue', 'TVA autoliquidée due', `${fr(ht)} × ${fp(e.taux)}`, euros(ht.times(e.taux)), 'EUR', { principal: true });
      const ded = c.calc('tvaDeductible', 'TVA déductible', `${fr(due)} × ${fp(e.coefficient)}`, euros(due.times(e.coefficient)));
      c.calc('coutNet', 'Coût net de TVA', 'TVA due − TVA déductible', due.minus(ded));
      const acq = e.operation === 'acquisition';
      c.res('lignesCa3', 'Lignes CA3', acq ? 'Base ligne 03, taxe ligne 08 (dont 17), déduction ligne 20' : 'Base ligne 2A, taxe ligne 08, déduction ligne 20', 'texte');
      c.ecriture(acq ? 'Acquisition intracommunautaire' : 'Prestation intracommunautaire reçue', [
        { compte: acq ? '607' : '604', intitule: acq ? 'Achats de marchandises' : 'Achats de prestations', debit: ht.plus(due.minus(ded)) },
        { compte: '445662', intitule: 'TVA déductible intracommunautaire', debit: ded },
        { compte: '4452', intitule: 'TVA due intracommunautaire', credit: due },
        { compte: '401', intitule: 'Fournisseurs UE', credit: ht },
      ], 'HA');
      c.res('declarations', 'Obligations', acq ? 'EMEBI (DEB) si introductions > 460 000 €/an' : 'Aucune DES (incombe au prestataire)', 'texte');
    } else {
      c.res('tvaDue', 'TVA facturée', 0, 'EUR', { principal: true });
      const liv = e.operation === 'livraison';
      c.res(
        'mention',
        'Mention obligatoire',
        liv ? 'Exonération de TVA, article 262 ter I du CGI' : 'Autoliquidation — article 196 de la directive 2006/112/CE',
        'texte',
      );
      c.res('lignesCa3', 'Lignes CA3', liv ? 'Ligne 06 — livraisons intracommunautaires' : 'Ligne 05 — autres opérations non imposables', 'texte');
      c.res('declarations', 'Obligations', liv ? 'EMEBI (volet fiscal) mensuel' : 'DES mensuelle dès le premier euro', 'texte');
      c.ecriture(liv ? 'Livraison intracommunautaire' : 'Prestation intracommunautaire rendue', [
        { compte: '411', intitule: 'Clients UE', debit: ht },
        { compte: liv ? '7071' : '7061', intitule: liv ? 'Ventes intracommunautaires' : 'Prestations intracommunautaires', credit: ht },
      ], 'VE');
    }
  },
});

const CAS_AUTOLIQ: Record<string, { libelle: string; ref: string; compteDue: string }> = {
  btp: { libelle: 'Sous-traitance BTP', ref: 'CGI art. 283-2 nonies', compteDue: '445711' },
  dechets: { libelle: 'Déchets neufs d’industrie et matières de récupération', ref: 'CGI art. 283-2 sexies', compteDue: '445711' },
  etranger: { libelle: 'Prestataire non établi en France', ref: 'CGI art. 283-1 al. 2 et 283-2', compteDue: '4452' },
  importation: { libelle: 'Importation (autoliquidation obligatoire)', ref: 'CGI art. 1695 II', compteDue: '445711' },
  energie: { libelle: 'Gaz, électricité, chaleur, froid', ref: 'CGI art. 283-2 quinquies', compteDue: '445711' },
  quotas: { libelle: 'Quotas d’émission de gaz à effet de serre', ref: 'CGI art. 283-2 septies', compteDue: '445711' },
};

export const autoliquidation = formule({
  id: 'autoliquidation',
  moteur: M,
  nom: 'Autoliquidation de la TVA',
  categorie: 'TVA France',
  description: 'Le preneur assujetti déclare la TVA due et la déduit simultanément. Calcule la TVA due, la TVA déductible, le coût net et les écritures selon le cas d’autoliquidation.',
  expression: 'TVA due = HT × t ; TVA déductible = TVA due × coefficient de déduction',
  references: Object.values(CAS_AUTOLIQ).map((x) => ({ texte: `${x.ref} — ${x.libelle}` })),
  champs: [
    choix('cas', 'Cas d’autoliquidation', Object.entries(CAS_AUTOLIQ).map(([k, v]) => [k, v.libelle] as [string, string])),
    montant('ht', 'Montant HT', { defaut: '25000' }),
    taux('taux', 'Taux de TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
    taux('coefficient', 'Coefficient de déduction', { defaut: '100', min: '0', max: '100' }),
  ],
  exemples: [
    { titre: 'Sous-traitance BTP', entrees: {}, attendu: { tvaDue: '5000.00', tvaDeductible: '5000.00', coutNet: '0.00', decaissementFournisseur: '25000.00' } },
    { titre: 'Coefficient 50 %', entrees: { coefficient: '50' }, attendu: { coutNet: '2500.00' } },
  ],
  calculer(e, c) {
    const cas = CAS_AUTOLIQ[e.cas as string];
    const ht: Decimal = e.ht;
    const due = c.calc('tvaDue', 'TVA autoliquidée due', `${fr(ht)} × ${fp(e.taux)}`, euros(ht.times(e.taux)), 'EUR', { principal: true });
    const ded = c.calc('tvaDeductible', 'TVA déductible', `${fr(due)} × ${fp(e.coefficient)}`, euros(due.times(e.coefficient)));
    c.calc('coutNet', 'Coût net de TVA', 'TVA due − TVA déductible', due.minus(ded));
    c.calc('decaissementFournisseur', 'Montant payé au fournisseur', 'facture HT, sans TVA', ht);
    c.res('mention', 'Mention sur la facture du fournisseur', 'Autoliquidation', 'texte');
    c.ecriture(`Autoliquidation — ${cas.libelle}`, [
      { compte: e.cas === 'btp' ? '604' : '607', intitule: 'Charge HT (+ TVA non déductible)', debit: ht.plus(due.minus(ded)) },
      { compte: '445662', intitule: 'TVA déductible autoliquidée', debit: ded },
      { compte: cas.compteDue, intitule: 'TVA due autoliquidée', credit: due },
      { compte: '401', intitule: 'Fournisseurs', credit: ht },
    ], 'HA');
  },
});

export const tvaSurMarge = formule({
  id: 'tva-sur-marge',
  moteur: M,
  nom: 'TVA sur la marge',
  categorie: 'Régimes particuliers',
  description: 'Biens d’occasion, œuvres d’art, agences de voyages et opérations immobilières : la TVA est calculée « en dedans » sur la marge TTC.',
  expression: 'Marge TTC = prix de vente − prix d’achat ; TVA = Marge TTC × t / (1 + t) ; marge HT = marge TTC − TVA',
  references: [
    { texte: 'CGI art. 297 A — biens d’occasion, œuvres d’art, objets de collection' },
    { texte: 'CGI art. 266-1-e et 268 bis — agences de voyages' },
    { texte: 'CGI art. 268 — immeubles et terrains à bâtir' },
  ],
  champs: [
    choix('regime', 'Régime', [
      ['occasion', 'Biens d’occasion (art. 297 A)'],
      ['voyages', 'Agence de voyages (art. 266-1-e)'],
      ['immobilier', 'Immobilier — terrain à bâtir (art. 268)'],
    ]),
    montant('prixVente', 'Prix de vente TTC', { defaut: '15800' }),
    montant('prixAchat', 'Prix d’achat (ou coût des prestations / prix du terrain)', { defaut: '12500' }),
    taux('taux', 'Taux de TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
  ],
  exemples: [
    { titre: 'Véhicule d’occasion', entrees: {}, attendu: { margeTTC: '3300.00', tva: '550.00', margeHT: '2750.00', prixVenteHT: '15250.00' } },
    { titre: 'Marge négative', entrees: { prixVente: '10000' }, attendu: { tva: '0.00' } },
  ],
  calculer(e, c) {
    const t: Decimal = e.taux;
    const marge = c.calc('margeTTC', 'Marge TTC', `${fr(e.prixVente)} − ${fr(e.prixAchat)}`, d(e.prixVente).minus(e.prixAchat));
    if (!marge.greaterThan(0) || marge.isZero()) {
      c.res('tva', 'TVA sur marge', 0, 'EUR', { principal: true });
      c.res('margeHT', 'Marge HT', marge);
      c.ctrl(
        'info',
        'MARGE_NEGATIVE',
        e.regime === 'occasion'
          ? 'Marge nulle ou négative : aucune TVA due ; la perte n’est pas imputable sur une autre opération (sauf méthode de la globalisation).'
          : 'Marge nulle ou négative : aucune TVA due.',
      );
      return;
    }
    const tva = c.calc('tva', 'TVA sur marge', `${fr(marge)} × ${fp(t)} / (1 + ${fp(t)})`, euros(marge.times(t).div(UN.plus(t))), 'EUR', { principal: true });
    c.calc('margeHT', 'Marge HT', `${fr(marge)} − ${fr(tva)}`, marge.minus(tva));
    c.calc('prixVenteHT', 'Prix de vente hors TVA', `${fr(e.prixVente)} − ${fr(tva)}`, d(e.prixVente).minus(tva));
    c.calc('tauxMarge', 'Taux de marge HT / prix d’achat', 'marge HT / prix d’achat', d(marge.minus(tva)).div(e.prixAchat), '%');
    c.res('mention', 'Mention obligatoire', e.regime === 'occasion' ? 'Régime particulier — Biens d’occasion' : e.regime === 'voyages' ? 'Régime particulier — Agences de voyages' : 'TVA sur la marge — art. 268 du CGI', 'texte');
  },
});

export const coefficientDeduction = formule({
  id: 'coefficient-deduction',
  moteur: M,
  nom: 'Coefficient de déduction (assujettis partiels)',
  categorie: 'Déductions',
  description:
    'Calcule le coefficient de déduction = assujettissement × taxation × admission, le coefficient de taxation pouvant être déterminé à partir du chiffre d’affaires, puis la TVA déductible et la TVA non récupérable.',
  expression: 'Coef = C_assujettissement × C_taxation × C_admission ; C_taxation = CA ouvrant droit / CA total (arrondi à l’unité supérieure en %)',
  references: [
    { texte: 'CGI ann. II art. 205 à 207 — coefficient de déduction' },
    { texte: 'CGI ann. II art. 212 — arrondi du rapport à l’unité supérieure' },
    { texte: 'BOI-TVA-DED-20-10' },
  ],
  champs: [
    montant('tva', 'TVA d’amont', { defaut: '10000' }),
    taux('assujettissement', 'Coefficient d’assujettissement', { defaut: '100', min: '0', max: '100' }),
    choix('modeTaxation', 'Coefficient de taxation', [
      ['ca', 'Calculé à partir du chiffre d’affaires'],
      ['saisi', 'Saisi'],
    ]),
    montant('caDroitDeduction', 'CA ouvrant droit à déduction', { defaut: '730000', visibleSi: { champ: 'modeTaxation', valeurs: ['ca'] } }),
    montant('caTotal', 'CA total (y c. exonéré)', { defaut: '960000', visibleSi: { champ: 'modeTaxation', valeurs: ['ca'] } }),
    taux('taxation', 'Coefficient de taxation', { defaut: '100', min: '0', max: '100', visibleSi: { champ: 'modeTaxation', valeurs: ['saisi'] } }),
    taux('admission', 'Coefficient d’admission', { defaut: '100', min: '0', max: '100', aide: '0 % pour les exclusions (véhicules de tourisme, logement des dirigeants…), 80 % pour le gazole/essence des VP.' }),
  ],
  exemples: [{ titre: 'Banque-assurance partielle', entrees: {}, attendu: { taxation: '77.00', coefficient: '77.00', deductible: '7700.00', nonDeductible: '2300.00' } }],
  calculer(e, c) {
    let tx: Decimal;
    if (e.modeTaxation === 'ca') {
      if (d(e.caTotal).isZero()) {
        c.ctrl('erreur', 'CA_NUL', 'CA total nul.');
        return;
      }
      const brut = d(e.caDroitDeduction).div(e.caTotal);
      tx = c.etape('Coefficient de taxation', `${fr(e.caDroitDeduction)} / ${fr(e.caTotal)} = ${fp(brut)} → arrondi à l’unité supérieure`, arrondi(brut.times(100), 0, 'plafond').div(100), '%');
    } else tx = e.taxation;
    c.res('taxation', 'Coefficient de taxation', tx, '%');
    const coef = c.calc('coefficient', 'Coefficient de déduction', `${fp(e.assujettissement)} × ${fp(tx)} × ${fp(e.admission)}`, d(e.assujettissement).times(tx).times(e.admission), '%', { principal: true });
    const ded = c.calc('deductible', 'TVA déductible', `${fr(e.tva)} × ${fp(coef)}`, euros(d(e.tva).times(coef)));
    c.calc('nonDeductible', 'TVA non récupérable (charge)', `${fr(e.tva)} − ${fr(ded)}`, d(e.tva).minus(ded));
    if (coef.lessThan('0.1') && !coef.isZero()) c.ctrl('info', 'COEF_FAIBLE', 'Coefficient inférieur à 10 % : vérifier les règles de déduction et l’assujettissement à la taxe sur les salaires.');
  },
});

export const regularisationImmobilisation = formule({
  id: 'regularisation-immobilisation',
  moteur: M,
  nom: 'Régularisation de la TVA sur immobilisations',
  categorie: 'Déductions',
  description:
    'Régularisation annuelle lorsque le coefficient de déduction varie de plus de 10 points, ou régularisation globale en cas de cession avant la fin de la période (5 ans pour les biens meubles, 20 ans pour les immeubles).',
  expression: 'Annuelle : TVA initiale × (coef N − coef initial) / 5 (ou 20) ; cession : TVA × coef × années restantes / 5 (ou 20)',
  references: [
    { texte: 'CGI ann. II art. 207 — régularisations' },
    { texte: 'BOI-TVA-DED-60-20' },
  ],
  champs: [
    montant('tvaInitiale', 'TVA grevant le bien (totale)', { defaut: '40000' }),
    taux('coefInitial', 'Coefficient de déduction initial', { defaut: '80', min: '0', max: '100' }),
    choix('bien', 'Nature du bien', [
      ['meuble', 'Bien meuble (5 ans)'],
      ['immeuble', 'Immeuble (20 ans)'],
    ]),
    choix('evenement', 'Événement', [
      ['annuelle', 'Variation annuelle du coefficient'],
      ['cession-taxee', 'Cession taxée'],
      ['cession-exoneree', 'Cession exonérée / non taxée'],
    ]),
    taux('coefAnnee', 'Coefficient de l’année', { defaut: '55', min: '0', max: '100', visibleSi: { champ: 'evenement', valeurs: ['annuelle'] } }),
    entier('rangAnnee', 'Rang de l’année (1 = année d’acquisition)', { defaut: 2, min: '1', max: '20' }),
  ],
  exemples: [
    { titre: 'Baisse de 25 points', entrees: {}, attendu: { regularisation: '-2000.00' } },
    { titre: 'Cession exonérée année 3', entrees: { evenement: 'cession-exoneree', rangAnnee: 3 }, attendu: { regularisation: '-12800.00' } },
    { titre: 'Cession taxée année 3', entrees: { evenement: 'cession-taxee', rangAnnee: 3 }, attendu: { regularisation: '3200.00' } },
  ],
  calculer(e, c) {
    const periode = e.bien === 'meuble' ? 5 : 20;
    if (e.rangAnnee > periode) {
      c.ctrl('info', 'HORS_PERIODE', `Au-delà de la ${periode}e année : aucune régularisation.`);
      c.res('regularisation', 'Régularisation', 0, 'EUR', { principal: true });
      return;
    }
    const tvaInit: Decimal = e.tvaInitiale;
    const ci: Decimal = e.coefInitial;
    let r: Decimal;
    if (e.evenement === 'annuelle') {
      const ecart = d(e.coefAnnee).minus(ci);
      c.etape('Écart de coefficient', `${fp(e.coefAnnee)} − ${fp(ci)}`, ecart, '%');
      if (ecart.abs().lessThanOrEqualTo('0.1')) {
        c.ctrl('ok', 'SOUS_SEUIL', 'Écart ≤ 10 points : pas de régularisation.');
        r = ZERO;
      } else r = c.etape('Régularisation annuelle', `${fr(tvaInit)} × (${fp(ecart)}) / ${periode}`, euros(tvaInit.times(ecart).div(periode)), 'EUR');
    } else {
      const restantes = periode - e.rangAnnee;
      c.etape('Années restant à courir', `${periode} − ${e.rangAnnee}`, d(restantes), 'annees');
      r =
        e.evenement === 'cession-exoneree'
          ? c.etape('Reversement', `−${fr(tvaInit)} × ${fp(ci)} × ${restantes} / ${periode}`, euros(tvaInit.times(ci).times(restantes).div(periode)).neg(), 'EUR')
          : c.etape('Déduction complémentaire', `${fr(tvaInit)} × (1 − ${fp(ci)}) × ${restantes} / ${periode}`, euros(tvaInit.times(UN.minus(ci)).times(restantes).div(periode)), 'EUR');
    }
    c.res('regularisation', r.isNegative() ? 'TVA à reverser' : 'Déduction complémentaire', r, 'EUR', { principal: true });
    c.res('ligneCa3', 'Ligne CA3', r.isNegative() ? 'Ligne 15 — TVA antérieurement déduite à reverser' : 'Ligne 21 — autre TVA à déduire', 'texte');
    if (!r.isZero())
      c.ecriture('Régularisation de TVA', r.isNegative()
        ? [{ compte: '6354', intitule: 'Régularisation TVA (charge)', debit: r.neg() }, { compte: '4458', intitule: 'TVA à régulariser', credit: r.neg() }]
        : [{ compte: '4458', intitule: 'TVA à régulariser', debit: r }, { compte: '7788', intitule: 'Produits exceptionnels divers', credit: r }]);
  },
});

export const fnpFae = formule({
  id: 'fnp-fae',
  moteur: M,
  nom: 'TVA sur FNP et FAE (clôture)',
  categorie: 'Clôture',
  description: 'Calcule la TVA à régulariser sur les factures non parvenues (44586) et les factures à établir (44587) à la clôture, et génère les écritures de rattachement.',
  expression: 'TVA = HT × t ; FNP : 6xx + 44586 / 408 ; FAE : 418 / 7xx + 44587',
  references: [
    { texte: 'PCG art. 944-44 — comptes 408, 418, 44586, 44587' },
    { texte: 'PCG art. 512-4 — rattachement à l’exercice' },
  ],
  champs: [
    table(
      'pieces',
      'Pièces à rattacher',
      [
        choix('type', 'Type', [
          ['FNP', 'Facture non parvenue'],
          ['FAE', 'Facture à établir'],
        ]),
        texte('libelle', 'Libellé'),
        montant('ht', 'Montant HT'),
        taux('taux', 'TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
      ],
      {
        min: '1',
        defaut: [
          { type: 'FNP', libelle: 'Électricité décembre', ht: '1850', taux: '20' },
          { type: 'FNP', libelle: 'Honoraires avocat', ht: '3200', taux: '20' },
          { type: 'FAE', libelle: 'Prestation livrée non facturée', ht: '7400', taux: '20' },
        ],
      },
    ),
  ],
  exemples: [{ titre: 'Clôture', entrees: {}, attendu: { tvaFnp: '1010.00', tvaFae: '1480.00', totalFnp: '6060.00', totalFae: '8880.00' } }],
  calculer(e, c) {
    type P = { type: string; libelle: string; ht: Decimal; taux: Decimal };
    const ps = e.pieces as P[];
    const tva = (p: P) => euros(p.ht.times(p.taux));
    const fnp = ps.filter((p) => p.type === 'FNP');
    const fae = ps.filter((p) => p.type === 'FAE');
    const htFnp = somme(fnp.map((p) => p.ht));
    const htFae = somme(fae.map((p) => p.ht));
    const tFnp = c.calc('tvaFnp', 'TVA déductible sur FNP (44586)', 'Σ HT × taux', somme(fnp.map(tva)));
    const tFae = c.calc('tvaFae', 'TVA collectée sur FAE (44587)', 'Σ HT × taux', somme(fae.map(tva)));
    c.calc('totalFnp', 'Fournisseurs — factures non parvenues (408)', 'HT + TVA', htFnp.plus(tFnp), 'EUR', { principal: true });
    c.calc('totalFae', 'Clients — factures à établir (418)', 'HT + TVA', htFae.plus(tFae), 'EUR', { principal: true });
    if (fnp.length)
      c.ecriture('Factures non parvenues', [
        ...fnp.map((p) => ({ compte: '6', intitule: `Charge — ${p.libelle}`, debit: p.ht })),
        { compte: '44586', intitule: 'TVA sur factures non parvenues', debit: tFnp },
        { compte: '408', intitule: 'Fournisseurs — FNP', credit: htFnp.plus(tFnp) },
      ], 'OD');
    if (fae.length)
      c.ecriture('Factures à établir', [
        { compte: '418', intitule: 'Clients — FAE', debit: htFae.plus(tFae) },
        ...fae.map((p) => ({ compte: '7', intitule: `Produit — ${p.libelle}`, credit: p.ht })),
        { compte: '44587', intitule: 'TVA sur factures à établir', credit: tFae },
      ], 'OD');
    c.ctrl('info', 'EXTOURNE', 'Écritures à extourner à l’ouverture de l’exercice suivant.');
  },
});

export const obligationsUe = formule({
  id: 'obligations-echanges-ue',
  moteur: M,
  nom: 'Obligations déclaratives UE (EMEBI/DEB, DES)',
  categorie: 'International',
  description: "Détermine les obligations de déclaration d'échanges de biens (enquête mensuelle EMEBI, ex-DEB) et de déclaration européenne de services selon les flux annuels.",
  expression: 'Introductions > seuil → volet statistique ; expéditions → volet fiscal dès 1 € (+ statistique > seuil) ; prestations B2B UE → DES dès 1 €',
  references: [
    { texte: 'CGI art. 289 B et 289 C — état récapitulatif et DES' },
    { texte: 'Règlement (UE) 2019/2152 — statistiques des échanges (EMEBI)' },
  ],
  baremes: ['tva.seuils'],
  champs: [
    montant('introductions', 'Introductions de biens (achats UE) — annuel', { defaut: '520000' }),
    montant('expeditions', 'Expéditions de biens (ventes UE) — annuel', { defaut: '180000' }),
    montant('prestations', 'Prestations B2B rendues à des clients UE — annuel', { defaut: '45000' }),
    { nom: 'dateOperation', libelle: 'Année de référence', type: 'date', defaut: '2025-01-01' },
  ],
  exemples: [{ titre: 'PME exportatrice', entrees: {}, attendu: { nbObligations: '3' } }],
  calculer(e, c) {
    const s = c.bareme<SeuilsTva>('tva.seuils', e.dateOperation);
    const seuil = d(s.seuilEmebi);
    const lignes: Record<string, string>[] = [];
    if (d(e.introductions).greaterThan(seuil)) lignes.push({ obligation: 'EMEBI — volet statistique introductions', frequence: 'Mensuelle', motif: `Introductions > ${fe(seuil)}` });
    if (d(e.expeditions).greaterThan(0)) lignes.push({ obligation: 'État récapitulatif TVA (expéditions)', frequence: 'Mensuelle', motif: 'Dès la première livraison intracommunautaire' });
    if (d(e.expeditions).greaterThan(seuil)) lignes.push({ obligation: 'EMEBI — volet statistique expéditions', frequence: 'Mensuelle', motif: `Expéditions > ${fe(seuil)}` });
    if (d(e.prestations).greaterThan(0)) lignes.push({ obligation: 'DES — déclaration européenne de services', frequence: 'Mensuelle', motif: 'Dès la première prestation B2B intracommunautaire' });
    c.calc('nbObligations', 'Nombre d’obligations', 'selon seuils', d(lignes.length), 'entier', { principal: true });
    c.tableau({
      titre: 'Obligations déclaratives',
      colonnes: [
        { cle: 'obligation', libelle: 'Obligation', unite: 'texte' },
        { cle: 'frequence', libelle: 'Fréquence', unite: 'texte' },
        { cle: 'motif', libelle: 'Motif', unite: 'texte' },
      ],
      lignes,
    });
    c.ctrl('info', 'DELAI', 'Dépôt au plus tard le 10e jour ouvrable du mois suivant (portail DEBWEB / DES en ligne).');
  },
});

export const tvaImportation = formule({
  id: 'tva-importation',
  moteur: M,
  nom: 'Importation : droits de douane et TVA',
  categorie: 'International',
  description: 'Calcule les droits de douane, la base de TVA à l’importation (valeur en douane + droits + frais jusqu’au premier lieu de destination), la TVA autoliquidée et le coût de revient.',
  expression: 'Droits = valeur en douane × taux ; base TVA = valeur + droits + frais accessoires ; TVA = base × t',
  references: [
    { texte: 'CGI art. 292 — base d’imposition des importations' },
    { texte: 'CGI art. 1695 II — autoliquidation obligatoire depuis le 01/01/2022' },
    { texte: 'Code des douanes de l’Union, art. 70 — valeur transactionnelle' },
  ],
  champs: [
    montant('valeurDouane', 'Valeur en douane (CIF)', { defaut: '30000' }),
    taux('tauxDroits', 'Taux des droits de douane', { defaut: '4.2', min: '0' }),
    montant('fraisAccessoires', 'Frais jusqu’au premier lieu de destination', { defaut: '850' }),
    taux('taux', 'Taux de TVA', { defaut: '20', suggestions: TAUX_TVA_FR }),
    taux('coefficient', 'Coefficient de déduction', { defaut: '100', min: '0', max: '100' }),
  ],
  exemples: [{ titre: 'Import 30 000 €', entrees: {}, attendu: { droits: '1260.00', baseTva: '32110.00', tva: '6422.00', coutRevient: '32110.00' } }],
  calculer(e, c) {
    const v: Decimal = e.valeurDouane;
    const droits = c.calc('droits', 'Droits de douane', `${fr(v)} × ${fp(e.tauxDroits)}`, euros(v.times(e.tauxDroits)));
    const base = c.calc('baseTva', 'Base de TVA à l’importation', `${fr(v)} + ${fr(droits)} + ${fr(e.fraisAccessoires)}`, v.plus(droits).plus(e.fraisAccessoires));
    const tva = c.calc('tva', 'TVA à l’importation (autoliquidée)', `${fr(base)} × ${fp(e.taux)}`, euros(base.times(e.taux)), 'EUR', { principal: true });
    const ded = c.calc('tvaDeductible', 'TVA déductible', `${fr(tva)} × ${fp(e.coefficient)}`, euros(tva.times(e.coefficient)));
    c.calc('coutRevient', 'Coût de revient', 'base TVA + TVA non déductible', base.plus(tva.minus(ded)), 'EUR', { principal: true });
    c.res('lignesCa3', 'Lignes CA3', 'Base ligne 2B (importations), taxe ligne 08, déduction ligne 20 (dont ligne 24)', 'texte');
    c.ecriture('Importation', [
      { compte: '607', intitule: 'Achats de marchandises', debit: v.plus(e.fraisAccessoires).plus(tva.minus(ded)) },
      { compte: '6353', intitule: 'Droits de douane', debit: droits },
      { compte: '445663', intitule: 'TVA déductible à l’importation', debit: ded },
      { compte: '445711', intitule: 'TVA due autoliquidée à l’importation', credit: tva },
      { compte: '401', intitule: 'Fournisseur étranger', credit: v.plus(e.fraisAccessoires) },
      { compte: '4011', intitule: 'Administration des douanes', credit: droits },
    ], 'HA');
  },
});

export const formulesTva = [
  htTtc,
  factureMultiTaux,
  tvaAPayer,
  ca3,
  ca12,
  exigibilite,
  intracommunautaire,
  autoliquidation,
  tvaSurMarge,
  coefficientDeduction,
  regularisationImmobilisation,
  fnpFae,
  obligationsUe,
  tvaImportation,
];

