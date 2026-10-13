/**
 * MOTEUR 11 — Stocks et approvisionnements : valorisation (CMP permanent,
 * CMP périodique, FIFO, LIFO), valeur nette de réalisation, quantité économique
 * (Wilson), stock de sécurité et point de commande, rotation et couverture,
 * écarts d'inventaire, variation des stocks.
 */
import {
  choix,
  comparer,
  d,
  date,
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
  arrondi,
} from '../noyau';

const M = 'stocks' as const;

type Methode = 'cmp' | 'cmp-periodique' | 'fifo' | 'lifo';

interface Mouvement {
  date: string;
  libelle?: string;
  type: 'entree' | 'sortie';
  quantite: Decimal;
  prixUnitaire?: Decimal;
}

type LigneFiche = Record<string, string> & {
  date: string;
  libelle: string;
  qEntree: string;
  vEntree: string;
  qSortie: string;
  vSortie: string;
  qStock: string;
  vStock: string;
  cu: string;
};

interface ResultatValorisation {
  fiche: LigneFiche[];
  coutSorties: Decimal;
  stockFinalQ: Decimal;
  stockFinalV: Decimal;
  ruptures: string[];
}

/** Valorisation d'une fiche de stock — fonction pure. */
export function valoriser(methode: Methode, qInitiale: Decimal, vInitiale: Decimal, mvts: Mouvement[]): ResultatValorisation {
  const fiche: LigneFiche[] = [];
  const ruptures: string[] = [];
  let lots: { q: Decimal; pu: Decimal }[] = qInitiale.greaterThan(0) ? [{ q: qInitiale, pu: vInitiale.div(qInitiale) }] : [];
  let q = qInitiale;
  let v = vInitiale;
  let coutSorties = ZERO;
  let cmpPeriode: Decimal | null = null;
  if (methode === 'cmp-periodique') {
    const qe = somme(mvts.filter((m) => m.type === 'entree').map((m) => m.quantite));
    const ve = somme(mvts.filter((m) => m.type === 'entree').map((m) => m.quantite.times(m.prixUnitaire ?? 0)));
    cmpPeriode = diviser(vInitiale.plus(ve), qInitiale.plus(qe));
  }
  const ligne = (m: Mouvement, qe: Decimal | null, ve: Decimal | null, qs: Decimal | null, vs: Decimal | null) =>
    fiche.push({
      date: m.date,
      libelle: m.libelle ?? (m.type === 'entree' ? 'Entrée' : 'Sortie'),
      qEntree: qe ? qe.toFixed() : '',
      vEntree: ve ? ve.toFixed(2) : '',
      qSortie: qs ? qs.toFixed() : '',
      vSortie: vs ? vs.toFixed(2) : '',
      qStock: q.toFixed(),
      vStock: euros(v).toFixed(2),
      cu: q.isZero() ? '' : v.div(q).toDecimalPlaces(4).toFixed(),
    });
  for (const m of mvts) {
    if (m.type === 'entree') {
      const pu = m.prixUnitaire ?? ZERO;
      const ve = euros(m.quantite.times(pu));
      q = q.plus(m.quantite);
      v = v.plus(ve);
      lots.push({ q: m.quantite, pu });
      ligne(m, m.quantite, ve, null, null);
      continue;
    }
    let qs = m.quantite;
    if (qs.greaterThan(q)) {
      ruptures.push(`${m.date} : sortie de ${frn(qs)} pour un stock de ${frn(q)}`);
      qs = q;
    }
    let vs: Decimal;
    if (methode === 'cmp') vs = q.isZero() ? ZERO : euros(v.div(q).times(qs));
    else if (methode === 'cmp-periodique') vs = euros(cmpPeriode!.times(qs));
    else {
      vs = ZERO;
      let reste = qs;
      const ordre = methode === 'fifo' ? lots : [...lots].reverse();
      for (const lot of ordre) {
        if (reste.isZero()) break;
        const pris = Decimal.min(lot.q, reste);
        vs = vs.plus(pris.times(lot.pu));
        lot.q = lot.q.minus(pris);
        reste = reste.minus(pris);
      }
      lots = lots.filter((l) => l.q.greaterThan(0));
      vs = euros(vs);
    }
    // Dernière sortie qui vide le stock : on solde la valeur (pas de résidu d'arrondi)
    if (qs.equals(q) && methode !== 'cmp-periodique') vs = euros(v);
    q = q.minus(qs);
    v = v.minus(vs);
    coutSorties = coutSorties.plus(vs);
    ligne(m, null, null, qs, vs);
  }
  return { fiche, coutSorties, stockFinalQ: q, stockFinalV: euros(v), ruptures };
}

const NOMS: Record<Methode, string> = { cmp: 'CMP après chaque entrée', 'cmp-periodique': 'CMP périodique', fifo: 'FIFO (PEPS)', lifo: 'LIFO (DEPS)' };

export const valorisationStock = formule({
  id: 'valorisation-stock',
  moteur: M,
  nom: 'Valorisation des stocks : CMP, FIFO, LIFO',
  categorie: 'Valorisation',
  description: 'Établit la fiche de stock selon la méthode choisie (CMP après chaque entrée, CMP périodique, FIFO, LIFO) et compare les quatre méthodes sur le coût des sorties et le stock final.',
  expression: 'CMP = (valeur du stock + valeur de l’entrée) / (quantité du stock + quantité entrée) ; FIFO : sorties au coût des lots les plus anciens ; LIFO : des plus récents',
  references: [
    { texte: 'PCG art. 213-34 — coût d’entrée des biens fongibles : CMP ou PEPS' },
    { texte: 'IAS 2 § 25 — FIFO ou coût moyen pondéré ; LIFO interdit' },
    { texte: 'CGI ann. III art. 38 nonies' },
  ],
  champs: [
    choix('methode', 'Méthode de la fiche', Object.entries(NOMS) as [string, string][]),
    nombre('qInitiale', 'Stock initial — quantité', { defaut: '200', min: '0' }),
    montant('vInitiale', 'Stock initial — valeur', { defaut: '2400' }),
    table(
      'mouvements',
      'Mouvements',
      [
        date('date', 'Date'),
        texte('libelle', 'Libellé', { optionnel: true }),
        choix('type', 'Type', [
          ['entree', 'Entrée'],
          ['sortie', 'Sortie'],
        ]),
        nombre('quantite', 'Quantité', { min: '0' }),
        montant('prixUnitaire', 'Coût unitaire (entrées)', { optionnel: true }),
      ],
      {
        min: '1',
        defaut: [
          { date: '2025-01-05', libelle: 'Achat BL 401', type: 'entree', quantite: '300', prixUnitaire: '12.50' },
          { date: '2025-01-12', libelle: 'Bon de sortie 17', type: 'sortie', quantite: '350', prixUnitaire: '' },
          { date: '2025-01-20', libelle: 'Achat BL 418', type: 'entree', quantite: '400', prixUnitaire: '13.10' },
          { date: '2025-01-28', libelle: 'Bon de sortie 22', type: 'sortie', quantite: '280', prixUnitaire: '' },
        ],
      },
    ),
  ],
  exemples: [
    { titre: 'CMP', entrees: {}, attendu: { coutSorties: '7911.91', stockFinalV: '3478.09', stockFinalQ: '270' } },
    { titre: 'FIFO', entrees: { methode: 'fifo' }, attendu: { coutSorties: '7853.00', stockFinalV: '3537.00' } },
    { titre: 'LIFO', entrees: { methode: 'lifo' }, attendu: { coutSorties: '8018.00', stockFinalV: '3372.00' } },
  ],
  calculer(e, c) {
    const mvts = [...(e.mouvements as Mouvement[])].sort((a, b) => comparer(a.date, b.date) || (a.type === 'entree' ? -1 : 1));
    mvts.filter((m) => m.type === 'entree' && !m.prixUnitaire).forEach((m) => c.ctrl('erreur', 'PRIX_MANQUANT', `Entrée du ${m.date} sans coût unitaire.`));
    const r = valoriser(e.methode, e.qInitiale, e.vInitiale, mvts);
    r.ruptures.forEach((x) => c.ctrl('erreur', 'RUPTURE', `Stock insuffisant — ${x}.`));
    c.calc('coutSorties', 'Coût des sorties', `Σ sorties valorisées (${NOMS[e.methode as Methode]})`, r.coutSorties, 'EUR', { principal: true });
    c.res('stockFinalQ', 'Stock final — quantité', r.stockFinalQ, 'unites');
    c.calc('stockFinalV', 'Stock final — valeur', 'valeur initiale + entrées − sorties', r.stockFinalV, 'EUR', { principal: true });
    if (!r.stockFinalQ.isZero()) c.res('cuFinal', 'Coût unitaire du stock final', r.stockFinalV.div(r.stockFinalQ), 'nombre', { decimales: 4 });
    const entrees = somme(mvts.filter((m) => m.type === 'entree').map((m) => euros(m.quantite.times(m.prixUnitaire ?? 0))));
    c.verifier(d(e.vInitiale).plus(entrees).minus(r.coutSorties).equals(r.stockFinalV), 'CONSERVATION', 'Cohérence : stock initial + entrées − sorties = stock final (en valeur).', 'Écart dans l’équation de stock.');
    if (e.methode === 'lifo') c.ctrl('avertissement', 'LIFO_INTERDIT', 'LIFO interdit en France (PCG 213-34) et en IFRS (IAS 2) : simulation uniquement.');
    c.tableau({
      titre: `Fiche de stock — ${NOMS[e.methode as Methode]}`,
      colonnes: [
        { cle: 'date', libelle: 'Date', unite: 'date' },
        { cle: 'libelle', libelle: 'Libellé', unite: 'texte' },
        { cle: 'qEntree', libelle: 'Qté entrée', unite: 'nombre' },
        { cle: 'vEntree', libelle: 'Valeur entrée', unite: 'EUR' },
        { cle: 'qSortie', libelle: 'Qté sortie', unite: 'nombre' },
        { cle: 'vSortie', libelle: 'Valeur sortie', unite: 'EUR' },
        { cle: 'qStock', libelle: 'Qté stock', unite: 'nombre' },
        { cle: 'vStock', libelle: 'Valeur stock', unite: 'EUR' },
        { cle: 'cu', libelle: 'Coût unitaire', unite: 'nombre' },
      ],
      lignes: r.fiche,
    });
    const comparaison = (Object.keys(NOMS) as Methode[]).map((m) => {
      const x = valoriser(m, e.qInitiale, e.vInitiale, mvts);
      return { methode: NOMS[m], sorties: x.coutSorties.toFixed(2), stock: x.stockFinalV.toFixed(2) };
    });
    c.tableau({
      titre: 'Comparaison des méthodes',
      colonnes: [
        { cle: 'methode', libelle: 'Méthode', unite: 'texte' },
        { cle: 'sorties', libelle: 'Coût des sorties', unite: 'EUR' },
        { cle: 'stock', libelle: 'Stock final', unite: 'EUR' },
      ],
      lignes: comparaison,
      graphique: { type: 'barres', x: 'methode', series: ['sorties', 'stock'] },
    });
  },
});

export const valeurNetteRealisation = formule({
  id: 'valeur-nette-realisation',
  moteur: M,
  nom: 'Valeur nette de réalisation',
  categorie: 'Valorisation',
  description: 'Calcule la valeur nette de réalisation (prix de vente estimé − coûts d’achèvement − coûts de commercialisation) et la dépréciation éventuelle par rapport au coût.',
  expression: 'VNR = prix de vente estimé − coûts d’achèvement − frais de vente ; dépréciation = max(0 ; coût − VNR) × quantité',
  references: [{ texte: 'PCG art. 214-25 ; IAS 2 § 28 à 33 — valeur nette de réalisation' }],
  champs: [
    nombre('quantite', 'Quantité en stock', { defaut: '850' }),
    montant('cout', 'Coût unitaire d’entrée', { defaut: '42' }),
    montant('prixVente', 'Prix de vente estimé unitaire', { defaut: '55' }),
    montant('coutsAchevement', 'Coûts d’achèvement unitaires', { defaut: '6' }),
    taux('fraisVente', 'Frais de commercialisation (% du prix)', { defaut: '18' }),
  ],
  exemples: [{ titre: 'Produits en cours', entrees: {}, attendu: { vnrUnitaire: '39.10', depreciation: '2465.00', valeurBilan: '33235.00' } }],
  calculer(e, c) {
    const vnr = c.calc('vnrUnitaire', 'VNR unitaire', `${fr(e.prixVente)} − ${fr(e.coutsAchevement)} − ${fp(e.fraisVente)} × ${fr(e.prixVente)}`, euros(d(e.prixVente).minus(e.coutsAchevement).minus(d(e.prixVente).times(e.fraisVente))));
    const dep = c.calc('depreciation', 'Dépréciation', `max(0 ; ${fr(e.cout)} − ${fr(vnr)}) × ${frn(e.quantite)}`, euros(positif(d(e.cout).minus(vnr)).times(e.quantite)), 'EUR', { principal: true });
    c.calc('valeurBilan', 'Valeur au bilan', `${fr(e.cout)} × ${frn(e.quantite)} − ${fr(dep)}`, euros(d(e.cout).times(e.quantite)).minus(dep));
    c.ctrl(dep.greaterThan(0) ? 'avertissement' : 'ok', 'TEST_VNR', dep.greaterThan(0) ? `VNR inférieure au coût : dépréciation de ${fe(dep)} à constater (compte 39).` : 'VNR supérieure au coût : aucune dépréciation.');
  },
});

export const wilson = formule({
  id: 'wilson',
  moteur: M,
  nom: 'Quantité économique de commande (Wilson)',
  categorie: 'Gestion des approvisionnements',
  description: 'Détermine la quantité optimale à commander qui minimise la somme des coûts de passation et de possession, le nombre de commandes, la périodicité et le coût total de gestion.',
  expression: 'Q* = √(2 × D × Cp / Cs) avec Cs = taux de possession × prix unitaire ; N = D / Q* ; coût = Cp × D/Q + Cs × Q/2',
  references: [{ texte: 'Modèle de Wilson (Harris, 1913)' }],
  champs: [
    nombre('demande', 'Consommation annuelle (unités)', { defaut: '24000' }),
    montant('coutPassation', 'Coût de passation d’une commande', { defaut: '150' }),
    montant('prixUnitaire', 'Prix d’achat unitaire', { defaut: '8' }),
    taux('tauxPossession', 'Taux de possession annuel', { defaut: '12' }),
  ],
  exemples: [{ titre: 'Composant', entrees: {}, attendu: { quantiteOptimale: '2739', nbCommandes: '8.76', periodicite: '41.1', coutGestion: '2629.07' } }],
  calculer(e, c) {
    const cs = c.etape('Coût de possession unitaire annuel', `${fp(e.tauxPossession)} × ${fr(e.prixUnitaire)}`, d(e.tauxPossession).times(e.prixUnitaire), 'EUR');
    if (cs.isZero()) {
      c.ctrl('erreur', 'POSSESSION_NULLE', 'Coût de possession nul : quantité économique indéfinie.');
      return;
    }
    const qExacte = d(2).times(e.demande).times(e.coutPassation).div(cs).sqrt();
    const q = c.calc('quantiteOptimale', 'Quantité économique', `√(2 × ${frn(e.demande)} × ${fr(e.coutPassation)} / ${frn(cs)})`, arrondi(qExacte, 0, 'plafond'), 'unites', { decimales: 0, principal: true });
    const n = c.calc('nbCommandes', 'Nombre de commandes par an', `${frn(e.demande)} / ${frn(q)}`, d(e.demande).div(q), 'nombre', { decimales: 2 });
    c.calc('periodicite', 'Périodicité (jours, année de 360 j)', `360 / ${frn(n, 4)}`, d(360).div(n), 'jours', { decimales: 1 });
    const cp = d(e.coutPassation).times(e.demande).div(q);
    const cpo = cs.times(q).div(2);
    c.etape('Coût de passation annuel', `${fr(e.coutPassation)} × ${frn(e.demande)} / ${frn(q)}`, euros(cp), 'EUR');
    c.etape('Coût de possession annuel', `${frn(cs)} × ${frn(q)} / 2`, euros(cpo), 'EUR');
    c.calc('coutGestion', 'Coût total de gestion', 'passation + possession', euros(cp.plus(cpo)), 'EUR', { principal: true });
    c.res('stockMoyen', 'Stock moyen', q.div(2), 'unites', { decimales: 1 });
    const lignes = [0.25, 0.5, 0.75, 1, 1.5, 2, 3].map((f) => {
      const qq = q.times(f).round();
      return { quantite: qq.toFixed(), passation: euros(d(e.coutPassation).times(e.demande).div(qq)).toFixed(2), possession: euros(cs.times(qq).div(2)).toFixed(2), total: euros(d(e.coutPassation).times(e.demande).div(qq).plus(cs.times(qq).div(2))).toFixed(2) };
    });
    c.tableau({
      titre: 'Coûts selon la quantité commandée',
      colonnes: [
        { cle: 'quantite', libelle: 'Quantité', unite: 'unites' },
        { cle: 'passation', libelle: 'Passation', unite: 'EUR' },
        { cle: 'possession', libelle: 'Possession', unite: 'EUR' },
        { cle: 'total', libelle: 'Total', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'lignes', x: 'quantite', series: ['passation', 'possession', 'total'] },
    });
  },
});

export const stockSecurite = formule({
  id: 'stock-securite',
  moteur: M,
  nom: 'Stock de sécurité et point de commande',
  categorie: 'Gestion des approvisionnements',
  description: 'Stock de sécurité par la méthode statistique (niveau de service) ou forfaitaire (jours de sécurité), point de commande et stock d’alerte.',
  expression: 'Statistique : SS = z × σ_journalière × √délai ; forfaitaire : SS = consommation journalière × jours de sécurité ; point de commande = consommation × délai + SS',
  references: [{ texte: 'Gestion des stocks — niveau de service et loi normale' }],
  champs: [
    nombre('consommationJournaliere', 'Consommation moyenne par jour', { defaut: '80' }),
    nombre('delai', 'Délai de livraison (jours)', { defaut: '12' }),
    choix('methode', 'Méthode', [
      ['statistique', 'Statistique (niveau de service)'],
      ['forfaitaire', 'Forfaitaire (jours de sécurité)'],
    ]),
    nombre('ecartTypeJournalier', 'Écart-type de la consommation journalière', { defaut: '22', visibleSi: { champ: 'methode', valeurs: ['statistique'] } }),
    choix('niveauService', 'Niveau de service', [
      ['1.2816', '90 %'],
      ['1.6449', '95 %'],
      ['1.9600', '97,5 %'],
      ['2.3263', '99 %'],
    ], { defaut: '1.6449', visibleSi: { champ: 'methode', valeurs: ['statistique'] } }),
    nombre('joursSecurite', 'Jours de sécurité', { defaut: '5', visibleSi: { champ: 'methode', valeurs: ['forfaitaire'] } }),
  ],
  exemples: [
    { titre: 'Statistique 95 %', entrees: {}, attendu: { stockSecurite: '126', pointCommande: '1086' } },
    { titre: 'Forfaitaire', entrees: { methode: 'forfaitaire' }, attendu: { stockSecurite: '400', pointCommande: '1360' } },
  ],
  calculer(e, c) {
    const conso: Decimal = e.consommationJournaliere;
    const ss =
      e.methode === 'statistique'
        ? c.etape('Stock de sécurité', `${e.niveauService} × ${frn(e.ecartTypeJournalier)} × √${frn(e.delai)}`, arrondi(d(e.niveauService).times(e.ecartTypeJournalier).times(d(e.delai).sqrt()), 0, 'plafond'), 'unites')
        : c.etape('Stock de sécurité', `${frn(conso)} × ${frn(e.joursSecurite)}`, arrondi(conso.times(e.joursSecurite), 0, 'plafond'), 'unites');
    c.res('stockSecurite', 'Stock de sécurité', ss, 'unites', { decimales: 0, principal: true });
    const cd = c.calc('consommationDelai', 'Consommation pendant le délai', `${frn(conso)} × ${frn(e.delai)}`, conso.times(e.delai), 'unites', { decimales: 0 });
    c.calc('pointCommande', 'Point de commande (stock d’alerte)', `${frn(cd)} + ${frn(ss)}`, cd.plus(ss), 'unites', { decimales: 0, principal: true });
  },
});

export const rotationStocks = formule({
  id: 'rotation-stocks',
  moteur: M,
  nom: 'Rotation, durée de stockage et couverture',
  categorie: 'Indicateurs',
  description: 'Stock moyen, coefficient de rotation, durée moyenne de stockage et couverture du stock final en jours de consommation.',
  expression: 'Stock moyen = (SI + SF) / 2 ; rotation = coût des sorties / stock moyen ; durée = 360 / rotation ; couverture = SF / consommation journalière',
  references: [{ texte: 'Analyse financière — rotation des stocks (Banque de France)' }],
  champs: [
    montant('stockInitial', 'Stock initial (valeur)', { defaut: '48000' }),
    montant('stockFinal', 'Stock final (valeur)', { defaut: '56000' }),
    montant('achats', 'Achats de la période', { defaut: '318000' }),
    nombre('joursPeriode', 'Jours de la période', { defaut: '360' }),
  ],
  exemples: [{ titre: 'Négoce', entrees: {}, attendu: { coutSorties: '310000.00', stockMoyen: '52000.00', rotation: '5.96', duree: '60.4', couverture: '65.0' } }],
  calculer(e, c) {
    const cs = c.calc('coutSorties', 'Coût des sorties (consommations)', `${fr(e.achats)} + ${fr(e.stockInitial)} − ${fr(e.stockFinal)}`, d(e.achats).plus(e.stockInitial).minus(e.stockFinal));
    const sm = c.calc('stockMoyen', 'Stock moyen', `(${fr(e.stockInitial)} + ${fr(e.stockFinal)}) / 2`, d(e.stockInitial).plus(e.stockFinal).div(2));
    const rot = c.calc('rotation', 'Coefficient de rotation', `${fr(cs)} / ${fr(sm)}`, diviser(cs, sm), 'fois', { decimales: 2, principal: true });
    c.calc('duree', 'Durée moyenne de stockage', `${frn(e.joursPeriode)} / ${frn(rot, 4)}`, diviser(e.joursPeriode, rot), 'jours', { decimales: 1 });
    c.calc('couverture', 'Couverture du stock final', `${fr(e.stockFinal)} / (${fr(cs)} / ${frn(e.joursPeriode)})`, diviser(e.stockFinal, cs.div(e.joursPeriode)), 'jours', { decimales: 1 });
    if (rot.lessThan(2)) c.ctrl('avertissement', 'ROTATION_FAIBLE', 'Rotation faible : risque d’obsolescence et immobilisation de trésorerie.');
  },
});

export const ecartsInventaire = formule({
  id: 'ecarts-inventaire',
  moteur: M,
  nom: 'Écarts d’inventaire',
  categorie: 'Inventaire',
  description: 'Compare le stock théorique (inventaire permanent) à l’inventaire physique, valorise les écarts, calcule le taux de démarque et propose l’écriture de régularisation.',
  expression: 'Écart = (quantité physique − quantité théorique) × coût unitaire ; démarque = Σ écarts négatifs / stock théorique',
  references: [
    { texte: 'Code de commerce art. L.123-12 — inventaire annuel' },
    { texte: 'PCG art. 946-60 / 947-71 — variations de stocks' },
  ],
  champs: [
    table('articles', 'Articles', [texte('article', 'Article'), nombre('theorique', 'Qté théorique'), nombre('physique', 'Qté physique'), montant('cout', 'Coût unitaire')], {
      min: '1',
      defaut: [
        { article: 'Réf. 1001', theorique: '420', physique: '412', cout: '14.20' },
        { article: 'Réf. 1002', theorique: '150', physique: '150', cout: '32.00' },
        { article: 'Réf. 1003', theorique: '75', physique: '79', cout: '8.50' },
        { article: 'Réf. 1004', theorique: '960', physique: '931', cout: '2.40' },
      ],
    }),
  ],
  exemples: [{ titre: 'Inventaire de clôture', entrees: {}, attendu: { stockTheorique: '13705.50', stockPhysique: '13556.30', ecartNet: '-149.20', demarque: '1.34' } }],
  calculer(e, c) {
    type A = { article: string; theorique: Decimal; physique: Decimal; cout: Decimal };
    let th = ZERO;
    let ph = ZERO;
    let negatifs = ZERO;
    const lignes = (e.articles as A[]).map((a) => {
      const vt = euros(a.theorique.times(a.cout));
      const vp = euros(a.physique.times(a.cout));
      th = th.plus(vt);
      ph = ph.plus(vp);
      const ec = vp.minus(vt);
      if (ec.isNegative()) negatifs = negatifs.plus(ec.neg());
      return { article: a.article, ecartQ: a.physique.minus(a.theorique).toFixed(), ecartV: ec.toFixed(2) };
    });
    c.calc('stockTheorique', 'Stock théorique', 'Σ qté théorique × coût', th);
    c.calc('stockPhysique', 'Stock physique', 'Σ qté physique × coût', ph);
    const net = c.calc('ecartNet', 'Écart net d’inventaire', `${fr(ph)} − ${fr(th)}`, ph.minus(th), 'EUR', { principal: true });
    c.calc('demarque', 'Taux de démarque inconnue', `${fr(negatifs)} / ${fr(th)}`, diviser(negatifs, th), '%');
    c.tableau({
      titre: 'Écarts par article',
      colonnes: [
        { cle: 'article', libelle: 'Article', unite: 'texte' },
        { cle: 'ecartQ', libelle: 'Écart qté', unite: 'nombre' },
        { cle: 'ecartV', libelle: 'Écart valeur', unite: 'EUR' },
      ],
      lignes,
    });
    if (!net.isZero())
      c.ecriture('Régularisation d’inventaire (inventaire permanent)', [
        { compte: '37', intitule: 'Stocks de marchandises', debit: net },
        { compte: '6037', intitule: 'Variation des stocks de marchandises', credit: net },
      ]);
  },
});

export const variationStocks = formule({
  id: 'variation-stocks',
  moteur: M,
  nom: 'Variation des stocks (inventaire intermittent)',
  categorie: 'Inventaire',
  description: 'Calcule la variation des stocks de marchandises, de matières et de produits à la clôture, et génère les écritures d’annulation du stock initial et de constatation du stock final.',
  expression: 'Variation achats (603) = SI − SF ; variation production (713) = SF − SI',
  references: [{ texte: 'PCG art. 946-60 et 947-71 — comptes 603 et 713' }],
  champs: [
    montant('marchandisesSI', 'Marchandises — stock initial', { defaut: '42000', groupe: 'Marchandises' }),
    montant('marchandisesSF', 'Marchandises — stock final', { defaut: '47500', groupe: 'Marchandises' }),
    montant('matieresSI', 'Matières premières — stock initial', { defaut: '18000', groupe: 'Matières' }),
    montant('matieresSF', 'Matières premières — stock final', { defaut: '15200', groupe: 'Matières' }),
    montant('produitsSI', 'Produits finis — stock initial', { defaut: '26000', groupe: 'Produits' }),
    montant('produitsSF', 'Produits finis — stock final', { defaut: '31000', groupe: 'Produits' }),
  ],
  exemples: [{ titre: 'Clôture', entrees: {}, attendu: { variation6037: '-5500.00', variation6031: '2800.00', variation713: '5000.00' } }],
  calculer(e, c) {
    const v37 = c.calc('variation6037', 'Variation des stocks de marchandises (6037)', `SI ${fr(e.marchandisesSI)} − SF ${fr(e.marchandisesSF)}`, d(e.marchandisesSI).minus(e.marchandisesSF));
    const v31 = c.calc('variation6031', 'Variation des stocks de matières (6031)', `SI ${fr(e.matieresSI)} − SF ${fr(e.matieresSF)}`, d(e.matieresSI).minus(e.matieresSF));
    const v713 = c.calc('variation713', 'Variation des stocks de produits (713)', `SF ${fr(e.produitsSF)} − SI ${fr(e.produitsSI)}`, d(e.produitsSF).minus(e.produitsSI), 'EUR', { principal: true });
    c.res('lecture', 'Lecture', `${v37.isNegative() ? 'Stockage' : 'Déstockage'} de marchandises, ${v31.isNegative() ? 'stockage' : 'déstockage'} de matières, production ${v713.isNegative() ? 'déstockée' : 'stockée'}.`, 'texte');
    c.ecriture('Annulation des stocks initiaux', [
      { compte: '6037', intitule: 'Variation des stocks de marchandises', debit: e.marchandisesSI },
      { compte: '6031', intitule: 'Variation des stocks de matières premières', debit: e.matieresSI },
      { compte: '713', intitule: 'Variation des stocks de produits', debit: e.produitsSI },
      { compte: '37', intitule: 'Stocks de marchandises', credit: e.marchandisesSI },
      { compte: '31', intitule: 'Matières premières', credit: e.matieresSI },
      { compte: '355', intitule: 'Produits finis', credit: e.produitsSI },
    ]);
    c.ecriture('Constatation des stocks finaux', [
      { compte: '37', intitule: 'Stocks de marchandises', debit: e.marchandisesSF },
      { compte: '31', intitule: 'Matières premières', debit: e.matieresSF },
      { compte: '355', intitule: 'Produits finis', debit: e.produitsSF },
      { compte: '6037', intitule: 'Variation des stocks de marchandises', credit: e.marchandisesSF },
      { compte: '6031', intitule: 'Variation des stocks de matières premières', credit: e.matieresSF },
      { compte: '713', intitule: 'Variation des stocks de produits', credit: e.produitsSF },
    ]);
  },
});

export const formulesStocks = [valorisationStock, valeurNetteRealisation, wilson, stockSecurite, rotationStocks, ecartsInventaire, variationStocks];

