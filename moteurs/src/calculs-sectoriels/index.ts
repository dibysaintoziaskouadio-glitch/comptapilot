/**
 * MOTEUR SECTORIEL — BTP, promotion immobilière, agriculture, associations,
 * professions libérales et micro-entreprises, banque et assurance.
 */
import {
  bareme,
  booleen,
  choix,
  d,
  dateOperation,
  Decimal,
  diviser,
  euros,
  fe,
  formule,
  fp,
  fr,
  liste,
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
  arrondi,
  max,
} from '../noyau';

const M = 'sectoriels' as const;

// ──────────────────────────────── BTP ────────────────────────────────

export const avancementChantier = formule({
  id: 'avancement-chantier',
  moteur: M,
  nom: 'BTP : contrat à l’avancement et perte à terminaison',
  categorie: 'BTP',
  description: 'Méthode à l’avancement des contrats à long terme : pourcentage d’avancement par les coûts, chiffre d’affaires et marge de l’exercice, provision pour perte à terminaison.',
  expression: '% = coûts engagés / coûts totaux estimés ; CA cumulé = prix × % ; CA exercice = CA cumulé − CA antérieur ; perte à terminaison provisionnée intégralement',
  references: [
    { texte: 'PCG art. 622-1 à 622-7 — contrats à long terme (méthode préférentielle à l’avancement)' },
    { texte: 'CGI art. 38-2 bis — rattachement des produits' },
  ],
  champs: [
    montant('prixContrat', 'Prix du contrat HT (avenants inclus)', { defaut: '2400000' }),
    montant('coutsEngages', 'Coûts engagés cumulés à la clôture', { defaut: '1320000' }),
    montant('coutsRestants', 'Coûts restant à engager (estimation)', { defaut: '880000' }),
    montant('caAnterieur', 'CA déjà comptabilisé sur les exercices antérieurs', { defaut: '600000' }),
    montant('margeAnterieure', 'Marge déjà constatée sur les exercices antérieurs', { defaut: '50000' }),
    montant('facture', 'Facturation cumulée (situations émises)', { defaut: '1500000' }),
  ],
  exemples: [
    { titre: 'Chantier bénéficiaire', entrees: {}, attendu: { avancement: '60.00', caCumule: '1440000.00', caExercice: '840000.00', margeExercice: '70000.00', fae: '0.00', pca: '60000.00' } },
    { titre: 'Chantier déficitaire', entrees: { coutsRestants: '1200000' }, attendu: { margePrevisionnelle: '-120000.00', provisionPerte: '57142.86' } },
  ],
  calculer(e, c) {
    const total = c.calc('coutsTotaux', 'Coûts totaux estimés', `${fr(e.coutsEngages)} + ${fr(e.coutsRestants)}`, d(e.coutsEngages).plus(e.coutsRestants));
    const marge = c.calc('margePrevisionnelle', 'Marge prévisionnelle à terminaison', `${fr(e.prixContrat)} − ${fr(total)}`, d(e.prixContrat).minus(total));
    const av = c.calc('avancement', 'Pourcentage d’avancement', `${fr(e.coutsEngages)} / ${fr(total)}`, diviser(e.coutsEngages, total), '%', { principal: true });
    const caCum = c.calc('caCumule', 'CA cumulé à l’avancement', `${fr(e.prixContrat)} × ${fp(av)}`, euros(d(e.prixContrat).times(av)));
    c.calc('caExercice', 'CA de l’exercice', `${fr(caCum)} − ${fr(e.caAnterieur)}`, caCum.minus(e.caAnterieur), 'EUR', { principal: true });
    if (marge.isNegative()) {
      const perteRestante = marge.neg().times(UN.minus(av));
      c.calc('provisionPerte', 'Provision pour perte à terminaison', `perte totale ${fr(marge.neg())} × (1 − ${fp(av)})`, euros(perteRestante));
      c.calc('margeExercice', 'Résultat de l’exercice sur le contrat', 'perte totale à terminaison − marge antérieure', marge.minus(e.margeAnterieure));
      c.ctrl('avertissement', 'PERTE_TERMINAISON', `Contrat déficitaire : la perte totale de ${fe(marge.neg())} est constatée dès cet exercice (PCG 622-7).`);
    } else {
      const margeCum = euros(marge.times(av));
      c.calc('margeExercice', 'Marge de l’exercice', `${fr(marge)} × ${fp(av)} − ${fr(e.margeAnterieure)}`, margeCum.minus(e.margeAnterieure));
    }
    const ecart = caCum.minus(e.facture);
    c.res('fae', 'Factures à établir (CA > facturé)', positif(ecart));
    c.res('pca', 'Produits constatés d’avance (facturé > CA)', positif(ecart.neg()));
  },
});

export const situationTravaux = formule({
  id: 'situation-travaux',
  moteur: M,
  nom: 'BTP : situation de travaux et retenue de garantie',
  categorie: 'BTP',
  description: 'Montant de la situation mensuelle à partir de l’avancement cumulé, TVA (ou autoliquidation du sous-traitant), retenue de garantie de 5 % et net à payer.',
  expression: 'Situation HT = marché × avancement cumulé − situations antérieures ; retenue = 5 % × TTC (sauf caution) ; net = TTC − retenue − remboursement d’avance',
  references: [
    { texte: 'Loi n° 71-584 du 16/07/1971 — retenue de garantie limitée à 5 %' },
    { texte: 'CGI art. 283-2 nonies — autoliquidation en sous-traitance BTP' },
    { texte: 'CGI art. 279-0 bis — TVA à 10 % (travaux de rénovation)' },
  ],
  champs: [
    montant('marche', 'Montant du marché HT', { defaut: '850000' }),
    taux('avancementCumule', 'Avancement cumulé', { defaut: '45' }),
    montant('situationsAnterieures', 'Situations antérieures cumulées HT', { defaut: '255000' }),
    taux('tva', 'Taux de TVA', { defaut: '20', suggestions: ['20', '10', '5.5'] }),
    booleen('autoliquidation', 'Sous-traitant (autoliquidation)'),
    booleen('caution', 'Retenue remplacée par une caution bancaire'),
    taux('tauxRetenue', 'Taux de retenue de garantie', { defaut: '5', max: '5' }),
    montant('remboursementAvance', 'Remboursement de l’avance forfaitaire', { defaut: '0' }),
  ],
  exemples: [{ titre: 'Situation n° 4', entrees: {}, attendu: { situationHT: '127500.00', tva: '25500.00', ttc: '153000.00', retenue: '7650.00', netAPayer: '145350.00' } }],
  calculer(e, c) {
    const cum = euros(d(e.marche).times(e.avancementCumule));
    c.etape('Travaux cumulés', `${fr(e.marche)} × ${fp(e.avancementCumule)}`, cum, 'EUR');
    const ht = c.calc('situationHT', 'Montant HT de la situation', `${fr(cum)} − ${fr(e.situationsAnterieures)}`, cum.minus(e.situationsAnterieures), 'EUR', { principal: true });
    const tva = c.calc('tva', 'TVA', e.autoliquidation ? 'autoliquidée par l’entrepreneur principal' : `${fr(ht)} × ${fp(e.tva)}`, e.autoliquidation ? ZERO : euros(ht.times(e.tva)));
    const ttc = c.calc('ttc', 'Montant TTC', 'HT + TVA', ht.plus(tva));
    const ret = c.calc('retenue', 'Retenue de garantie', e.caution ? 'caution bancaire : pas de retenue' : `${fr(ttc)} × ${fp(e.tauxRetenue)}`, e.caution ? ZERO : euros(ttc.times(e.tauxRetenue)));
    c.calc('netAPayer', 'Net à payer', 'TTC − retenue − remboursement d’avance', ttc.minus(ret).minus(e.remboursementAvance), 'EUR', { principal: true });
    if (e.autoliquidation) c.res('mention', 'Mention obligatoire', 'Autoliquidation — article 283-2 nonies du CGI', 'texte');
    if (d(e.avancementCumule).greaterThan(1)) c.ctrl('erreur', 'AVANCEMENT', 'Avancement cumulé supérieur à 100 % : établir un avenant.');
    c.ctrl('info', 'LIBERATION', 'La retenue est libérée un an après la réception, sauf réserves notifiées.');
  },
});

export const compteProrata = formule({
  id: 'compte-prorata',
  moteur: M,
  nom: 'BTP : compte prorata',
  categorie: 'BTP',
  description: 'Répartit les dépenses communes de chantier entre les entreprises au prorata de leur marché, au centime près, et compare aux provisions versées.',
  expression: 'Part = dépenses communes × marché de l’entreprise / Σ marchés ; solde = part − provisions versées',
  references: [{ texte: 'Norme NF P 03-001 — cahier des clauses administratives générales (compte prorata)' }],
  champs: [
    montant('depensesCommunes', 'Dépenses communes à répartir', { defaut: '38500' }),
    table('entreprises', 'Entreprises', [texte('lot', 'Lot / entreprise'), montant('marche', 'Montant du marché HT'), montant('provisions', 'Provisions déjà versées', { defaut: '0' })], {
      min: '1',
      defaut: [
        { lot: 'Gros œuvre', marche: '1250000', provisions: '15000' },
        { lot: 'Électricité', marche: '320000', provisions: '4000' },
        { lot: 'Plomberie', marche: '280000', provisions: '4000' },
        { lot: 'Menuiseries', marche: '190000', provisions: '2000' },
      ],
    }),
  ],
  exemples: [{ titre: 'Quatre lots', entrees: {}, attendu: { part_1: '23590.69', part_2: '6039.22', part_3: '5284.31', part_4: '3585.78' } }],
  calculer(e, c) {
    type En = { lot: string; marche: Decimal; provisions: Decimal };
    const es = e.entreprises as En[];
    const tot = somme(es.map((x) => x.marche));
    const dep: Decimal = e.depensesCommunes;
    const exactes = es.map((x) => dep.times(x.marche).div(tot));
    const parts = exactes.map((x) => arrondi(x, 2, 'troncature'));
    let reliquat = dep.minus(somme(parts)).times(100).round().toNumber();
    const ordre = exactes.map((x, i) => ({ i, r: x.minus(parts[i]) })).sort((a, b) => b.r.comparedTo(a.r) || a.i - b.i);
    for (let k = 0; reliquat > 0; k = (k + 1) % ordre.length, reliquat--) parts[ordre[k].i] = parts[ordre[k].i].plus('0.01');
    const lignes = es.map((x, i) => {
      c.calc(`part_${i + 1}`, `Part — ${x.lot}`, `${fr(dep)} × ${fr(x.marche)} / ${fr(tot)}`, parts[i]);
      return { lot: x.lot, marche: x.marche.toFixed(2), part: parts[i].toFixed(2), provisions: x.provisions.toFixed(2), solde: parts[i].minus(x.provisions).toFixed(2) };
    });
    c.verifier(somme(parts).equals(dep), 'REPARTITION', 'Répartition exacte au centime.', 'Écart de répartition.');
    c.tableau({
      titre: 'Répartition du compte prorata',
      colonnes: [
        { cle: 'lot', libelle: 'Lot', unite: 'texte' },
        { cle: 'marche', libelle: 'Marché HT', unite: 'EUR' },
        { cle: 'part', libelle: 'Quote-part', unite: 'EUR' },
        { cle: 'provisions', libelle: 'Provisions versées', unite: 'EUR' },
        { cle: 'solde', libelle: 'Solde à payer (+) / à rembourser (−)', unite: 'EUR' },
      ],
      lignes,
    });
  },
});

// ───────────────────────────── Immobilier ─────────────────────────────

const STADES_VEFA: [string, string, string][] = [
  ['reservation', 'Réservation (dépôt de garantie)', '5'],
  ['fondations', 'Achèvement des fondations', '35'],
  ['hors-eau', 'Mise hors d’eau', '70'],
  ['achevement', 'Achèvement de l’immeuble', '95'],
  ['livraison', 'Remise des clés (solde)', '100'],
];

export const vefa = formule({
  id: 'vefa',
  moteur: M,
  nom: 'VEFA : échéancier des appels de fonds',
  categorie: 'Immobilier',
  description: 'Montant maximal cumulé exigible de l’acquéreur selon le stade d’avancement (secteur protégé), déjà appelé et à appeler.',
  expression: 'Appel cumulé ≤ prix × plafond du stade (35 % fondations, 70 % hors d’eau, 95 % achèvement) ; à appeler = plafond × prix − déjà appelé',
  references: [{ texte: 'Code de la construction et de l’habitation art. R.261-14 — échelonnement des paiements' }, { texte: 'CCH art. R.261-28 — dépôt de garantie (5 % maximum)' }],
  champs: [
    montant('prix', 'Prix de vente TTC', { defaut: '385000' }),
    choix('stade', 'Stade atteint', STADES_VEFA.map(([k, l, p]) => [k, `${l} — ${p} %`] as [string, string])),
    montant('dejaAppele', 'Montant déjà appelé', { defaut: '19250' }),
  ],
  exemples: [{ titre: 'Hors d’eau', entrees: { stade: 'hors-eau', dejaAppele: '134750' }, attendu: { plafond: '269500.00', aAppeler: '134750.00' } }],
  calculer(e, c) {
    const st = STADES_VEFA.find(([k]) => k === e.stade)!;
    const pl = c.calc('plafond', 'Montant cumulé exigible', `${fr(e.prix)} × ${st[2]} %`, euros(d(e.prix).times(pct(st[2]))));
    c.calc('aAppeler', 'Appel de fonds à émettre', `${fr(pl)} − ${fr(e.dejaAppele)}`, positif(pl.minus(e.dejaAppele)), 'EUR', { principal: true });
    if (d(e.dejaAppele).greaterThan(pl)) c.ctrl('erreur', 'APPEL_EXCESSIF', 'Les sommes déjà appelées dépassent le plafond légal du stade atteint.');
    c.tableau({
      titre: 'Échéancier légal',
      colonnes: [
        { cle: 'stade', libelle: 'Stade', unite: 'texte' },
        { cle: 'taux', libelle: 'Cumul maximal', unite: '%' },
        { cle: 'montant', libelle: 'Montant cumulé', unite: 'EUR' },
      ],
      lignes: STADES_VEFA.map(([, l, p]) => ({ stade: l, taux: d(p).toFixed(2), montant: euros(d(e.prix).times(pct(p))).toFixed(2) })),
    });
  },
});

export const promotionImmobiliere = formule({
  id: 'promotion-immobiliere',
  moteur: M,
  nom: 'Promotion immobilière : résultat à l’avancement par programme',
  categorie: 'Immobilier',
  description: 'Résultat d’un programme vendu en VEFA : avancement technique (coûts), avancement commercial (lots vendus), chiffre d’affaires et marge dégagés, stock d’encours.',
  expression: 'CA = prix des lots vendus × avancement technique ; coût des ventes = coûts totaux × % commercialisé × avancement ; stock = coûts engagés − coût des ventes',
  references: [{ texte: 'Règlement ANC 2012-05 — ventes en l’état futur d’achèvement' }, { texte: 'PCG art. 622-1 et s.' }],
  champs: [
    montant('prixTotal', 'Prix de vente total du programme HT', { defaut: '12000000' }),
    taux('commercialisation', 'Lots vendus (en % du prix total)', { defaut: '65' }),
    montant('coutsEngages', 'Coûts engagés (terrain inclus)', { defaut: '5400000' }),
    montant('coutsTotaux', 'Coûts totaux estimés', { defaut: '9600000' }),
  ],
  exemples: [{ titre: 'Résidence de 40 lots', entrees: {}, attendu: { avancementTechnique: '56.25', ca: '4387500.00', coutVentes: '3510000.00', marge: '877500.00', stock: '1890000.00' } }],
  calculer(e, c) {
    const av = c.calc('avancementTechnique', 'Avancement technique', `${fr(e.coutsEngages)} / ${fr(e.coutsTotaux)}`, diviser(e.coutsEngages, e.coutsTotaux), '%');
    const ca = c.calc('ca', 'CA dégagé', `${fr(e.prixTotal)} × ${fp(e.commercialisation)} × ${fp(av)}`, euros(d(e.prixTotal).times(e.commercialisation).times(av)), 'EUR', { principal: true });
    const cv = c.calc('coutVentes', 'Coût des ventes', `${fr(e.coutsTotaux)} × ${fp(e.commercialisation)} × ${fp(av)}`, euros(d(e.coutsTotaux).times(e.commercialisation).times(av)));
    c.calc('marge', 'Marge dégagée', `${fr(ca)} − ${fr(cv)}`, ca.minus(cv), 'EUR', { principal: true });
    c.calc('stock', 'Stock d’encours (lots non vendus)', `${fr(e.coutsEngages)} − ${fr(cv)}`, d(e.coutsEngages).minus(cv));
    if (d(e.prixTotal).lessThan(e.coutsTotaux)) c.ctrl('avertissement', 'PERTE', 'Programme déficitaire : provisionner la perte à terminaison.');
  },
});

// ───────────────────────────── Agriculture ─────────────────────────────

export const remboursementForfaitaire = formule({
  id: 'remboursement-forfaitaire-agricole',
  moteur: M,
  nom: 'Agriculture : remboursement forfaitaire agricole',
  categorie: 'Agriculture',
  description: 'Exploitants non assujettis à la TVA : remboursement forfaitaire calculé sur les ventes de produits agricoles à des assujettis.',
  expression: 'RFA = ventes éligibles × taux (5,59 % ou 4,43 % selon les produits)',
  references: [{ texte: 'CGI art. 298 quater — remboursement forfaitaire agricole' }],
  champs: [
    montant('ventesTaux1', 'Ventes de lait, animaux de boucherie et de basse-cour, œufs (4,43 %)', { defaut: '62000' }),
    montant('ventesTaux2', 'Ventes des autres produits (5,59 %)', { defaut: '48000' }),
  ],
  exemples: [{ titre: 'Polyculture-élevage', entrees: {}, attendu: { remboursement: '5429.80' } }],
  calculer(e, c) {
    const a = euros(d(e.ventesTaux1).times('0.0443'));
    const b = euros(d(e.ventesTaux2).times('0.0559'));
    c.etape('Produits à 4,43 %', `${fr(e.ventesTaux1)} × 4,43 %`, a, 'EUR');
    c.etape('Produits à 5,59 %', `${fr(e.ventesTaux2)} × 5,59 %`, b, 'EUR');
    c.calc('remboursement', 'Remboursement forfaitaire', 'somme', a.plus(b), 'EUR', { principal: true });
    c.ctrl('info', 'DEMANDE', 'Demande annuelle (formulaire 3520) avant le 31 décembre de l’année suivante.');
  },
});

export const subventionInvestissement = formule({
  id: 'subvention-investissement',
  moteur: M,
  nom: 'Subvention d’investissement (PAC, collectivités) : reprise au résultat',
  categorie: 'Agriculture',
  description: 'Étale la subvention d’investissement au rythme de l’amortissement du bien financé : quote-part annuelle virée au résultat, solde au bilan.',
  expression: 'Quote-part = subvention × dotation de l’exercice / base amortissable',
  references: [{ texte: 'PCG art. 312-1 et 941-13 — subventions d’investissement (131, 139, 777)' }, { texte: 'CGI art. 42 septies — étalement fiscal' }],
  champs: [
    montant('subvention', 'Subvention reçue', { defaut: '45000' }),
    montant('valeurBien', 'Valeur du bien financé', { defaut: '150000' }),
    liste('dotations', 'Dotations aux amortissements par exercice', { min: '1', defaut: ['15000', '30000', '30000', '30000', '30000', '15000'] }),
  ],
  exemples: [{ titre: 'Bâtiment d’élevage', entrees: {}, attendu: { quotePart1: '4500.00', totalRepris: '45000.00' } }],
  calculer(e, c) {
    let cumul = ZERO;
    const ds = e.dotations as Decimal[];
    const lignes = ds.map((dot, i) => {
      let qp = euros(d(e.subvention).times(dot).div(e.valeurBien));
      if (i === ds.length - 1 && somme(ds).equals(e.valeurBien)) qp = d(e.subvention).minus(cumul);
      cumul = cumul.plus(qp);
      if (i === 0) c.res('quotePart1', 'Quote-part de l’exercice 1', qp, 'EUR', { principal: true });
      return { exercice: String(i + 1), dotation: dot.toFixed(2), quotePart: qp.toFixed(2), solde: d(e.subvention).minus(cumul).toFixed(2) };
    });
    c.calc('totalRepris', 'Total repris au résultat', 'Σ quotes-parts', cumul);
    if (!somme(ds).equals(e.valeurBien)) c.ctrl('info', 'PLAN_INCOMPLET', 'La somme des dotations ne couvre pas toute la valeur du bien : reprise partielle.');
    c.tableau({
      titre: 'Reprise de la subvention',
      colonnes: [
        { cle: 'exercice', libelle: 'Exercice', unite: 'entier' },
        { cle: 'dotation', libelle: 'Dotation', unite: 'EUR' },
        { cle: 'quotePart', libelle: 'Quote-part (777)', unite: 'EUR' },
        { cle: 'solde', libelle: 'Solde au bilan (131 − 139)', unite: 'EUR' },
      ],
      lignes,
    });
    c.ecriture('Quote-part de l’exercice 1', [
      { compte: '139', intitule: 'Subventions d’investissement inscrites au résultat', debit: lignes[0].quotePart },
      { compte: '777', intitule: 'Quote-part des subventions virée au résultat', credit: lignes[0].quotePart },
    ]);
  },
});

// ───────────────────────────── Associations ─────────────────────────────

export const fondsDedies = formule({
  id: 'fonds-dedies',
  moteur: M,
  nom: 'Associations : fonds dédiés',
  categorie: 'Associations',
  description: 'Constate en fonds dédiés la part des ressources affectées (subventions, dons) non encore utilisée conformément à l’engagement, et reprend les fonds antérieurs utilisés.',
  expression: 'Dotation (689) = ressources affectées de l’exercice − emplois de l’exercice sur ces ressources ; reprise (789) = utilisation des fonds dédiés antérieurs',
  references: [{ texte: 'Règlement ANC n° 2018-06, art. 132-1 à 132-6 — fonds dédiés' }],
  champs: [
    montant('fondsAnterieurs', 'Fonds dédiés à l’ouverture', { defaut: '18000' }),
    montant('ressources', 'Ressources affectées reçues sur l’exercice', { defaut: '60000' }),
    montant('emplois', 'Emplois réalisés sur l’exercice au titre du projet', { defaut: '52000' }),
  ],
  exemples: [
    { titre: 'Projet sous-consommé', entrees: { fondsAnterieurs: '0' }, attendu: { dotation: '8000.00', reprise: '0.00', fondsCloture: '8000.00' } },
    { titre: 'Utilisation des fonds antérieurs', entrees: { emplois: '70000' }, attendu: { dotation: '0.00', reprise: '10000.00', fondsCloture: '8000.00' } },
  ],
  calculer(e, c) {
    const ecart = d(e.ressources).minus(e.emplois);
    const dot = c.calc('dotation', 'Dotation aux fonds dédiés (689)', `max(0 ; ${fr(e.ressources)} − ${fr(e.emplois)})`, positif(ecart));
    const rep = c.calc('reprise', 'Reprise des fonds dédiés antérieurs (789)', `min(${fr(e.fondsAnterieurs)} ; max(0 ; ${fr(e.emplois)} − ${fr(e.ressources)}))`, min(e.fondsAnterieurs, positif(ecart.neg())));
    c.calc('fondsCloture', 'Fonds dédiés à la clôture', 'ouverture + dotation − reprise', d(e.fondsAnterieurs).plus(dot).minus(rep), 'EUR', { principal: true });
    if (ecart.neg().greaterThan(e.fondsAnterieurs)) c.ctrl('info', 'AUTOFINANCEMENT', 'Les emplois excèdent les ressources affectées disponibles : complément financé sur fonds propres.');
    if (dot.greaterThan(0)) c.ecriture('Engagement à réaliser', [{ compte: '689', intitule: 'Reports en fonds dédiés', debit: dot }, { compte: '19', intitule: 'Fonds dédiés', credit: dot }]);
    if (rep.greaterThan(0)) c.ecriture('Utilisation des fonds dédiés', [{ compte: '19', intitule: 'Fonds dédiés', debit: rep }, { compte: '789', intitule: 'Utilisation des fonds dédiés', credit: rep }]);
  },
});

interface BaremeMecenat {
  entreprises: { taux: string; tauxAuDela: string; seuilTauxReduit: string; plafondFixe: string; plafondCa: string };
  particuliers: { taux: string; tauxAide: string; plafondAide: string; plafondRevenu: string };
}

bareme<BaremeMecenat>({
  code: 'sectoriels.mecenat',
  revision: 'sur-texte',
  moteur: M,
  libelle: 'Réductions d’impôt pour dons',
  versions: [
    {
      du: '2021-01-01',
      valeurs: {
        entreprises: { taux: '60', tauxAuDela: '40', seuilTauxReduit: '2000000', plafondFixe: '20000', plafondCa: '0.5' },
        particuliers: { taux: '66', tauxAide: '75', plafondAide: '1000', plafondRevenu: '20' },
      },
      source: 'CGI art. 238 bis (entreprises) et art. 200 (particuliers)',
      statut: 'officiel',
    },
  ],
});

export const reductionDons = formule({
  id: 'reduction-dons',
  moteur: M,
  nom: 'Associations : réduction d’impôt des donateurs',
  categorie: 'Associations',
  description: 'Réduction d’impôt du mécénat d’entreprise (60 %, 40 % au-delà de 2 M€, plafond 20 000 € ou 5 ‰ du CA) ou des dons des particuliers (66 % / 75 %, plafond 20 % du revenu imposable).',
  expression: 'Entreprise : 60 % × min(don ; 2 M€) + 40 % × excédent, dans la limite de max(20 000 € ; 5 ‰ CA) ; particulier : 75 % jusqu’à 1 000 € (aide aux personnes) + 66 % du reste, dans la limite de 20 % du revenu',
  references: [{ texte: 'CGI art. 238 bis — mécénat des entreprises' }, { texte: 'CGI art. 200 — dons des particuliers' }],
  baremes: ['sectoriels.mecenat'],
  champs: [
    dateOperation('Date du don', { defaut: '2024-11-30' }),
    choix('donateur', 'Donateur', [
      ['entreprise', 'Entreprise'],
      ['particulier', 'Particulier'],
    ]),
    montant('don', 'Montant du don', { defaut: '35000' }),
    montant('ca', 'CA HT de l’entreprise', { defaut: '9000000', visibleSi: { champ: 'donateur', valeurs: ['entreprise'] } }),
    booleen('aidePersonnes', 'Organisme d’aide aux personnes en difficulté', { visibleSi: { champ: 'donateur', valeurs: ['particulier'] } }),
    montant('revenuImposable', 'Revenu imposable du foyer', { defaut: '58000', visibleSi: { champ: 'donateur', valeurs: ['particulier'] } }),
  ],
  exemples: [
    { titre: 'Entreprise', entrees: {}, attendu: { reduction: '21000.00', report: '0.00' } },
    { titre: 'Particulier', entrees: { donateur: 'particulier', don: '1500', aidePersonnes: true }, attendu: { reduction: '1080.00' } },
  ],
  calculer(e, c) {
    const b = c.bareme<BaremeMecenat>('sectoriels.mecenat', e.dateOperation);
    const don: Decimal = e.don;
    if (e.donateur === 'entreprise') {
      const x = b.entreprises;
      const plafond = c.calc('plafond', 'Plafond des versements', `max(${fr(x.plafondFixe, 0)} ; 5 ‰ × ${fr(e.ca)})`, max(x.plafondFixe, d(e.ca).times(pct(x.plafondCa))));
      const retenu = min(don, plafond);
      const red = euros(min(retenu, x.seuilTauxReduit).times(pct(x.taux)).plus(positif(retenu.minus(x.seuilTauxReduit)).times(pct(x.tauxAuDela))));
      c.calc('reduction', 'Réduction d’impôt', `${x.taux} % × versements retenus (${fr(retenu)})`, red, 'EUR', { principal: true });
      c.calc('report', 'Excédent reportable sur 5 ans', `${fr(don)} − ${fr(plafond)}`, positif(don.minus(plafond)));
      c.calc('coutReel', 'Coût réel du don', `${fr(don)} − ${fr(red)}`, don.minus(red));
    } else {
      const x = b.particuliers;
      const p75 = e.aidePersonnes ? min(don, x.plafondAide) : ZERO;
      const reste = min(don.minus(p75), positif(d(e.revenuImposable).times(pct(x.plafondRevenu)).minus(p75)));
      const red = euros(p75.times(pct(x.tauxAide)).plus(reste.times(pct(x.taux))));
      c.calc('reduction', 'Réduction d’impôt', `${x.tauxAide} % × ${fr(p75)} + ${x.taux} % × ${fr(reste)}`, red, 'EUR', { principal: true });
      c.calc('coutReel', 'Coût réel du don', `${fr(don)} − ${fr(red)}`, don.minus(red));
    }
    c.ctrl('info', 'RECU', 'Délivrer un reçu fiscal (cerfa 11580 / 16216) ; l’association doit être d’intérêt général.');
  },
});

// ─────────────────────── Professions libérales ───────────────────────

export const bnc2035 = formule({
  id: 'bnc-2035',
  moteur: M,
  nom: 'Professions libérales : résultat BNC (2035)',
  categorie: 'Professions libérales',
  description: 'Détermine le bénéfice non commercial en comptabilité recettes-dépenses (déclaration contrôlée) et le compare au régime micro-BNC.',
  expression: 'Bénéfice = recettes encaissées − débours et rétrocessions − dépenses payées − dotations aux amortissements ± plus/moins-values',
  references: [{ texte: 'CGI art. 92 et 93 — bénéfices non commerciaux' }, { texte: 'Formulaire 2035-SD' }, { texte: 'CGI art. 102 ter — micro-BNC (abattement 34 %)' }],
  champs: [
    montant('recettes', 'Recettes encaissées (honoraires)', { defaut: '142000' }),
    montant('debours', 'Débours et honoraires rétrocédés', { defaut: '6000' }),
    montant('achats', 'Achats', { defaut: '3200' }),
    montant('personnel', 'Salaires et charges sociales du personnel', { defaut: '28000' }),
    montant('cotisationsPersonnelles', 'Cotisations sociales personnelles obligatoires', { defaut: '24500' }),
    montant('loyers', 'Loyers et charges locatives', { defaut: '14400' }),
    montant('deplacements', 'Frais de déplacement', { defaut: '4800' }),
    montant('autresDepenses', 'Autres dépenses', { defaut: '9100' }),
    montant('amortissements', 'Dotations aux amortissements', { defaut: '3500' }),
    montant('plusValues', 'Plus-values (+) ou moins-values (−) de cession', { defaut: '0' }),
  ],
  exemples: [{ titre: 'Cabinet libéral', entrees: {}, attendu: { benefice: '48500.00', microBnc: '93720.00' } }],
  calculer(e, c) {
    const rn = c.calc('recettesNettes', 'Recettes nettes', `${fr(e.recettes)} − ${fr(e.debours)}`, d(e.recettes).minus(e.debours));
    const dep = c.calc('depenses', 'Total des dépenses', 'Σ dépenses payées', somme([e.achats, e.personnel, e.cotisationsPersonnelles, e.loyers, e.deplacements, e.autresDepenses]));
    const ben = c.calc('benefice', 'Bénéfice (ligne CP)', `${fr(rn)} − ${fr(dep)} − ${fr(e.amortissements)} + ${fr(e.plusValues)}`, rn.minus(dep).minus(e.amortissements).plus(e.plusValues), 'EUR', { principal: true });
    const micro = c.calc('microBnc', 'Résultat imposable en micro-BNC', `${fr(e.recettes)} × (1 − 34 %)`, euros(d(e.recettes).times('0.66')));
    if (d(e.recettes).greaterThan(77700)) c.ctrl('info', 'SEUIL_MICRO', 'Recettes au-delà du seuil du micro-BNC : déclaration contrôlée obligatoire.');
    else c.ctrl('info', 'COMPARAISON', micro.lessThan(ben) ? 'Le micro-BNC serait plus favorable.' : 'La déclaration contrôlée est plus favorable.');
  },
});

interface BaremeMicro {
  seuilVente: string;
  seuilServices: string;
  abattements: { vente: string; services: string; bnc: string };
  abattementMinimum: string;
  cotisations: { vente: string; services: string; bnc: string };
  versementLiberatoire: { vente: string; services: string; bnc: string };
  cfp: { vente: string; services: string; bnc: string };
}

const MICRO_2024: BaremeMicro = {
  seuilVente: '188700',
  seuilServices: '77700',
  abattements: { vente: '71', services: '50', bnc: '34' },
  abattementMinimum: '305',
  cotisations: { vente: '12.3', services: '21.2', bnc: '21.1' },
  versementLiberatoire: { vente: '1', services: '1.7', bnc: '2.2' },
  cfp: { vente: '0.1', services: '0.3', bnc: '0.2' },
};

bareme<BaremeMicro>({
  code: 'sectoriels.micro',
  moteur: M,
  libelle: 'Micro-entreprise : seuils, abattements et cotisations',
  versions: [
    { du: '2024-01-01', valeurs: MICRO_2024, source: 'CGI art. 50-0 et 102 ter ; CSS art. L.613-7 ; décret n° 2023-1236', statut: 'officiel' },
    { du: '2024-07-01', valeurs: { ...MICRO_2024, cotisations: { ...MICRO_2024.cotisations, bnc: '23.1' } }, source: 'Décret n° 2024-484 — BNC non réglementées (SSI)', statut: 'a_verifier', note: 'taux BNC au 01/07/2024' },
    { du: '2025-01-01', valeurs: { ...MICRO_2024, cotisations: { ...MICRO_2024.cotisations, bnc: '24.6' } }, source: 'Décret n° 2024-484 — trajectoire 2025', statut: 'a_verifier', note: 'taux BNC 2025' },
    { du: '2026-01-01', valeurs: { ...MICRO_2024, cotisations: { ...MICRO_2024.cotisations, bnc: '26.1' } }, source: 'Décret n° 2024-484 — trajectoire 2026', statut: 'a_verifier', note: 'taux BNC 2026 et seuils de chiffre d’affaires' },
  ],
});

export const microEntreprise = formule({
  id: 'micro-entreprise',
  moteur: M,
  nom: 'Micro-entreprise : cotisations et revenu imposable',
  categorie: 'Professions libérales',
  description: 'Cotisations sociales, contribution à la formation, versement libératoire éventuel, abattement forfaitaire et revenu imposable ; contrôle du seuil de chiffre d’affaires.',
  expression: 'Cotisations = CA × taux ; revenu imposable = CA × (1 − abattement), abattement ≥ 305 € ; versement libératoire = CA × taux',
  references: [{ texte: 'CGI art. 50-0 (micro-BIC), 102 ter (micro-BNC), 151-0 (versement libératoire)' }, { texte: 'CSS art. L.613-7 — régime micro-social' }],
  baremes: ['sectoriels.micro'],
  champs: [
    dateOperation('Période (date)', { defaut: '2024-12-31' }),
    choix('activite', 'Activité', [
      ['vente', 'Vente de marchandises, hébergement'],
      ['services', 'Prestations de services commerciales ou artisanales (BIC)'],
      ['bnc', 'Professions libérales (BNC)'],
    ]),
    montant('ca', 'Chiffre d’affaires / recettes', { defaut: '52000' }),
    booleen('versementLiberatoire', 'Option pour le versement libératoire de l’IR'),
  ],
  exemples: [{ titre: 'Services BIC 2024', entrees: { activite: 'services' }, attendu: { cotisations: '11024.00', cfp: '156.00', revenuImposable: '26000.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeMicro>('sectoriels.micro', e.dateOperation);
    const a = e.activite as 'vente' | 'services' | 'bnc';
    const ca: Decimal = e.ca;
    const cot = c.calc('cotisations', 'Cotisations sociales', `${fr(ca)} × ${b.cotisations[a]} %`, euros(ca.times(pct(b.cotisations[a]))), 'EUR', { principal: true });
    const cfp = c.calc('cfp', 'Contribution à la formation professionnelle', `${fr(ca)} × ${b.cfp[a]} %`, euros(ca.times(pct(b.cfp[a]))));
    const ab = max(ca.times(pct(b.abattements[a])), b.abattementMinimum);
    c.calc('revenuImposable', 'Revenu imposable (régime micro)', `${fr(ca)} − abattement ${b.abattements[a]} %`, euros(positif(ca.minus(ab))));
    let vl = ZERO;
    if (e.versementLiberatoire) vl = c.calc('versementLiberatoire', 'Versement libératoire de l’IR', `${fr(ca)} × ${b.versementLiberatoire[a]} %`, euros(ca.times(pct(b.versementLiberatoire[a]))));
    c.calc('revenuNet', 'Revenu après prélèvements (avant charges réelles)', 'CA − cotisations − CFP − VL', ca.minus(cot).minus(cfp).minus(vl));
    const seuil = d(a === 'vente' ? b.seuilVente : b.seuilServices);
    c.verifier(ca.lessThanOrEqualTo(seuil), 'SEUIL', `CA inférieur au seuil du régime (${fe(seuil)}).`, `CA supérieur au seuil de ${fe(seuil)} : sortie du régime micro (à apprécier sur deux années consécutives).`, 'avertissement');
  },
});

// ───────────────────────── Banque et assurance ─────────────────────────

export const chainLadder = formule({
  id: 'chain-ladder',
  moteur: M,
  nom: 'Assurance : provisions pour sinistres (Chain Ladder)',
  categorie: 'Banque et assurance',
  description: 'Estime la charge ultime et la provision pour sinistres à payer à partir d’un triangle de règlements cumulés, par la méthode des cadences (Chain Ladder).',
  expression: 'f_j = Σ C(i, j+1) / Σ C(i, j) ; ultime_i = C(i, dernier) × Π f_j restants ; provision = Σ (ultime − payé)',
  references: [{ texte: 'Code des assurances art. R.343-7 — provisions techniques' }, { texte: 'Mack (1993) — méthode Chain Ladder' }],
  champs: [
    table('triangle', 'Triangle des règlements cumulés', [texte('survenance', 'Année de survenance'), liste('cumuls', 'Cumuls par année de développement (séparés par ;)')], {
      min: '2',
      defaut: [
        { survenance: '2020', cumuls: '3200;5100;5900;6150;6200' },
        { survenance: '2021', cumuls: '3500;5600;6450;6700' },
        { survenance: '2022', cumuls: '3900;6200;7150' },
        { survenance: '2023', cumuls: '4100;6600' },
        { survenance: '2024', cumuls: '4400' },
      ],
    }),
  ],
  exemples: [{ titre: 'Triangle 5 × 5', entrees: {}, attendu: { provision: '5905.97', facteur_1: '1.5986' } }],
  calculer(e, c) {
    type T = { survenance: string; cumuls: Decimal[] };
    const tr = e.triangle as T[];
    const n = Math.max(...tr.map((x) => x.cumuls.length));
    const f: Decimal[] = [];
    for (let j = 0; j < n - 1; j++) {
      const lignes = tr.filter((x) => x.cumuls.length > j + 1);
      const num = somme(lignes.map((x) => x.cumuls[j + 1]));
      const den = somme(lignes.map((x) => x.cumuls[j]));
      f.push(diviser(num, den, 1));
      c.res(`facteur_${j + 1}`, `Facteur de développement ${j + 1} → ${j + 2}`, f[j], 'nombre', { decimales: 4 });
    }
    let prov = ZERO;
    const lignes = tr.map((x) => {
      const dernier = x.cumuls[x.cumuls.length - 1];
      let ult = dernier;
      for (let j = x.cumuls.length - 1; j < n - 1; j++) ult = ult.times(f[j]);
      const p = euros(ult.minus(dernier));
      prov = prov.plus(p);
      return { survenance: x.survenance, paye: dernier.toFixed(2), ultime: euros(ult).toFixed(2), provision: p.toFixed(2) };
    });
    c.calc('provision', 'Provision pour sinistres à payer', 'Σ (ultime − payé)', prov, 'EUR', { principal: true });
    c.tableau({
      titre: 'Charge ultime par année de survenance',
      colonnes: [
        { cle: 'survenance', libelle: 'Survenance', unite: 'texte' },
        { cle: 'paye', libelle: 'Payé à date', unite: 'EUR' },
        { cle: 'ultime', libelle: 'Charge ultime', unite: 'EUR' },
        { cle: 'provision', libelle: 'Provision', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres-empilees', x: 'survenance', series: ['paye', 'provision'] },
    });
    c.ctrl('info', 'HYPOTHESE', 'Hypothèse de cadences stables entre années de survenance ; compléter par une marge de prudence et une analyse de l’incertitude (Mack, bootstrap).');
  },
});

export const ratiosPrudentiels = formule({
  id: 'ratios-prudentiels',
  moteur: M,
  nom: 'Banque : ratios de solvabilité et de levier (Bâle III)',
  categorie: 'Banque et assurance',
  description: 'Ratios CET1, Tier 1, solvabilité globale et levier rapportés aux exigences minimales (pilier 1 et coussin de conservation).',
  expression: 'CET1 = CET1 / RWA (≥ 4,5 % + 2,5 %) ; T1 = (CET1 + AT1) / RWA (≥ 6 % + 2,5 %) ; global = fonds propres / RWA (≥ 8 % + 2,5 %) ; levier = T1 / exposition (≥ 3 %)',
  references: [{ texte: 'Règlement (UE) n° 575/2013 (CRR), art. 92 et 429' }, { texte: 'Directive 2013/36/UE (CRD), art. 129 — coussin de conservation' }],
  champs: [
    montant('cet1', 'Fonds propres de base de catégorie 1 (CET1)', { defaut: '1250000000' }),
    montant('at1', 'Fonds propres additionnels de catégorie 1 (AT1)', { defaut: '200000000' }),
    montant('t2', 'Fonds propres de catégorie 2 (T2)', { defaut: '300000000' }),
    montant('rwa', 'Actifs pondérés par les risques (RWA)', { defaut: '9800000000' }),
    montant('exposition', 'Exposition totale (ratio de levier)', { defaut: '32000000000' }),
    taux('coussinsSupplementaires', 'Coussins contracyclique / systémique', { defaut: '1' }),
  ],
  exemples: [{ titre: 'Banque régionale', entrees: {}, attendu: { ratioCet1: '12.76', ratioT1: '14.80', ratioGlobal: '17.86', ratioLevier: '4.53' } }],
  calculer(e, c) {
    const cs = UN.div(40).plus(e.coussinsSupplementaires);
    const r1 = c.calc('ratioCet1', 'Ratio CET1', `${fr(e.cet1, 0)} / ${fr(e.rwa, 0)}`, d(e.cet1).div(e.rwa), '%', { principal: true });
    const rt1 = c.calc('ratioT1', 'Ratio Tier 1', '(CET1 + AT1) / RWA', d(e.cet1).plus(e.at1).div(e.rwa), '%');
    const rg = c.calc('ratioGlobal', 'Ratio de solvabilité global', '(CET1 + AT1 + T2) / RWA', somme([e.cet1, e.at1, e.t2]).div(e.rwa), '%');
    const rl = c.calc('ratioLevier', 'Ratio de levier', 'Tier 1 / exposition', d(e.cet1).plus(e.at1).div(e.exposition), '%');
    c.verifier(r1.greaterThanOrEqualTo(d('0.045').plus(cs)), 'CET1', `CET1 ≥ ${fp(d('0.045').plus(cs), 2)} (exigence + coussins).`, `CET1 inférieur à l’exigence combinée (${fp(d('0.045').plus(cs), 2)}) : restrictions de distribution.`);
    c.verifier(rt1.greaterThanOrEqualTo(d('0.06').plus(cs)), 'T1', `Tier 1 ≥ ${fp(d('0.06').plus(cs), 2)}.`, 'Tier 1 insuffisant.');
    c.verifier(rg.greaterThanOrEqualTo(d('0.08').plus(cs)), 'GLOBAL', `Solvabilité globale ≥ ${fp(d('0.08').plus(cs), 2)}.`, 'Ratio global insuffisant.');
    c.verifier(rl.greaterThanOrEqualTo('0.03'), 'LEVIER', 'Ratio de levier ≥ 3 %.', 'Ratio de levier inférieur à 3 %.');
    c.res('marge', 'Excédent de CET1 sur l’exigence combinée', euros(d(e.cet1).minus(d(e.rwa).times(d('0.045').plus(cs)))));
  },
});

export const formulesSectoriels = [
  avancementChantier,
  situationTravaux,
  compteProrata,
  vefa,
  promotionImmobiliere,
  remboursementForfaitaire,
  subventionInvestissement,
  fondsDedies,
  reductionDons,
  bnc2035,
  microEntreprise,
  chainLadder,
  ratiosPrudentiels,
];
