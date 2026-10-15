/** MOTEUR 6 (suite) — Impôts locaux et taxes diverses. */
import {
  arrondiFiscal,
  booleen,
  choix,
  d,
  dateOperation,
  Decimal,
  entier,
  euros,
  fe,
  formule,
  fp,
  fr,
  frn,
  min,
  montant,
  nombre,
  pct,
  positif,
  somme,
  table,
  taux,
  texte,
  UN,
  ZERO,
  max,
} from '../noyau';
import { BaremeCvae, BaremeDivers, BaremeTascom, BaremeTaxeSalaires, BaremeTvs } from './baremes';

const M = 'fiscal' as const;

export const cfe = formule({
  id: 'cfe',
  moteur: M,
  nom: 'Cotisation foncière des entreprises (CFE)',
  categorie: 'Impôts locaux',
  description: 'Base d’imposition (valeur locative, abattement industriel, réductions de création, base minimum), cotisation au taux communal, taxes additionnelles et frais de gestion.',
  expression: 'Base = max(VL × (1 − abattements) ; base minimum) ; CFE = base × taux + taxes additionnelles + frais de gestion',
  references: [
    { texte: 'CGI art. 1447 à 1478 — CFE' },
    { texte: 'CGI art. 1499 — abattement de 50 % des établissements industriels' },
    { texte: 'CGI art. 1647 D — cotisation minimum' },
    { texte: 'CGI art. 1478 II — exonération l’année de création, base réduite de moitié l’année suivante' },
  ],
  champs: [
    montant('valeurLocative', 'Valeur locative cadastrale des biens', { defaut: '18500' }),
    booleen('industriel', 'Établissement industriel (méthode comptable)'),
    choix('annee', 'Situation', [
      ['courante', 'Année courante'],
      ['creation', 'Année de création'],
      ['deuxieme', 'Deuxième année d’activité'],
    ]),
    montant('baseMinimum', 'Base minimum votée par la commune (selon CA)', { defaut: '1200' }),
    taux('tauxCommunal', 'Taux communal et intercommunal', { defaut: '26.48' }),
    taux('taxesAdditionnelles', 'Taxes additionnelles (CCI, TSE…) en % de la base', { defaut: '1.2' }),
    taux('fraisGestion', 'Frais de gestion de la fiscalité locale', { defaut: '3' }),
  ],
  exemples: [{ titre: 'Commerce', entrees: {}, attendu: { base: '18500', cotisation: '4899', totalAPayer: '5275' } }],
  calculer(e, c) {
    let vl: Decimal = e.valeurLocative;
    if (e.industriel) vl = c.etape('Abattement industriel 50 %', `${fr(e.valeurLocative)} × 50 %`, vl.div(2), 'EUR');
    if (e.annee === 'creation') {
      c.ctrl('ok', 'CREATION', 'Exonération de CFE l’année de création.');
      c.res('base', 'Base imposable', 0, 'EUR', { decimales: 0 });
      c.res('totalAPayer', 'CFE à payer', 0, 'EUR', { decimales: 0, principal: true });
      return;
    }
    if (e.annee === 'deuxieme') vl = c.etape('Réduction de moitié (2e année)', 'VL × 50 %', vl.div(2), 'EUR');
    const base = c.calc('base', 'Base imposable', `max(${fr(vl)} ; base minimum ${fr(e.baseMinimum)})`, arrondiFiscal(max(vl, e.baseMinimum)), 'EUR', { decimales: 0 });
    if (d(e.baseMinimum).greaterThan(vl)) c.ctrl('info', 'BASE_MINIMUM', 'Base minimum appliquée.');
    const cot = c.calc('cotisation', 'Cotisation', `${fr(base, 0)} × ${fp(e.tauxCommunal)}`, arrondiFiscal(base.times(e.tauxCommunal)), 'EUR', { decimales: 0 });
    const add = c.calc('additionnelles', 'Taxes additionnelles', `${fr(base, 0)} × ${fp(e.taxesAdditionnelles)}`, arrondiFiscal(base.times(e.taxesAdditionnelles)), 'EUR', { decimales: 0 });
    const fg = c.calc('fraisGestion', 'Frais de gestion', `(${fr(cot, 0)} + ${fr(add, 0)}) × ${fp(e.fraisGestion)}`, arrondiFiscal(cot.plus(add).times(e.fraisGestion)), 'EUR', { decimales: 0 });
    c.calc('totalAPayer', 'CFE à payer', 'cotisation + taxes additionnelles + frais', cot.plus(add).plus(fg), 'EUR', { decimales: 0, principal: true });
    c.ctrl('info', 'ECHEANCES', 'Acompte de 50 % au 15 juin si CFE N−1 ≥ 3 000 €, solde au 15 décembre (ou mensualisation).');
  },
});

/** Taux effectif théorique de CVAE (barème progressif ramené au taux maximal de l'année). */
export function tauxCvae(ca: Decimal, tauxMax: Decimal): Decimal {
  const facteur = tauxMax.div('1.5');
  let t: Decimal;
  if (ca.lessThan(500000)) t = ZERO;
  else if (ca.lessThanOrEqualTo(3000000)) t = d('0.5').times(ca.minus(500000)).div(2500000);
  else if (ca.lessThanOrEqualTo(10000000)) t = d('0.5').plus(d('0.9').times(ca.minus(3000000)).div(7000000));
  else if (ca.lessThanOrEqualTo(50000000)) t = d('1.4').plus(d('0.1').times(ca.minus(10000000)).div(40000000));
  else t = d('1.5');
  return t.times(facteur).div(100);
}

export const cvae = formule({
  id: 'cvae',
  moteur: M,
  nom: 'Cotisation sur la valeur ajoutée (CVAE)',
  categorie: 'Impôts locaux',
  description: 'Plafonne la valeur ajoutée (80 % ou 85 % du CA), applique le taux effectif progressif de l’année (en extinction progressive) et calcule la cotisation.',
  expression: 'VA retenue = min(VA ; 80 % × CA si CA ≤ 7,6 M€, sinon 85 %) ; CVAE = VA retenue × taux effectif(CA)',
  references: [
    { texte: 'CGI art. 1586 ter à 1586 octies — CVAE' },
    { texte: 'CGI art. 1586 quater — taux effectif et réduction progressive (LF 2023, LF 2024, LF 2025)' },
  ],
  baremes: ['fiscal.cvae'],
  champs: [
    dateOperation('Année d’imposition (date)', { defaut: '2024-12-31' }),
    montant('ca', 'Chiffre d’affaires HT', { defaut: '6500000' }),
    montant('va', 'Valeur ajoutée (CA − consommations en provenance des tiers)', { defaut: '2800000' }),
  ],
  exemples: [{ titre: 'CA 6,5 M€ — 2024', entrees: {}, attendu: { vaRetenue: '2800000.00', tauxEffectif: '0.1773', cvae: '4965' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeCvae>('fiscal.cvae', e.dateOperation);
    const ca: Decimal = e.ca;
    const plaf = ca.lessThanOrEqualTo(7600000) ? d('0.8') : d('0.85');
    const va = c.calc('vaRetenue', 'Valeur ajoutée retenue', `min(${fr(e.va)} ; ${fp(plaf)} × ${fr(ca)})`, min(e.va, ca.times(plaf)));
    const t = c.calc('tauxEffectif', 'Taux effectif', `barème progressif × ${b.tauxMax} / 1,5`, tauxCvae(ca, d(b.tauxMax)), '%', { decimales: 4 });
    if (t.isZero()) c.ctrl('info', 'SOUS_SEUIL', 'CA < 500 000 € : CVAE nulle (déclaration 1330-CVAE obligatoire dès 152 500 € de CA).');
    c.calc('cvae', 'CVAE due', `${fr(va)} × ${fp(t, 4)}`, arrondiFiscal(va.times(t)), 'EUR', { decimales: 0, principal: true });
    c.ctrl('info', 'HORS_TAXES_ADDITIONNELLES', 'Taxe additionnelle CCI et frais de gestion non inclus ; minimum de recouvrement de 63 €.');
  },
});

export const plafonnementCet = formule({
  id: 'plafonnement-cet',
  moteur: M,
  nom: 'Contribution économique territoriale et plafonnement',
  categorie: 'Impôts locaux',
  description: 'Additionne CFE et CVAE (CET) et calcule le dégrèvement pour plafonnement en fonction de la valeur ajoutée.',
  expression: 'CET = CFE + CVAE ; dégrèvement = max(0 ; CET − VA × taux de plafonnement)',
  references: [{ texte: 'CGI art. 1647 B sexies — plafonnement de la CET' }],
  baremes: ['fiscal.cvae'],
  champs: [
    dateOperation('Année d’imposition (date)', { defaut: '2024-12-31' }),
    montant('cfe', 'CFE (hors taxes additionnelles)', { defaut: '22000' }),
    montant('cvae', 'CVAE', { defaut: '3293' }),
    montant('va', 'Valeur ajoutée', { defaut: '1200000' }),
  ],
  exemples: [{ titre: 'Dégrèvement', entrees: {}, attendu: { cet: '25293.00', plafond: '18372', degrevement: '6921' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeCvae>('fiscal.cvae', e.dateOperation);
    const cet = c.calc('cet', 'CET', `${fr(e.cfe)} + ${fr(e.cvae)}`, d(e.cfe).plus(e.cvae));
    const pl = c.calc('plafond', 'Plafond', `${fr(e.va)} × ${b.plafondCet} %`, arrondiFiscal(d(e.va).times(pct(b.plafondCet))), 'EUR', { decimales: 0 });
    const dg = c.calc('degrevement', 'Dégrèvement (sur la CFE)', `max(0 ; ${fr(cet)} − ${fr(pl, 0)})`, arrondiFiscal(min(positif(cet.minus(pl)), e.cfe)), 'EUR', { decimales: 0, principal: true });
    if (dg.greaterThan(0)) c.ctrl('info', 'RECLAMATION', 'Dégrèvement à demander sur le formulaire 1327-CET-SD au plus tard le 31 décembre de l’année suivante.');
  },
});

export const taxeSalaires = formule({
  id: 'taxe-salaires',
  moteur: M,
  nom: 'Taxe sur les salaires',
  categorie: 'Taxes sur les rémunérations',
  description:
    'Pour les employeurs non (ou partiellement) assujettis à la TVA : barème progressif par salarié, rapport d’assujettissement, abattement des associations, franchise et décote.',
  expression: 'TS(s) = 4,25 % × R + 4,25 % × (R entre S1 et S2) + 9,35 % × (R > S2) ; TS = Σ TS(s) × rapport ; franchise < 1 200 €, décote = 3/4 × (2 040 − TS)',
  references: [
    { texte: 'CGI art. 231 — assiette et barème' },
    { texte: 'CGI art. 1679 — franchise, décote et abattement des associations' },
    { texte: 'BOI-TPS-TS' },
  ],
  baremes: ['fiscal.taxe-salaires'],
  champs: [
    dateOperation('Année (date)', { defaut: '2024-12-31' }),
    table('salaries', 'Rémunérations annuelles (assiette CSG)', [texte('nom', 'Salarié'), montant('remuneration', 'Rémunération brute annuelle')], {
      min: '1',
      defaut: [
        { nom: 'Médecin', remuneration: '68000' },
        { nom: 'Infirmière', remuneration: '34000' },
        { nom: 'Secrétaire', remuneration: '24500' },
      ],
    }),
    taux('rapport', 'Rapport d’assujettissement (CA non soumis à TVA / CA total)', { defaut: '100', min: '0', max: '100' }),
    booleen('association', 'Association / organisme sans but lucratif (abattement)'),
  ],
  exemples: [{ titre: 'Cabinet médical 2024', entrees: {}, attendu: { tsBrute: '13314', tsDue: '13314' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeTaxeSalaires>('fiscal.taxe-salaires', e.dateOperation);
    const s1 = d(b.seuil1);
    const s2 = d(b.seuil2);
    const t1 = pct(b.taux1);
    const sup2 = pct(b.taux2).minus(t1);
    const sup3 = pct(b.taux3).minus(t1);
    const lignes = (e.salaries as { nom: string; remuneration: Decimal }[]).map((s) => {
      const r = s.remuneration.times(e.rapport);
      const tr2 = positif(min(r, s2).minus(s1));
      const tr3 = positif(r.minus(s2));
      const ts = r.times(t1).plus(tr2.times(sup2)).plus(tr3.times(sup3));
      return { nom: s.nom, base: euros(r).toFixed(2), ts: euros(ts).toFixed(2) };
    });
    c.etape('Barème', `${b.taux1} % ; ${b.taux2} % de ${fr(s1, 0)} à ${fr(s2, 0)} € ; ${b.taux3} % au-delà`, d(lignes.length), 'nombre');
    let ts = c.calc('tsBrute', 'Taxe brute', 'Σ taxe par salarié', arrondiFiscal(somme(lignes.map((l) => l.ts))), 'EUR', { decimales: 0 });
    if (e.association) {
      const ab = min(ts, b.abattementAssociations);
      c.etape('Abattement des associations', `min(TS ; ${fr(b.abattementAssociations, 0)})`, ab, 'EUR');
      ts = ts.minus(ab);
    }
    let due = ts;
    if (ts.lessThan(b.franchise)) {
      due = ZERO;
      c.ctrl('ok', 'FRANCHISE', `Taxe < ${fe(b.franchise)} : franchise, aucune taxe due.`);
    } else if (ts.lessThan(b.limiteDecote)) {
      const decote = arrondiFiscal(d(b.limiteDecote).minus(ts).times(3).div(4));
      c.etape('Décote', `3/4 × (${fr(b.limiteDecote, 0)} − ${fr(ts, 0)})`, decote, 'EUR');
      due = ts.minus(decote);
    }
    c.calc('tsDue', 'Taxe sur les salaires due', 'après abattement, franchise et décote', due, 'EUR', { decimales: 0, principal: true });
    c.tableau({
      titre: 'Taxe par salarié',
      colonnes: [
        { cle: 'nom', libelle: 'Salarié', unite: 'texte' },
        { cle: 'base', libelle: 'Base taxable', unite: 'EUR' },
        { cle: 'ts', libelle: 'Taxe', unite: 'EUR' },
      ],
      lignes,
    });
  },
});

export const taxesVehicules = formule({
  id: 'taxes-vehicules',
  moteur: M,
  nom: 'Taxes annuelles sur les véhicules de tourisme (ex-TVS)',
  categorie: 'Taxes diverses',
  description: 'Taxe annuelle sur les émissions de CO₂ (barème marginal WLTP) et taxe annuelle sur l’ancienneté / les polluants atmosphériques, au prorata de la durée d’affectation.',
  expression: 'Taxe CO₂ = Σ (g/km de chaque tranche × tarif marginal) × prorata ; taxe polluants = tarif catégorie × prorata',
  references: [
    { texte: 'CIBS art. L.421-119 à L.421-132 — taxe annuelle sur les émissions de CO₂' },
    { texte: 'CIBS art. L.421-133 à L.421-135 — taxe annuelle sur les polluants atmosphériques' },
  ],
  baremes: ['fiscal.tvs'],
  champs: [
    dateOperation('Année d’imposition (date)', { defaut: '2024-12-31' }),
    entier('co2', 'Émissions CO₂ WLTP (g/km)', { defaut: 128, min: '0' }),
    choix('categorie', 'Catégorie polluants', [
      ['critair1', 'Essence / hybride (Crit’Air 1)'],
      ['autres', 'Véhicules les plus polluants (diesel…)'],
      ['electrique', 'Électrique / hydrogène'],
    ]),
    entier('jours', 'Jours d’affectation à l’activité', { defaut: 365, min: '0', max: '366' }),
    entier('joursAnnee', 'Jours de l’année', { defaut: 366, min: '365', max: '366' }),
  ],
  exemples: [{ titre: 'Berline 128 g toute l’année', entrees: {}, attendu: { tarifCo2: '363.00', taxeCo2: '362.01', taxePolluants: '99.73', total: '462' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeTvs>('fiscal.tvs', e.dateOperation);
    let tarif = ZERO;
    if (e.categorie !== 'electrique')
      for (const tr of b.co2) {
        if (e.co2 < tr.de) break;
        const haut = tr.a === null ? e.co2 : Math.min(e.co2, tr.a);
        const g = haut - Math.max(tr.de, 1) + 1;
        tarif = tarif.plus(d(g).times(tr.tarif));
      }
    c.calc('tarifCo2', 'Tarif annuel CO₂ (barème marginal)', `Σ tranches jusqu’à ${e.co2} g/km`, tarif);
    const prorata = d(e.jours).div(e.joursAnnee);
    c.etape('Prorata d’affectation', `${e.jours} / ${e.joursAnnee}`, prorata, '%');
    const tc = c.calc('taxeCo2', 'Taxe CO₂', `${fr(tarif)} × prorata`, euros(tarif.times(prorata)));
    const tp = c.calc('taxePolluants', 'Taxe polluants', `${fr(b.polluants[e.categorie as 'autres'])} × prorata`, euros(d(b.polluants[e.categorie as 'autres']).times(prorata)));
    c.calc('total', 'Total à payer (arrondi à l’euro)', 'taxe CO₂ + taxe polluants', arrondiFiscal(tc.plus(tp)), 'EUR', { decimales: 0, principal: true });
    c.ctrl('info', 'NON_DEDUCTIBLE', 'Taxes non déductibles du résultat fiscal (réintégration 2058-A ligne WG). Déclaration sur l’annexe 3310-A (janvier).');
  },
});

export const contributionsFormation = formule({
  id: 'contributions-formation',
  moteur: M,
  nom: 'Taxe d’apprentissage et contribution formation',
  categorie: 'Taxes sur les rémunérations',
  description: 'Contribution unique à la formation professionnelle et à l’alternance (CUFPA) : taxe d’apprentissage (part principale et solde), contribution à la formation professionnelle, 1 % CPF-CDD.',
  expression: 'TA = MS × 0,59 % (0,44 % Alsace-Moselle) + MS × 0,09 % ; CFP = MS × 0,55 % (< 11) ou 1 % ; CPF-CDD = MS CDD × 1 %',
  references: [
    { texte: 'Code du travail art. L.6241-1 et s. — taxe d’apprentissage' },
    { texte: 'Code du travail art. L.6131-2 et L.6331-1 — contribution formation' },
    { texte: 'CGI art. 1599 ter A — taxe d’apprentissage' },
  ],
  baremes: ['fiscal.divers'],
  champs: [
    dateOperation('Année (date)', { defaut: '2024-12-31' }),
    montant('masseSalariale', 'Masse salariale brute annuelle', { defaut: '850000' }),
    montant('masseCdd', 'dont rémunérations des CDD', { defaut: '60000' }),
    entier('effectif', 'Effectif moyen', { defaut: 18, min: '0', max: '10000000' }),
    booleen('alsaceMoselle', 'Établissement en Alsace-Moselle'),
  ],
  exemples: [{ titre: 'PME 18 salariés', entrees: {}, attendu: { taPrincipale: '5015.00', taSolde: '765.00', cfp: '8500.00', cpfCdd: '600.00', total: '14880.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeDivers>('fiscal.divers', e.dateOperation);
    const ms: Decimal = e.masseSalariale;
    const tp = c.calc('taPrincipale', 'Taxe d’apprentissage — part principale', `${fr(ms)} × ${e.alsaceMoselle ? b.taAlsace : b.taPrincipale} %`, euros(ms.times(pct(e.alsaceMoselle ? b.taAlsace : b.taPrincipale))));
    const ts = c.calc('taSolde', 'Solde de la taxe d’apprentissage', `${fr(ms)} × ${b.taSolde} %`, e.alsaceMoselle ? ZERO : euros(ms.times(pct(b.taSolde))));
    const tc = e.effectif < 11 ? b.cfpMoins11 : b.cfpPlus11;
    const cfp = c.calc('cfp', 'Contribution à la formation professionnelle', `${fr(ms)} × ${tc} %`, euros(ms.times(pct(tc))));
    const cdd = c.calc('cpfCdd', 'Contribution 1 % CPF-CDD', `${fr(e.masseCdd)} × ${b.cpfCdd} %`, euros(d(e.masseCdd).times(pct(b.cpfCdd))));
    c.calc('total', 'Total CUFPA', 'somme', somme([tp, ts, cfp, cdd]), 'EUR', { principal: true });
    if (e.effectif >= 250) c.ctrl('info', 'CSA', 'Effectif ≥ 250 : contribution supplémentaire à l’apprentissage due si moins de 5 % d’alternants.');
  },
});

export const c3s = formule({
  id: 'c3s',
  moteur: M,
  nom: 'Contribution sociale de solidarité des sociétés (C3S)',
  categorie: 'Taxes diverses',
  description: 'Contribution due par les entreprises dont le CA dépasse 19 M€, assise sur la fraction excédentaire.',
  expression: 'C3S = 0,16 % × max(0 ; CA HT − 19 000 000)',
  references: [{ texte: 'CSS art. L.137-30 à L.137-37 — C3S et contribution additionnelle' }],
  baremes: ['fiscal.divers'],
  champs: [dateOperation('Année de référence (date)', { defaut: '2024-12-31' }), montant('ca', 'Chiffre d’affaires HT de l’année N−1', { defaut: '42000000' })],
  exemples: [{ titre: 'CA 42 M€', entrees: {}, attendu: { base: '23000000.00', c3s: '36800' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeDivers>('fiscal.divers', e.dateOperation);
    const base = c.calc('base', 'Assiette', `max(0 ; ${fr(e.ca)} − ${fr(b.c3sAbattement, 0)})`, positif(d(e.ca).minus(b.c3sAbattement)));
    c.calc('c3s', 'C3S due', `${fr(base)} × ${b.c3sTaux} %`, arrondiFiscal(base.times(pct(b.c3sTaux))), 'EUR', { decimales: 0, principal: true });
    c.ctrl('info', 'ECHEANCE', 'Déclaration et paiement au plus tard le 15 mai (net-entreprises).');
  },
});

export const taxeBureaux = formule({
  id: 'taxe-bureaux-idf',
  moteur: M,
  nom: 'Taxe sur les bureaux en Île-de-France',
  categorie: 'Taxes diverses',
  description: 'Taxe annuelle sur les locaux à usage de bureaux, commerciaux, de stockage et les surfaces de stationnement, selon les tarifs au m² de la circonscription (exonération des surfaces sous les seuils).',
  expression: 'Taxe = Σ surface taxable × tarif au m² de la circonscription',
  references: [{ texte: 'CGI art. 231 ter — taxe annuelle sur les locaux en Île-de-France' }, { texte: 'BOI-IF-AUT-50' }],
  champs: [
    nombre('bureaux', 'Surface de bureaux (m²)', { defaut: '850' }),
    montant('tarifBureaux', 'Tarif bureaux (€/m²) de la circonscription', { defaut: '24.21' }),
    nombre('commerciaux', 'Locaux commerciaux (m²)', { defaut: '0' }),
    montant('tarifCommerciaux', 'Tarif locaux commerciaux (€/m²)', { defaut: '9.46' }),
    nombre('stockage', 'Locaux de stockage (m²)', { defaut: '0' }),
    montant('tarifStockage', 'Tarif stockage (€/m²)', { defaut: '4.89' }),
    nombre('stationnement', 'Surfaces de stationnement (m²)', { defaut: '320' }),
    montant('tarifStationnement', 'Tarif stationnement (€/m²)', { defaut: '2.91' }),
  ],
  exemples: [{ titre: 'Siège social', entrees: {}, attendu: { taxe: '20579' } }],
  calculer(e, c) {
    const items: [string, Decimal, Decimal, number][] = [
      ['Bureaux', e.bureaux, e.tarifBureaux, 100],
      ['Locaux commerciaux', e.commerciaux, e.tarifCommerciaux, 2500],
      ['Stockage', e.stockage, e.tarifStockage, 5000],
      ['Stationnement', e.stationnement, e.tarifStationnement, 500],
    ];
    let total = ZERO;
    const lignes = items.map(([lib, s, t, seuil]) => {
      const taxable = s.lessThan(seuil) ? ZERO : s;
      const m = euros(taxable.times(t));
      total = total.plus(m);
      if (s.greaterThan(0) && taxable.isZero()) c.ctrl('info', 'SEUIL', `${lib} : surface < ${seuil} m², exonérée.`);
      return { nature: lib, surface: s.toFixed(), tarif: t.toFixed(2), taxe: m.toFixed(2) };
    });
    c.calc('taxe', 'Taxe sur les bureaux', 'Σ surfaces × tarifs', arrondiFiscal(total), 'EUR', { decimales: 0, principal: true });
    c.tableau({
      titre: 'Détail par nature de locaux',
      colonnes: [
        { cle: 'nature', libelle: 'Nature', unite: 'texte' },
        { cle: 'surface', libelle: 'Surface m²', unite: 'nombre' },
        { cle: 'tarif', libelle: 'Tarif €/m²', unite: 'EUR' },
        { cle: 'taxe', libelle: 'Taxe', unite: 'EUR' },
      ],
      lignes,
    });
    c.ctrl('avertissement', 'TARIFS', 'Tarifs à vérifier : ils sont revalorisés chaque année et varient selon la circonscription (déclaration n° 6705-B avant le 1er mars).');
  },
});

export const tlpe = formule({
  id: 'tlpe',
  moteur: M,
  nom: 'Taxe locale sur la publicité extérieure (enseignes)',
  categorie: 'Taxes diverses',
  description: 'TLPE sur les enseignes : exonération jusqu’à 7 m², tarif de base jusqu’à 12 m², doublé de 12 à 50 m², quadruplé au-delà ; prorata en cas d’installation en cours d’année.',
  expression: 'TLPE = surface totale × tarif de base × coefficient (1 ; 2 ; 4) × prorata',
  references: [{ texte: 'CGCT art. L.2333-6 à L.2333-16 — TLPE' }],
  champs: [
    nombre('surface', 'Surface totale des enseignes (m²)', { defaut: '18' }),
    montant('tarifBase', 'Tarif de base de la commune (€/m²)', { defaut: '17.30' }),
    booleen('exonerationCommune', 'Exonération des enseignes ≤ 12 m² votée par la commune'),
    nombre('moisInstallation', 'Mois d’installation sur l’année', { defaut: '12', min: '1', max: '12' }),
  ],
  exemples: [{ titre: 'Enseigne de 18 m²', entrees: {}, attendu: { coefficient: '2', tlpe: '623' } }],
  calculer(e, c) {
    const s: Decimal = e.surface;
    if (s.lessThanOrEqualTo(7) || (e.exonerationCommune && s.lessThanOrEqualTo(12))) {
      c.ctrl('ok', 'EXONERE', 'Surface sous le seuil d’exonération.');
      c.res('tlpe', 'TLPE', 0, 'EUR', { decimales: 0, principal: true });
      return;
    }
    const coef = s.greaterThan(50) ? 4 : s.greaterThan(12) ? 2 : 1;
    c.res('coefficient', 'Coefficient', coef, 'entier');
    c.calc('tlpe', 'TLPE', `${frn(s)} m² × ${fr(e.tarifBase)} € × ${coef} × ${frn(e.moisInstallation)}/12`, arrondiFiscal(s.times(e.tarifBase).times(coef).times(e.moisInstallation).div(12)), 'EUR', { decimales: 0, principal: true });
  },
});

export const tascom = formule({
  id: 'tascom',
  moteur: M,
  nom: 'Taxe sur les surfaces commerciales (TaSCom)',
  categorie: 'Taxes diverses',
  description: 'Commerces de détail de plus de 400 m² : tarif au m² fonction du CA par m², modulation communale et majoration des grandes surfaces.',
  expression: 'CA/m² < 3 000 : 5,74 € ; 3 000 à 12 000 : 5,74 + 0,00315 × (CA/m² − 3 000) ; > 12 000 : 34,12 € ; × surface × coefficient',
  references: [{ texte: 'Loi n° 72-657 du 13/07/1972, art. 3 — TaSCom' }, { texte: 'BOI-TFP-TSC' }],
  baremes: ['fiscal.tascom'],
  champs: [
    dateOperation('Année (date)', { defaut: '2024-12-31' }),
    nombre('surface', 'Surface de vente (m²)', { defaut: '1800' }),
    montant('ca', 'CA HT de l’année précédente', { defaut: '9450000' }),
    nombre('coefficient', 'Coefficient de modulation communal (0,8 à 1,3)', { defaut: '1.1', min: '0.8', max: '1.3' }),
  ],
  exemples: [{ titre: 'Supermarché 1 800 m²', entrees: {}, attendu: { caParM2: '5250.00', tarif: '12.83', tascom: '25403' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeTascom>('fiscal.tascom', e.dateOperation);
    const s: Decimal = e.surface;
    if (s.lessThanOrEqualTo(b.surfaceMin)) {
      c.ctrl('ok', 'NON_ASSUJETTI', `Surface ≤ ${b.surfaceMin} m² : non assujetti.`);
      c.res('tascom', 'TaSCom', 0, 'EUR', { decimales: 0, principal: true });
      return;
    }
    const cam = c.calc('caParM2', 'CA par m²', `${fr(e.ca)} / ${frn(s)}`, euros(d(e.ca).div(s)));
    const tarif = cam.lessThan(b.seuilBas)
      ? d(b.tarifBas)
      : cam.greaterThan(b.seuilHaut)
        ? d(b.tarifHaut)
        : d(b.tarifBas).plus(d(b.pente).times(cam.minus(b.seuilBas)));
    c.calc('tarif', 'Tarif au m²', 'barème selon CA/m²', euros(tarif));
    let tx = euros(tarif).times(s).times(e.coefficient);
    if (s.greaterThan(b.surfaceMajoration)) {
      tx = tx.times(UN.plus(pct(b.majoration)));
      c.ctrl('info', 'MAJORATION', `Surface > ${b.surfaceMajoration} m² : majoration de ${b.majoration} %.`);
    }
    c.calc('tascom', 'TaSCom due', `${fr(euros(tarif))} × ${frn(s)} × ${frn(e.coefficient)}`, arrondiFiscal(tx), 'EUR', { decimales: 0, principal: true });
  },
});

export const taxeSpectacles = formule({
  id: 'taxe-spectacles',
  moteur: M,
  nom: 'Taxe sur les spectacles',
  categorie: 'Taxes diverses',
  description: 'Taxe sur la billetterie des spectacles de variétés (CNM) ou dramatiques, lyriques et chorégraphiques (ASTP).',
  expression: 'Taxe = recettes de billetterie HT × 3,5 %',
  references: [{ texte: 'CIBS art. L.453-1 et s. (ex-CGI art. 1535 et 76 de la loi n° 2003-1312)' }],
  baremes: ['fiscal.divers'],
  champs: [dateOperation('Date du spectacle', { defaut: '2024-10-15' }), montant('billetterieHT', 'Recettes de billetterie HT', { defaut: '48000' })],
  exemples: [{ titre: 'Concert', entrees: {}, attendu: { taxe: '1680.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeDivers>('fiscal.divers', e.dateOperation);
    c.calc('taxe', 'Taxe sur les spectacles', `${fr(e.billetterieHT)} × ${b.spectacles} %`, euros(d(e.billetterieHT).times(pct(b.spectacles))), 'EUR', { principal: true });
  },
});

export const formulesTaxes = [cfe, cvae, plafonnementCet, taxeSalaires, taxesVehicules, contributionsFormation, c3s, taxeBureaux, tlpe, tascom, taxeSpectacles];
