/**
 * MOTEUR 4 — Provisions et dépréciations : créances, stocks, titres, risques et
 * charges, garanties, retraites, gros entretien, tests de dépréciation,
 * provision pour hausse des prix, écarts de conversion.
 */
import {
  booleen,
  choix,
  Contexte,
  d,
  Decimal,
  entier,
  euros,
  fe,
  formule,
  fp,
  fr,
  frn,
  liste,
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

const M = 'provisions' as const;

/** Écriture de dotation ou de reprise selon le signe de la variation. */
function dotationOuReprise(c: Contexte, variation: Decimal, libelle: string, compteBilan: string, intituleBilan: string, dotation: string, reprise: string): void {
  if (variation.isZero()) return;
  if (variation.greaterThan(0))
    c.ecriture(`Dotation — ${libelle}`, [
      { compte: dotation, intitule: 'Dotation', debit: variation },
      { compte: compteBilan, intitule: intituleBilan, credit: variation },
    ]);
  else
    c.ecriture(`Reprise — ${libelle}`, [
      { compte: compteBilan, intitule: intituleBilan, debit: variation.neg() },
      { compte: reprise, intitule: 'Reprise', credit: variation.neg() },
    ]);
}

export const creanceDouteuse = formule({
  id: 'creance-douteuse',
  moteur: M,
  nom: 'Dépréciation d’une créance douteuse',
  categorie: 'Créances',
  description: 'Reclasse la créance en 416, calcule la dépréciation sur la base hors taxes selon le risque estimé et l’ajustement par rapport à la dépréciation existante.',
  expression: 'Base HT = créance TTC / (1 + t) ; dépréciation = base HT × % de perte probable ; variation = nouvelle − existante',
  references: [
    { texte: 'PCG art. 214-25 et 944-49 — dépréciation des créances (491)' },
    { texte: 'CGI art. 39-1-5° — déductibilité des provisions pour créances douteuses individualisées' },
    { texte: 'BOI-BIC-PROV-30-20-10' },
  ],
  champs: [
    montant('creanceTTC', 'Créance TTC', { defaut: '14400' }),
    taux('tauxTva', 'Taux de TVA de la facture', { defaut: '20' }),
    taux('risque', 'Perte probable estimée', { defaut: '40', min: '0', max: '100' }),
    montant('depreciationExistante', 'Dépréciation déjà constituée', { defaut: '0' }),
    booleen('dejaReclassee', 'Créance déjà en 416'),
  ],
  exemples: [
    { titre: 'Client en redressement', entrees: {}, attendu: { baseHT: '12000.00', depreciation: '4800.00', variation: '4800.00' } },
    { titre: 'Ajustement à la baisse', entrees: { risque: '25', depreciationExistante: '4800', dejaReclassee: true }, attendu: { depreciation: '3000.00', variation: '-1800.00' } },
  ],
  calculer(e, c) {
    const ht = c.calc('baseHT', 'Base hors taxes', `${fr(e.creanceTTC)} / (1 + ${fp(e.tauxTva)})`, euros(d(e.creanceTTC).div(UN.plus(e.tauxTva))));
    const dep = c.calc('depreciation', 'Dépréciation nécessaire', `${fr(ht)} × ${fp(e.risque)}`, euros(ht.times(e.risque)), 'EUR', { principal: true });
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(dep)} − ${fr(e.depreciationExistante)}`, dep.minus(e.depreciationExistante));
    if (!e.dejaReclassee)
      c.ecriture('Reclassement en créance douteuse', [
        { compte: '416', intitule: 'Clients douteux ou litigieux', debit: e.creanceTTC },
        { compte: '411', intitule: 'Clients', credit: e.creanceTTC },
      ]);
    dotationOuReprise(c, v, 'créance douteuse', '491', 'Dépréciation des comptes clients', '6817', '7817');
    c.ctrl('info', 'TVA', 'La TVA n’est récupérable qu’en cas de perte définitive (CGI art. 272-1) : elle est exclue de la base.');
  },
});

export const provisionStatistique = formule({
  id: 'provision-statistique',
  moteur: M,
  nom: 'Dépréciation statistique des créances',
  categorie: 'Créances',
  description: 'Applique des taux de perte par tranche d’ancienneté du poste clients (balance âgée). Méthode admise comptablement ; fiscalement, seules les dépréciations individualisées sont déductibles.',
  expression: 'Dépréciation = Σ (encours HT de la tranche × taux de perte historique)',
  references: [
    { texte: 'PCG art. 214-25 — dépréciation à hauteur de la perte probable' },
    { texte: 'CE 23/01/1985 n° 41226 et BOI-BIC-PROV-30-20-10 — provision globale non déductible sauf statistiques fiables' },
  ],
  champs: [
    table('tranches', 'Balance âgée (HT)', [texte('tranche', 'Tranche'), montant('encours', 'Encours HT'), taux('taux', 'Taux de perte')], {
      min: '1',
      defaut: [
        { tranche: 'Non échu', encours: '320000', taux: '0.5' },
        { tranche: '0-30 jours', encours: '85000', taux: '2' },
        { tranche: '31-90 jours', encours: '42000', taux: '10' },
        { tranche: '91-180 jours', encours: '18000', taux: '35' },
        { tranche: '> 180 jours', encours: '9500', taux: '80' },
      ],
    }),
    montant('depreciationExistante', 'Dépréciation existante', { defaut: '15000' }),
    booleen('fiscalementJustifiee', 'Statistiques historiques fiables et documentées'),
  ],
  exemples: [{ titre: 'Balance âgée', entrees: {}, attendu: { depreciation: '21400.00', variation: '6400.00', reintegration: '21400.00' } }],
  calculer(e, c) {
    type T = { tranche: string; encours: Decimal; taux: Decimal };
    const lignes = (e.tranches as T[]).map((t) => ({ tranche: t.tranche, encours: t.encours.toFixed(2), taux: t.taux.times(100).toFixed(2), depreciation: euros(t.encours.times(t.taux)).toFixed(2) }));
    const dep = c.calc('depreciation', 'Dépréciation statistique', 'Σ encours × taux', somme(lignes.map((l) => l.depreciation)), 'EUR', { principal: true });
    const total = somme((e.tranches as T[]).map((t) => t.encours));
    c.calc('tauxGlobal', 'Taux moyen de dépréciation', `${fr(dep)} / ${fr(total)}`, dep.div(total), '%');
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(dep)} − ${fr(e.depreciationExistante)}`, dep.minus(e.depreciationExistante));
    c.res('reintegration', 'Part non déductible fiscalement', e.fiscalementJustifiee ? 0 : dep);
    if (!e.fiscalementJustifiee) c.ctrl('avertissement', 'NON_DEDUCTIBLE', 'Dépréciation globale non individualisée : à réintégrer sur le 2058-A (ligne WI).');
    c.tableau({
      titre: 'Dépréciation par tranche',
      colonnes: [
        { cle: 'tranche', libelle: 'Tranche', unite: 'texte' },
        { cle: 'encours', libelle: 'Encours HT', unite: 'EUR' },
        { cle: 'taux', libelle: 'Taux', unite: '%' },
        { cle: 'depreciation', libelle: 'Dépréciation', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'tranche', series: ['encours', 'depreciation'] },
    });
    dotationOuReprise(c, v, 'dépréciation statistique', '491', 'Dépréciation des comptes clients', '6817', '7817');
  },
});

export const depreciationStocks = formule({
  id: 'depreciation-stocks',
  moteur: M,
  nom: 'Dépréciation des stocks',
  categorie: 'Stocks et titres',
  description: 'Compare pour chaque article le coût d’entrée à la valeur nette de réalisation et calcule la dépréciation, puis la dotation ou reprise par rapport à l’existant.',
  expression: 'Dépréciation = Σ quantité × max(0 ; coût unitaire − VNR unitaire)',
  references: [
    { texte: 'PCG art. 214-25 et 213-7 — évaluation à la clôture, valeur actuelle' },
    { texte: 'CGI art. 38-3 — stocks évalués au cours du jour s’il est inférieur' },
  ],
  champs: [
    table(
      'articles',
      'Articles',
      [texte('article', 'Article'), nombre('quantite', 'Quantité'), montant('cout', 'Coût unitaire'), montant('vnr', 'VNR unitaire')],
      {
        min: '1',
        defaut: [
          { article: 'Réf. A-102', quantite: '450', cout: '18.40', vnr: '21.00' },
          { article: 'Réf. B-210 (obsolète)', quantite: '120', cout: '64.00', vnr: '22.50' },
          { article: 'Réf. C-007', quantite: '800', cout: '7.25', vnr: '6.10' },
        ],
      },
    ),
    montant('depreciationExistante', 'Dépréciation existante (39x)', { defaut: '2500' }),
    choix('nature', 'Nature du stock', [
      ['marchandises', 'Marchandises (397)'],
      ['matieres', 'Matières premières (391)'],
      ['produits', 'Produits finis (395)'],
    ]),
  ],
  exemples: [{ titre: 'Trois articles', entrees: {}, attendu: { valeurStock: '21760.00', depreciation: '5900.00', variation: '3400.00' } }],
  calculer(e, c) {
    type A = { article: string; quantite: Decimal; cout: Decimal; vnr: Decimal };
    let valeur = ZERO;
    let dep = ZERO;
    const lignes = (e.articles as A[]).map((a) => {
      const v = euros(a.quantite.times(a.cout));
      const dp = euros(a.quantite.times(positif(a.cout.minus(a.vnr))));
      valeur = valeur.plus(v);
      dep = dep.plus(dp);
      return { article: a.article, valeur: v.toFixed(2), vnr: euros(a.quantite.times(a.vnr)).toFixed(2), depreciation: dp.toFixed(2) };
    });
    c.calc('valeurStock', 'Valeur brute du stock', 'Σ quantité × coût', valeur);
    c.calc('depreciation', 'Dépréciation nécessaire', 'Σ quantité × max(0 ; coût − VNR)', dep, 'EUR', { principal: true });
    c.calc('valeurNette', 'Valeur nette au bilan', `${fr(valeur)} − ${fr(dep)}`, valeur.minus(dep));
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(dep)} − ${fr(e.depreciationExistante)}`, dep.minus(e.depreciationExistante));
    const compte = { marchandises: '397', matieres: '391', produits: '395' }[e.nature as 'marchandises'];
    c.tableau({
      titre: 'Test de valeur par article',
      colonnes: [
        { cle: 'article', libelle: 'Article', unite: 'texte' },
        { cle: 'valeur', libelle: 'Coût', unite: 'EUR' },
        { cle: 'vnr', libelle: 'VNR', unite: 'EUR' },
        { cle: 'depreciation', libelle: 'Dépréciation', unite: 'EUR' },
      ],
      lignes,
    });
    dotationOuReprise(c, v, 'stocks', compte, 'Dépréciation des stocks', '6817', '7817');
  },
});

export const depreciationTitres = formule({
  id: 'depreciation-titres',
  moteur: M,
  nom: 'Dépréciation des titres',
  categorie: 'Stocks et titres',
  description: 'Compare le coût d’acquisition à la valeur d’inventaire (cours moyen du dernier mois pour les titres cotés, valeur d’utilité pour les participations) et calcule la dépréciation et son traitement fiscal.',
  expression: 'Dépréciation = nombre × max(0 ; coût unitaire − valeur d’inventaire unitaire)',
  references: [
    { texte: 'PCG art. 221-3 et 221-6 — valeur d’inventaire des titres' },
    { texte: 'CGI art. 39-1-5° al. 18 — dépréciation des titres de participation (régime LT, non déductible)' },
  ],
  champs: [
    choix('categorie', 'Catégorie', [
      ['participation', 'Titres de participation (296)'],
      ['tiap', 'TIAP / autres titres immobilisés (297)'],
      ['vmp', 'Valeurs mobilières de placement (590)'],
    ]),
    nombre('nombre', 'Nombre de titres', { defaut: '2000' }),
    montant('coutUnitaire', 'Coût d’acquisition unitaire', { defaut: '45.80' }),
    montant('valeurInventaire', 'Valeur d’inventaire unitaire', { defaut: '38.15' }),
    montant('depreciationExistante', 'Dépréciation existante', { defaut: '0' }),
  ],
  exemples: [{ titre: 'Participation dépréciée', entrees: {}, attendu: { depreciation: '15300.00', variation: '15300.00', deductible: '0.00' } }],
  calculer(e, c) {
    const dep = c.calc('depreciation', 'Dépréciation', `${frn(e.nombre)} × max(0 ; ${fr(e.coutUnitaire)} − ${fr(e.valeurInventaire)})`, euros(d(e.nombre).times(positif(d(e.coutUnitaire).minus(e.valeurInventaire)))), 'EUR', { principal: true });
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(dep)} − ${fr(e.depreciationExistante)}`, dep.minus(e.depreciationExistante));
    const part = e.categorie === 'participation';
    c.res('deductible', 'Part déductible du résultat fiscal', part ? 0 : positif(v));
    if (part) c.ctrl('info', 'REGIME_LT', 'Titres de participation : dépréciation relevant du secteur LT (taux 0 %), non déductible — à réintégrer.');
    if (dep.isZero()) c.ctrl('ok', 'PAS_DEPRECIATION', 'Valeur d’inventaire ≥ coût : pas de dépréciation (les plus-values latentes ne sont pas comptabilisées).');
    const comptes = { participation: ['296', '6866', '7866'], tiap: ['297', '6866', '7866'], vmp: ['590', '6866', '7866'] }[e.categorie as 'vmp'];
    dotationOuReprise(c, v, 'titres', comptes[0], 'Dépréciation des titres', comptes[1], comptes[2]);
  },
});

export const ajustementProvision = formule({
  id: 'ajustement-provision',
  moteur: M,
  nom: 'Ajustement, reprise partielle ou totale',
  categorie: 'Risques et charges',
  description: 'Compare la provision existante à la nouvelle estimation et distingue la reprise pour utilisation (charge survenue) de la reprise devenue sans objet.',
  expression: 'Variation = estimation − (existante − utilisation) ; reprise = existante − estimation',
  references: [{ texte: 'PCG art. 323-1 à 323-7 — passifs : évaluation à chaque clôture' }, { texte: 'PCG art. 946-68 / 947-78' }],
  champs: [
    montant('existante', 'Provision existante', { defaut: '50000' }),
    montant('utilisation', 'Charge effectivement supportée sur l’exercice', { defaut: '18000' }),
    montant('estimation', 'Nouvelle estimation du risque résiduel', { defaut: '20000' }),
    choix('nature', 'Nature', [
      ['exploitation', 'Exploitation (6815 / 7815)'],
      ['financiere', 'Financière (6865 / 7865)'],
      ['exceptionnelle', 'Exceptionnelle (6875 / 7875)'],
    ]),
  ],
  exemples: [{ titre: 'Litige partiellement dénoué', entrees: {}, attendu: { repriseUtilisee: '18000.00', repriseSansObjet: '12000.00', dotation: '0.00', provisionFinale: '20000.00' } }],
  calculer(e, c) {
    const ex: Decimal = e.existante;
    const util = Decimal.min(e.utilisation, ex);
    c.calc('repriseUtilisee', 'Reprise utilisée', `min(${fr(e.utilisation)} ; ${fr(ex)})`, util);
    const reste = ex.minus(util);
    const ecart = d(e.estimation).minus(reste);
    c.calc('repriseSansObjet', 'Reprise devenue sans objet', `max(0 ; ${fr(reste)} − ${fr(e.estimation)})`, positif(ecart.neg()));
    c.calc('dotation', 'Dotation complémentaire', `max(0 ; ${fr(e.estimation)} − ${fr(reste)})`, positif(ecart));
    c.calc('provisionFinale', 'Provision à la clôture', 'nouvelle estimation', d(e.estimation), 'EUR', { principal: true });
    const [dot, rep] = { exploitation: ['6815', '7815'], financiere: ['6865', '7865'], exceptionnelle: ['6875', '7875'] }[e.nature as 'exploitation'];
    if (!util.isZero())
      c.ecriture('Reprise pour utilisation', [
        { compte: '151', intitule: 'Provisions pour risques', debit: util },
        { compte: rep, intitule: 'Reprise sur provisions', credit: util },
      ]);
    dotationOuReprise(c, ecart, 'ajustement', '151', 'Provisions pour risques', dot, rep);
    c.ctrl('info', 'ANNEXE', 'Les reprises sans objet et utilisées sont à distinguer dans l’annexe (tableau des provisions).');
  },
});

const NATURES_RISQUE: Record<string, { libelle: string; compte: string; ref: string; deductible: boolean }> = {
  litige: { libelle: 'Litige', compte: '1511', ref: 'PCG art. 322-1 — obligation à l’égard d’un tiers', deductible: true },
  garantie: { libelle: 'Garanties données aux clients', compte: '1512', ref: 'PCG art. 322-1', deductible: true },
  restructuration: { libelle: 'Restructuration', compte: '1588', ref: 'PCG art. 322-11 — plan détaillé annoncé avant la clôture', deductible: false },
  amendes: { libelle: 'Amendes et pénalités', compte: '1516', ref: 'CGI art. 39-2 — non déductibles', deductible: false },
  autre: { libelle: 'Autres risques', compte: '1518', ref: 'PCG art. 322-1', deductible: true },
};

export const provisionRisques = formule({
  id: 'provision-risques',
  moteur: M,
  nom: 'Provision pour risques et charges',
  categorie: 'Risques et charges',
  description: 'Évalue la provision à partir de scénarios probabilisés (meilleure estimation et espérance), avec actualisation optionnelle pour une sortie de ressources lointaine.',
  expression: 'Espérance = Σ montant × probabilité ; meilleure estimation = scénario le plus probable ; VA = montant / (1 + r)^n',
  references: [
    { texte: 'PCG art. 321-1 à 323-12 — définition, comptabilisation et évaluation des passifs' },
    { texte: 'CGI art. 39-1-5° — conditions de déductibilité' },
  ],
  champs: [
    choix('nature', 'Nature', Object.entries(NATURES_RISQUE).map(([k, v]) => [k, v.libelle] as [string, string])),
    table('scenarios', 'Scénarios', [texte('scenario', 'Scénario'), montant('montant', 'Sortie de ressources'), taux('probabilite', 'Probabilité', { min: '0', max: '100' })], {
      min: '1',
      defaut: [
        { scenario: 'Rejet de la demande', montant: '0', probabilite: '20' },
        { scenario: 'Transaction', montant: '45000', probabilite: '55' },
        { scenario: 'Condamnation totale', montant: '120000', probabilite: '25' },
      ],
    }),
    choix('methode', 'Montant retenu', [
      ['plus-probable', 'Scénario le plus probable (obligation unique)'],
      ['esperance', 'Espérance mathématique (population d’obligations)'],
    ]),
    taux('tauxActualisation', 'Taux d’actualisation', { defaut: '0', min: '0' }),
    nombre('horizon', 'Échéance attendue (années)', { defaut: '0', min: '0' }),
    montant('existante', 'Provision existante', { defaut: '0' }),
  ],
  exemples: [
    { titre: 'Litige prud’homal', entrees: {}, attendu: { esperance: '54750.00', retenu: '45000.00', provision: '45000.00' } },
    { titre: 'Espérance actualisée', entrees: { methode: 'esperance', tauxActualisation: '3', horizon: '2' }, attendu: { provision: '51607.13' } },
  ],
  calculer(e, c) {
    type S = { scenario: string; montant: Decimal; probabilite: Decimal };
    const sc = e.scenarios as S[];
    const sp = somme(sc.map((s) => s.probabilite));
    if (!sp.equals(1)) c.ctrl('avertissement', 'PROBABILITES', `La somme des probabilités vaut ${fp(sp)} (attendu : 100 %).`);
    const esp = c.calc('esperance', 'Espérance', 'Σ montant × probabilité', euros(somme(sc.map((s) => s.montant.times(s.probabilite)))));
    const probable = sc.reduce((a, b) => (b.probabilite.greaterThan(a.probabilite) ? b : a));
    const retenu = c.calc('retenu', 'Montant retenu', e.methode === 'esperance' ? 'espérance' : `scénario « ${probable.scenario} »`, e.methode === 'esperance' ? esp : probable.montant);
    const r: Decimal = e.tauxActualisation;
    const prov = c.calc('provision', 'Provision', r.isZero() ? 'montant retenu' : `${fr(retenu)} / (1 + ${fp(r)})^${frn(e.horizon)}`, euros(retenu.div(UN.plus(r).pow(e.horizon))), 'EUR', { principal: true });
    const n = NATURES_RISQUE[e.nature as string];
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(prov)} − ${fr(e.existante)}`, prov.minus(e.existante));
    c.res('deductible', 'Fiscalement déductible', n.deductible, 'booleen');
    if (!n.deductible) c.ctrl('avertissement', 'NON_DEDUCTIBLE', `Provision « ${n.libelle} » non déductible : réintégration extra-comptable.`);
    if (probable.probabilite.lessThan('0.5') && e.methode === 'plus-probable') c.ctrl('info', 'PROBABLE', 'Aucun scénario n’excède 50 % : vérifier que la sortie de ressources est « probable » (PCG 322-1).');
    dotationOuReprise(c, v, n.libelle, n.compte, `Provision — ${n.libelle}`, e.nature === 'restructuration' ? '6875' : '6815', e.nature === 'restructuration' ? '7875' : '7815');
  },
});

export const provisionGarantie = formule({
  id: 'provision-garantie',
  moteur: M,
  nom: 'Provision pour garantie clients',
  categorie: 'Risques et charges',
  description: 'Estime le coût futur des garanties sur les ventes à partir du taux de retour historique, du coût moyen de prise en charge et de la durée de garantie restant à courir.',
  expression: 'Provision = CA garanti × taux de retour × coût moyen / prix moyen × durée restante / durée totale',
  references: [{ texte: 'PCG art. 322-1 — garanties données aux clients (1512)' }, { texte: 'BOI-BIC-PROV-30-20-20' }],
  champs: [
    montant('caGaranti', 'Ventes sous garantie (CA HT)', { defaut: '2400000' }),
    taux('tauxRetour', 'Taux de retour historique', { defaut: '3.5' }),
    taux('coutRelatif', 'Coût de prise en charge en % du prix', { defaut: '40' }),
    nombre('dureeTotale', 'Durée de garantie (mois)', { defaut: '24' }),
    nombre('dureeRestante', 'Durée moyenne restant à courir (mois)', { defaut: '14' }),
    montant('existante', 'Provision existante', { defaut: '15000' }),
  ],
  exemples: [{ titre: 'Électroménager', entrees: {}, attendu: { provision: '19600.00', variation: '4600.00' } }],
  calculer(e, c) {
    const cout = c.calc('coutAttendu', 'Coût total attendu', `${fr(e.caGaranti)} × ${fp(e.tauxRetour)} × ${fp(e.coutRelatif)}`, d(e.caGaranti).times(e.tauxRetour).times(e.coutRelatif));
    const prov = c.calc('provision', 'Provision', `${fr(cout)} × ${frn(e.dureeRestante)} / ${frn(e.dureeTotale)}`, euros(cout.times(e.dureeRestante).div(e.dureeTotale)), 'EUR', { principal: true });
    const v = c.calc('variation', 'Dotation (+) / reprise (−)', `${fr(prov)} − ${fr(e.existante)}`, prov.minus(e.existante));
    dotationOuReprise(c, v, 'garanties', '1512', 'Provisions pour garanties', '6815', '7815');
  },
});

/** Indemnité légale en mois de salaire selon l'ancienneté (en années). */
export function moisIndemniteLegale(anciennete: Decimal): Decimal {
  const dix = Decimal.min(anciennete, 10);
  const audela = positif(anciennete.minus(10));
  return dix.div(4).plus(audela.div(3));
}

/** Indemnité de départ volontaire à la retraite (C. trav. D.1237-1), en mois. */
export function moisDepartVolontaire(anciennete: Decimal): Decimal {
  if (anciennete.greaterThanOrEqualTo(30)) return d(2);
  if (anciennete.greaterThanOrEqualTo(20)) return d('1.5');
  if (anciennete.greaterThanOrEqualTo(15)) return d(1);
  if (anciennete.greaterThanOrEqualTo(10)) return d('0.5');
  return ZERO;
}

export const indemnitesRetraite = formule({
  id: 'indemnites-retraite',
  moteur: M,
  nom: 'Engagement d’indemnités de fin de carrière',
  categorie: 'Retraites',
  description:
    'Évalue l’engagement de retraite d’un salarié par la méthode des unités de crédit projetées : droits à la date de départ, revalorisation, probabilité de présence (rotation, survie), actualisation, charges sociales et prorata des droits acquis.',
  expression: 'Engagement = M × (1 + g)^T × droits(A + T) × A / (A + T) × (1 − rotation)^T × survie × (1 + r)^−T × (1 + charges)',
  references: [
    { texte: 'Recommandation ANC 2013-02 (révisée 2021) — évaluation des engagements de retraite' },
    { texte: 'PCG art. 324-1 — méthode préférentielle de comptabilisation' },
    { texte: 'IAS 19 — avantages du personnel (méthode des unités de crédit projetées)' },
    { texte: 'Code du travail art. D.1237-1 (départ volontaire) et R.1234-2 (mise à la retraite)' },
  ],
  champs: [
    montant('salaireMensuel', 'Salaire mensuel brut de référence', { defaut: '3500' }),
    nombre('anciennete', 'Ancienneté actuelle (années)', { defaut: '12' }),
    entier('age', 'Âge actuel', { defaut: 45, min: '16', max: '75' }),
    entier('ageDepart', 'Âge de départ prévu', { defaut: 64, min: '55', max: '75' }),
    choix('modeDepart', 'Modalité de départ', [
      ['volontaire', 'Départ volontaire (D.1237-1)'],
      ['mise-retraite', 'Mise à la retraite (indemnité de licenciement)'],
      ['conventionnel', 'Barème conventionnel (mois saisis)'],
    ]),
    nombre('moisConventionnels', 'Mois d’indemnité conventionnelle au départ', { defaut: '3', visibleSi: { champ: 'modeDepart', valeurs: ['conventionnel'] } }),
    taux('revalorisation', 'Revalorisation annuelle des salaires', { defaut: '2' }),
    taux('rotation', 'Taux de rotation annuel', { defaut: '3' }),
    taux('survie', 'Probabilité de survie jusqu’au départ', { defaut: '92' }),
    taux('actualisation', 'Taux d’actualisation', { defaut: '3.5', aide: 'Taux des obligations d’entreprises de première catégorie (iBoxx € Corporates AA 10+).' }),
    taux('charges', 'Taux de charges sociales patronales', { defaut: '45' }),
  ],
  exemples: [{ titre: 'Cadre de 45 ans', entrees: {}, attendu: { moisDroits: '2', anneesRestantes: '19', engagement: '1535.58' } }],
  calculer(e, c) {
    const T = e.ageDepart - e.age;
    if (T < 0) {
      c.ctrl('erreur', 'AGE', 'L’âge de départ est inférieur à l’âge actuel.');
      return;
    }
    c.res('anneesRestantes', 'Années jusqu’au départ', T, 'annees', { decimales: 0 });
    const A: Decimal = e.anciennete;
    const AF = c.etape('Ancienneté au départ', `${frn(A)} + ${T}`, A.plus(T), 'annees');
    const mois =
      e.modeDepart === 'volontaire' ? moisDepartVolontaire(AF) : e.modeDepart === 'mise-retraite' ? moisIndemniteLegale(AF) : d(e.moisConventionnels);
    c.calc('moisDroits', 'Droits au départ (mois de salaire)', `barème ${e.modeDepart} pour ${frn(AF)} ans`, mois, 'nombre');
    const salProj = c.etape('Salaire projeté au départ', `${fr(e.salaireMensuel)} × (1 + ${fp(e.revalorisation)})^${T}`, d(e.salaireMensuel).times(UN.plus(e.revalorisation).pow(T)), 'EUR');
    const indem = c.calc('indemniteProjetee', 'Indemnité projetée au départ', `${fr(salProj)} × ${frn(mois)}`, euros(salProj.times(mois)));
    const prorata = AF.isZero() ? UN : A.div(AF);
    c.etape('Prorata des droits acquis', `${frn(A)} / ${frn(AF)}`, prorata, '%');
    const presence = c.etape('Probabilité de présence', `(1 − ${fp(e.rotation)})^${T} × ${fp(e.survie)}`, UN.minus(e.rotation).pow(T).times(e.survie), '%');
    const actu = c.etape('Facteur d’actualisation', `(1 + ${fp(e.actualisation)})^−${T}`, UN.plus(e.actualisation).pow(-T), 'nombre');
    const brut = indem.times(prorata).times(presence).times(actu);
    c.calc('engagementHorsCharges', 'Engagement hors charges sociales', 'indemnité × prorata × présence × actualisation', euros(brut));
    c.calc('engagement', 'Engagement total (DBO)', `× (1 + ${fp(e.charges)})`, euros(brut.times(UN.plus(e.charges))), 'EUR', { principal: true });
    c.ctrl('info', 'TABLES', 'Calcul individuel simplifié : pour une population, appliquer les tables de mortalité INSEE et une rotation par âge.');
  },
});

export const grosEntretien = formule({
  id: 'gros-entretien',
  moteur: M,
  nom: 'Provision pour gros entretien',
  categorie: 'Risques et charges',
  description: 'Répartit le coût d’un programme pluriannuel de gros entretien ou de grandes révisions sur la période qui précède l’intervention.',
  expression: 'Dotation annuelle = (coût estimé − provision constituée) / années restantes',
  references: [
    { texte: 'PCG art. 214-10 et 322-3 — provisions pour gros entretien ou grandes révisions' },
    { texte: 'CGI art. 39-1-5° — dépenses précisément évaluées et programmées' },
  ],
  champs: [
    montant('coutEstime', 'Coût estimé de l’intervention', { defaut: '96000' }),
    entier('dureeProgramme', 'Durée totale du programme (années)', { defaut: 8, min: '1', max: '50' }),
    entier('anneesEcoulees', 'Années déjà provisionnées', { defaut: 3, min: '0', max: '50' }),
    montant('provisionConstituee', 'Provision déjà constituée', { defaut: '36000' }),
  ],
  exemples: [{ titre: 'Ravalement à 8 ans', entrees: {}, attendu: { dotation: '12000.00', provisionCible: '48000.00' } }],
  calculer(e, c) {
    const restantes = e.dureeProgramme - e.anneesEcoulees;
    if (restantes <= 0) {
      c.ctrl('info', 'ECHU', 'Programme arrivé à échéance : la dépense est réalisée, reprendre la provision.');
      return;
    }
    const dot = c.calc('dotation', 'Dotation de l’exercice', `(${fr(e.coutEstime)} − ${fr(e.provisionConstituee)}) / ${restantes}`, euros(d(e.coutEstime).minus(e.provisionConstituee).div(restantes)), 'EUR', { principal: true });
    c.calc('provisionCible', 'Provision à la clôture', `${fr(e.provisionConstituee)} + ${fr(dot)}`, d(e.provisionConstituee).plus(dot));
    dotationOuReprise(c, dot, 'gros entretien', '1572', 'Provisions pour gros entretien', '6815', '7815');
  },
});

export const testDepreciation = formule({
  id: 'test-depreciation',
  moteur: M,
  nom: 'Test de dépréciation (valeur recouvrable)',
  categorie: 'Dépréciation d’actifs',
  description:
    'Détermine la valeur d’utilité par actualisation des flux futurs (avec valeur terminale de Gordon-Shapiro), la valeur recouvrable = max(valeur vénale nette, valeur d’utilité) et la dépréciation à constater.',
  expression: 'VU = Σ CFt / (1 + r)^t + [CFn × (1 + g) / (r − g)] / (1 + r)^n ; dépréciation = max(0 ; VNC − max(JV − coûts de sortie ; VU))',
  references: [
    { texte: 'PCG art. 214-15 à 214-19 — dépréciation des actifs' },
    { texte: 'IAS 36 — dépréciation d’actifs (UGT, valeur recouvrable)' },
  ],
  champs: [
    montant('vnc', 'Valeur nette comptable de l’actif / UGT', { defaut: '2500000' }),
    montant('valeurVenaleNette', 'Juste valeur diminuée des coûts de sortie', { defaut: '1900000' }),
    liste('flux', 'Flux de trésorerie futurs (années 1 à n)', { min: '1', defaut: ['320000', '340000', '355000', '360000', '370000'] }),
    taux('taux', 'Taux d’actualisation (CMPC avant impôt)', { defaut: '9.5' }),
    booleen('valeurTerminale', 'Inclure une valeur terminale', { defaut: true }),
    taux('croissance', 'Croissance à l’infini', { defaut: '1.5', visibleSi: { champ: 'valeurTerminale', valeurs: [true] } }),
  ],
  exemples: [{ titre: 'UGT industrielle', entrees: {}, attendu: { valeurUtilite: '4313626.14', depreciation: '0.00' } }],
  calculer(e, c) {
    const r: Decimal = e.taux;
    const f = e.flux as Decimal[];
    let va = ZERO;
    f.forEach((cf, i) => (va = va.plus(cf.div(UN.plus(r).pow(i + 1)))));
    c.etape('Valeur actuelle des flux explicites', 'Σ CFt / (1 + r)^t', va, 'EUR');
    let vt = ZERO;
    if (e.valeurTerminale) {
      const g: Decimal = e.croissance;
      if (g.greaterThanOrEqualTo(r)) {
        c.ctrl('erreur', 'CROISSANCE', 'Le taux de croissance doit être inférieur au taux d’actualisation.');
        return;
      }
      vt = f[f.length - 1].times(UN.plus(g)).div(r.minus(g)).div(UN.plus(r).pow(f.length));
      c.etape('Valeur terminale actualisée', `CFn × (1 + ${fp(g)}) / (${fp(r)} − ${fp(g)}) / (1 + r)^${f.length}`, vt, 'EUR');
    }
    const vu = c.calc('valeurUtilite', 'Valeur d’utilité', 'flux actualisés + valeur terminale', euros(va.plus(vt)));
    const rec = c.calc('valeurRecouvrable', 'Valeur recouvrable', `max(${fr(e.valeurVenaleNette)} ; ${fr(vu)})`, Decimal.max(vu, e.valeurVenaleNette));
    const dep = c.calc('depreciation', 'Dépréciation à constater', `max(0 ; ${fr(e.vnc)} − ${fr(rec)})`, positif(d(e.vnc).minus(rec)), 'EUR', { principal: true });
    if (vt.greaterThan(va.plus(vt).times('0.7'))) c.ctrl('avertissement', 'VT_PREPONDERANTE', `La valeur terminale représente ${fp(vt.div(va.plus(vt)), 1)} de la valeur d’utilité : sensibilité élevée aux hypothèses.`);
    c.res('marge', 'Marge de sécurité (recouvrable − VNC)', rec.minus(e.vnc));
    if (dep.greaterThan(0))
      c.ecriture('Dépréciation de l’actif', [
        { compte: '6816', intitule: 'Dotations aux dépréciations des immobilisations', debit: dep },
        { compte: '291', intitule: 'Dépréciation des immobilisations', credit: dep },
      ]);
  },
});

export const hausseDesPrix = formule({
  id: 'provision-hausse-prix',
  moteur: M,
  nom: 'Provision pour hausse des prix',
  categorie: 'Provisions réglementées',
  description: 'Provision réglementée lorsque le prix unitaire d’une matière ou d’un produit augmente de plus de 10 % sur une période de deux exercices au plus.',
  expression: 'Provision = quantité × (prix fin − prix début) − 10 % × quantité × prix début, si hausse > 10 %',
  references: [{ texte: 'CGI art. 39-1-5° al. 11 — provision pour hausse des prix' }, { texte: 'BOI-BIC-PROV-60-100' }],
  champs: [
    nombre('quantite', 'Quantité en stock à la clôture', { defaut: '12000' }),
    montant('prixDebut', 'Prix unitaire en début de période (≤ 2 exercices)', { defaut: '4.20' }),
    montant('prixFin', 'Prix unitaire à la clôture', { defaut: '5.10' }),
  ],
  exemples: [{ titre: 'Hausse de 21 %', entrees: {}, attendu: { hausse: '21.43', provision: '5760.00' } }],
  calculer(e, c) {
    const pd: Decimal = e.prixDebut;
    const h = c.calc('hausse', 'Hausse du prix', `(${fr(e.prixFin)} − ${fr(pd)}) / ${fr(pd)}`, d(e.prixFin).minus(pd).div(pd), '%');
    if (h.lessThanOrEqualTo('0.1')) {
      c.res('provision', 'Provision', 0, 'EUR', { principal: true });
      c.ctrl('info', 'SOUS_SEUIL', 'Hausse ≤ 10 % : aucune provision.');
      return;
    }
    const q: Decimal = e.quantite;
    const p = c.calc('provision', 'Provision pour hausse des prix', `${frn(q)} × (${fr(e.prixFin)} − ${fr(pd)}) − 10 % × ${frn(q)} × ${fr(pd)}`, euros(q.times(d(e.prixFin).minus(pd)).minus(q.times(pd).times('0.1'))), 'EUR', { principal: true });
    c.ecriture('Dotation provision pour hausse des prix', [
      { compte: '68725', intitule: 'Dotations aux provisions réglementées', debit: p },
      { compte: '1431', intitule: 'Provision pour hausse des prix', credit: p },
    ]);
    c.ctrl('info', 'REPRISE_6ANS', 'Reprise obligatoire au plus tard à la fin du 6e exercice suivant la dotation.');
  },
});

export const ecartsConversion = formule({
  id: 'ecarts-conversion',
  moteur: M,
  nom: 'Écarts de conversion et provision pour perte de change',
  categorie: 'Change',
  description: 'Réévalue à la clôture les créances et dettes en devises, constate les écarts de conversion actif (476) et passif (477) et la provision pour perte de change, avec option de position globale de change.',
  expression: 'Écart = montant devise × (cours clôture − cours historique) ; perte latente → 476 + provision 1515 ; gain latent → 477',
  references: [
    { texte: 'PCG art. 420-5 à 420-7 — conversion des opérations en devises à la clôture' },
    { texte: 'PCG art. 420-8 — position globale de change' },
    { texte: 'CGI art. 38-4 — écarts de conversion fiscalement imposables/déductibles' },
  ],
  champs: [
    table(
      'elements',
      'Créances et dettes en devises',
      [
        texte('libelle', 'Libellé'),
        choix('nature', 'Nature', [
          ['creance', 'Créance'],
          ['dette', 'Dette'],
        ]),
        montant('montantDevise', 'Montant en devise', { unite: '' }),
        nombre('coursHistorique', 'Cours historique (1 devise = … €)'),
        nombre('coursCloture', 'Cours de clôture'),
      ],
      {
        min: '1',
        defaut: [
          { libelle: 'Client US', nature: 'creance', montantDevise: '50000', coursHistorique: '0.93', coursCloture: '0.90' },
          { libelle: 'Fournisseur UK', nature: 'dette', montantDevise: '20000', coursHistorique: '1.16', coursCloture: '1.19' },
          { libelle: 'Client CH', nature: 'creance', montantDevise: '30000', coursHistorique: '1.02', coursCloture: '1.05' },
        ],
      },
    ),
    booleen('positionGlobale', 'Position globale de change (même devise / échéances voisines)'),
  ],
  exemples: [{ titre: 'Portefeuille trois devises', entrees: {}, attendu: { eca: '2100.00', ecp: '900.00', provision: '2100.00' } }],
  calculer(e, c) {
    type El = { libelle: string; nature: string; montantDevise: Decimal; coursHistorique: Decimal; coursCloture: Decimal };
    let eca = ZERO;
    let ecp = ZERO;
    const lignes = (e.elements as El[]).map((x) => {
      const vh = euros(x.montantDevise.times(x.coursHistorique));
      const vc = euros(x.montantDevise.times(x.coursCloture));
      // Créance : baisse du cours = perte latente ; dette : hausse du cours = perte latente.
      const perte = x.nature === 'creance' ? vh.minus(vc) : vc.minus(vh);
      if (perte.greaterThan(0)) eca = eca.plus(perte);
      else ecp = ecp.plus(perte.neg());
      return { libelle: x.libelle, historique: vh.toFixed(2), cloture: vc.toFixed(2), eca: positif(perte).toFixed(2), ecp: positif(perte.neg()).toFixed(2) };
    });
    c.calc('eca', 'Écarts de conversion actif (pertes latentes)', 'Σ pertes latentes', eca);
    c.calc('ecp', 'Écarts de conversion passif (gains latents)', 'Σ gains latents', ecp);
    const prov = c.calc('provision', 'Provision pour perte de change', e.positionGlobale ? 'max(0 ; ECA − ECP)' : 'ECA', e.positionGlobale ? positif(eca.minus(ecp)) : eca, 'EUR', { principal: true });
    c.tableau({
      titre: 'Réévaluation à la clôture',
      colonnes: [
        { cle: 'libelle', libelle: 'Élément', unite: 'texte' },
        { cle: 'historique', libelle: 'Valeur historique', unite: 'EUR' },
        { cle: 'cloture', libelle: 'Valeur clôture', unite: 'EUR' },
        { cle: 'eca', libelle: 'ECA (476)', unite: 'EUR' },
        { cle: 'ecp', libelle: 'ECP (477)', unite: 'EUR' },
      ],
      lignes,
    });
    if (prov.greaterThan(0))
      c.ecriture('Provision pour perte de change', [
        { compte: '6865', intitule: 'Dotations aux provisions financières', debit: prov },
        { compte: '1515', intitule: 'Provisions pour pertes de change', credit: prov },
      ]);
    c.ctrl('info', 'EXTOURNE', 'Les écarts de conversion (476/477) sont extournés à l’ouverture ; gains latents non comptabilisés en résultat mais imposables (CGI 38-4).');
  },
});

export const formulesProvisions = [
  creanceDouteuse,
  provisionStatistique,
  depreciationStocks,
  depreciationTitres,
  ajustementProvision,
  provisionRisques,
  provisionGarantie,
  indemnitesRetraite,
  grosEntretien,
  testDepreciation,
  hausseDesPrix,
  ecartsConversion,
];

