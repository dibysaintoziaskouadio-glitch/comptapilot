/**
 * MOTEUR 8 — Trésorerie et financement : emprunts (TAEG), taux variable, agios,
 * escompte et Dailly, affacturage, budget et plan de trésorerie, placements,
 * obligations, annuités, loyers de crédit-bail.
 */
import {
  ajouterMois,
  annuiteConstante,
  booleen,
  choix,
  comparer,
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
  joursEntre,
  min,
  montant,
  nombre,
  positif,
  somme,
  table,
  taux,
  texte,
  tri,
  UN,
  ZERO,
  van,
  max,
  diviser,
} from '../noyau';

const M = 'tresorerie' as const;

const champPeriodicite = choix('periodicite', 'Périodicité des échéances', [
  ['12', 'Mensuelle'],
  ['4', 'Trimestrielle'],
  ['2', 'Semestrielle'],
  ['1', 'Annuelle'],
]);

interface Echeance {
  n: number;
  date?: string;
  crdDebut: Decimal;
  interets: Decimal;
  amortissement: Decimal;
  assurance: Decimal;
  echeance: Decimal;
  crdFin: Decimal;
}

export interface ParamsEmprunt {
  capital: Decimal;
  tauxPeriodique: Decimal;
  periodes: number;
  type: 'annuites' | 'amortissement-constant' | 'in-fine';
  differe: number;
  typeDiffere: 'partiel' | 'total';
  assurancePeriodique: Decimal; // taux périodique
  assuranceSurCrd: boolean;
}

/** Tableau d'amortissement d'un emprunt — fonction pure. Le CRD final est exactement nul. */
export function tableauEmprunt(p: ParamsEmprunt): Echeance[] {
  const lignes: Echeance[] = [];
  let crd = p.capital;
  const i = p.tauxPeriodique;
  const nAmort = p.periodes - p.differe;
  let echeanceConstante: Decimal | null = null;
  let amortConstant: Decimal | null = null;
  for (let n = 1; n <= p.periodes; n++) {
    const interets = euros(crd.times(i));
    const assurance = euros((p.assuranceSurCrd ? crd : p.capital).times(p.assurancePeriodique));
    let amortissement: Decimal;
    let paye: Decimal;
    if (n <= p.differe) {
      if (p.typeDiffere === 'total') {
        amortissement = interets.neg(); // intérêts capitalisés
        paye = ZERO;
      } else {
        amortissement = ZERO;
        paye = interets;
      }
    } else if (p.type === 'in-fine') {
      amortissement = n === p.periodes ? crd : ZERO;
      paye = interets.plus(amortissement);
    } else if (p.type === 'amortissement-constant') {
      if (!amortConstant) amortConstant = euros(crd.div(nAmort));
      amortissement = n === p.periodes ? crd : amortConstant;
      paye = interets.plus(amortissement);
    } else {
      if (!echeanceConstante) echeanceConstante = euros(annuiteConstante(crd, i, nAmort));
      // L'échéance arrondie au centime peut cumuler un léger excédent sur les très longues durées :
      // l'amortissement est borné au capital restant dû (dernière échéance ajustée).
      amortissement = n === p.periodes ? crd : Decimal.min(echeanceConstante.minus(interets), crd);
      paye = interets.plus(amortissement);
    }
    const crdFin = crd.minus(amortissement);
    lignes.push({ n, crdDebut: crd, interets, amortissement, assurance, echeance: paye.plus(assurance), crdFin });
    crd = crdFin;
  }
  return lignes;
}

export const emprunt = formule({
  id: 'emprunt',
  moteur: M,
  nom: 'Emprunt : échéancier, coût et TAEG',
  categorie: 'Emprunts',
  description:
    'Tableau d’amortissement complet (échéances constantes, amortissement constant ou in fine), différé partiel ou total, assurance sur capital initial ou restant dû, coût total du crédit, TEG proportionnel et TAEG actuariel.',
  expression: 'Échéance = C × i / (1 − (1 + i)^−n) ; intérêts = CRD × i ; amortissement = échéance − intérêts ; TAEG : (1 + i_p)^k − 1 où i_p annule C − frais − Σ échéances actualisées',
  references: [
    { texte: 'Code de la consommation art. L.314-1 à L.314-5 et R.314-1 à R.314-4 — TAEG' },
    { texte: 'Code monétaire et financier art. L.313-4 — TEG des prêts aux professionnels' },
  ],
  champs: [
    montant('capital', 'Capital emprunté', { defaut: '100000' }),
    taux('taux', 'Taux nominal annuel', { defaut: '4', min: '0' }),
    entier('dureeMois', 'Durée (mois)', { defaut: 60, min: '1', max: '600' }),
    champPeriodicite,
    choix('type', 'Mode de remboursement', [
      ['annuites', 'Échéances constantes'],
      ['amortissement-constant', 'Amortissement constant'],
      ['in-fine', 'In fine'],
    ]),
    entier('differe', 'Différé (nombre d’échéances)', { defaut: 0, min: '0', max: '599' }),
    choix('typeDiffere', 'Type de différé', [
      ['partiel', 'Partiel (intérêts payés)'],
      ['total', 'Total (intérêts capitalisés)'],
    ]),
    taux('assurance', 'Taux annuel d’assurance', { defaut: '0', min: '0' }),
    booleen('assuranceSurCrd', 'Assurance calculée sur le capital restant dû'),
    montant('frais', 'Frais de dossier et de garantie', { defaut: '0' }),
    date('premiereEcheance', 'Date de la première échéance', { optionnel: true }),
  ],
  exemples: [
    { titre: '100 000 € à 4 % sur 5 ans', entrees: {}, attendu: { echeance: '1841.65', coutInterets: '10499.17', taeg: '4.0742' }, source: 'Formule de l’annuité constante, vérifiable sur tout simulateur bancaire' },
    { titre: 'Amortissement constant', entrees: { type: 'amortissement-constant' }, attendu: { coutInterets: '10166.65' } },
    { titre: 'Avec frais et assurance', entrees: { frais: '1000', assurance: '0.30' }, attendu: { coutAssurance: '1500.00' } },
  ],
  calculer(e, c) {
    const k = Number(e.periodicite);
    const pas = 12 / k;
    if (e.dureeMois % pas !== 0) {
      c.ctrl('erreur', 'DUREE', `La durée doit être un multiple de ${pas} mois pour cette périodicité.`);
      return;
    }
    const n = e.dureeMois / pas;
    if (e.differe >= n) {
      c.ctrl('erreur', 'DIFFERE', 'Le différé doit être inférieur au nombre d’échéances.');
      return;
    }
    const i = c.etape('Taux périodique', `${fp(e.taux)} / ${k}`, d(e.taux).div(k), '%');
    const lignes = tableauEmprunt({
      capital: e.capital,
      tauxPeriodique: i,
      periodes: n,
      type: e.type,
      differe: e.differe,
      typeDiffere: e.typeDiffere,
      assurancePeriodique: d(e.assurance).div(k),
      assuranceSurCrd: e.assuranceSurCrd,
    });
    if (e.premiereEcheance) lignes.forEach((l) => (l.date = ajouterMois(e.premiereEcheance, (l.n - 1) * pas)));
    const premiere = lignes[e.differe];
    c.calc('echeance', e.type === 'annuites' ? 'Échéance constante (hors assurance)' : 'Première échéance après différé (hors assurance)', e.type === 'annuites' ? `${fr(e.capital)} × ${fp(i)} / (1 − (1 + ${fp(i)})^−${n - e.differe})` : 'intérêts + amortissement', premiere.echeance.minus(premiere.assurance), 'EUR', { principal: true });
    const ti = c.calc('coutInterets', 'Coût total des intérêts', 'Σ intérêts', somme(lignes.map((l) => l.interets)));
    const ta = c.calc('coutAssurance', 'Coût total de l’assurance', 'Σ assurance', somme(lignes.map((l) => l.assurance)));
    c.calc('coutTotal', 'Coût total du crédit', 'intérêts + assurance + frais', ti.plus(ta).plus(e.frais), 'EUR', { principal: true });
    c.res('totalRembourse', 'Total remboursé', somme(lignes.map((l) => l.echeance)));
    c.res('nbEcheances', 'Nombre d’échéances', n, 'entier');
    // TAEG actuariel
    const flux = [d(e.capital).minus(e.frais).neg(), ...lignes.map((l) => l.echeance)];
    const ip = tri(flux);
    if (ip) {
      c.calc('teg', 'TEG (taux de période × périodes)', `${fp(ip, 6)} × ${k}`, ip.times(k), '%', { decimales: 4 });
      c.calc('taeg', 'TAEG (méthode actuarielle)', `(1 + ${fp(ip, 6)})^${k} − 1`, UN.plus(ip).pow(k).minus(1), '%', { decimales: 4, principal: true });
    }
    c.verifier(lignes[lignes.length - 1].crdFin.isZero(), 'CRD_NUL', 'Le capital restant dû est exactement nul à la dernière échéance.', 'Capital restant dû non nul en fin de prêt.');
    c.verifier(somme(lignes.map((l) => l.amortissement)).equals(e.capital), 'SOMME_AMORTISSEMENTS', 'Σ amortissements = capital emprunté.', 'Σ amortissements ≠ capital (différé total : intérêts capitalisés inclus).', e.typeDiffere === 'total' && e.differe > 0 ? 'info' : 'erreur');
    c.tableau({
      titre: 'Tableau d’amortissement',
      colonnes: [
        { cle: 'n', libelle: 'N°', unite: 'entier' },
        ...(e.premiereEcheance ? [{ cle: 'date', libelle: 'Date', unite: 'date' as const }] : []),
        { cle: 'crdDebut', libelle: 'CRD début', unite: 'EUR' },
        { cle: 'interets', libelle: 'Intérêts', unite: 'EUR' },
        { cle: 'amortissement', libelle: 'Capital', unite: 'EUR' },
        { cle: 'assurance', libelle: 'Assurance', unite: 'EUR' },
        { cle: 'echeance', libelle: 'Échéance', unite: 'EUR' },
        { cle: 'crdFin', libelle: 'CRD fin', unite: 'EUR' },
      ],
      lignes: lignes.map((l) => ({
        n: String(l.n),
        ...(l.date ? { date: l.date } : {}),
        crdDebut: l.crdDebut.toFixed(2),
        interets: l.interets.toFixed(2),
        amortissement: l.amortissement.toFixed(2),
        assurance: l.assurance.toFixed(2),
        echeance: l.echeance.toFixed(2),
        crdFin: l.crdFin.toFixed(2),
      })),
      totaux: { n: 'Total', interets: ti.toFixed(2), assurance: ta.toFixed(2), amortissement: somme(lignes.map((l) => l.amortissement)).toFixed(2), echeance: somme(lignes.map((l) => l.echeance)).toFixed(2) },
      graphique: { type: 'aires', x: 'n', series: ['interets', 'amortissement'] },
    });
    c.ecriture('Encaissement de l’emprunt', [
      { compte: '512', intitule: 'Banque', debit: d(e.capital).minus(e.frais) },
      { compte: '627', intitule: 'Frais de dossier', debit: e.frais },
      { compte: '164', intitule: 'Emprunts auprès des établissements de crédit', credit: e.capital },
    ], 'BQ');
    const l1 = lignes[0];
    c.ecriture('Première échéance', [
      { compte: '164', intitule: 'Emprunts — remboursement du capital', debit: positif(l1.amortissement) },
      { compte: '6611', intitule: 'Intérêts des emprunts', debit: l1.interets },
      { compte: '616', intitule: 'Assurance emprunteur', debit: l1.assurance },
      { compte: '164', intitule: 'Intérêts capitalisés', credit: positif(l1.amortissement.neg()) },
      { compte: '512', intitule: 'Banque', credit: l1.echeance },
    ], 'BQ');
  },
});

export const empruntTauxVariable = formule({
  id: 'emprunt-taux-variable',
  moteur: M,
  nom: 'Emprunt à taux variable ou à paliers',
  categorie: 'Emprunts',
  description: 'Recalcule l’échéance à chaque changement de taux sur le capital restant dû et la durée résiduelle (durée constante, échéance variable).',
  expression: 'À chaque palier : échéance = CRD × i / (1 − (1 + i)^−n restant)',
  references: [{ texte: 'Code de la consommation art. L.313-25 — information sur la variation du taux' }],
  champs: [
    montant('capital', 'Capital emprunté', { defaut: '200000' }),
    entier('dureeMois', 'Durée (mois)', { defaut: 120, min: '1', max: '600' }),
    table('paliers', 'Paliers de taux', [entier('aPartirDu', 'À partir de l’échéance n°', { min: '1', max: '600' }), taux('taux', 'Taux annuel')], {
      min: '1',
      defaut: [
        { aPartirDu: '1', taux: '3.2' },
        { aPartirDu: '25', taux: '4.1' },
        { aPartirDu: '61', taux: '3.6' },
      ],
    }),
  ],
  exemples: [{ titre: 'Trois paliers', entrees: {}, attendu: { echeanceInitiale: '1949.73', nbChangements: '2' } }],
  calculer(e, c) {
    type P = { aPartirDu: number; taux: Decimal };
    const paliers = [...(e.paliers as P[])].sort((a, b) => a.aPartirDu - b.aPartirDu);
    if (paliers[0].aPartirDu !== 1) {
      c.ctrl('erreur', 'PALIER_INITIAL', 'Le premier palier doit commencer à l’échéance 1.');
      return;
    }
    const n: number = e.dureeMois;
    let crd: Decimal = e.capital;
    let ech = ZERO;
    let tauxCourant = ZERO;
    let totalInterets = ZERO;
    const resume: Record<string, string>[] = [];
    for (let k = 1; k <= n; k++) {
      const p = paliers.filter((x) => x.aPartirDu <= k).pop()!;
      if (k === 1 || !p.taux.equals(tauxCourant)) {
        tauxCourant = p.taux;
        ech = euros(annuiteConstante(crd, tauxCourant.div(12), n - k + 1));
        resume.push({ debut: String(k), taux: tauxCourant.times(100).toFixed(2), crd: crd.toFixed(2), echeance: ech.toFixed(2) });
        if (k === 1) c.res('echeanceInitiale', 'Échéance initiale', ech, 'EUR', { principal: true });
      }
      const int = euros(crd.times(tauxCourant).div(12));
      const am = k === n ? crd : ech.minus(int);
      totalInterets = totalInterets.plus(int);
      crd = crd.minus(am);
    }
    c.res('nbChangements', 'Révisions de taux', resume.length - 1, 'entier');
    c.calc('coutInterets', 'Coût total des intérêts', 'Σ intérêts', totalInterets, 'EUR', { principal: true });
    c.tableau({
      titre: 'Révisions d’échéance',
      colonnes: [
        { cle: 'debut', libelle: 'Échéance n°', unite: 'entier' },
        { cle: 'taux', libelle: 'Taux annuel', unite: '%' },
        { cle: 'crd', libelle: 'CRD', unite: 'EUR' },
        { cle: 'echeance', libelle: 'Nouvelle échéance', unite: 'EUR' },
      ],
      lignes: resume,
      graphique: { type: 'barres', x: 'debut', series: ['echeance'] },
    });
    c.verifier(crd.isZero(), 'CRD_NUL', 'Prêt intégralement remboursé.', 'CRD final non nul.');
  },
});

export const agios = formule({
  id: 'agios-decouvert',
  moteur: M,
  nom: 'Agios de découvert (échelle d’intérêts)',
  categorie: 'Crédits court terme',
  description: 'Établit l’échelle d’intérêts en dates de valeur : nombres débiteurs, intérêts débiteurs (base 360), commission du plus fort découvert, commission de mouvement, coût total et taux effectif, contrôle du taux d’usure.',
  expression: 'Intérêts = Σ (solde débiteur × jours) × taux / 360 ; CPFD = plus fort découvert × taux ; commission de mouvement = Σ débits × taux',
  references: [
    { texte: 'Code monétaire et financier art. L.313-4 et L.314-6 — usure' },
    { texte: 'Code de la consommation art. L.314-6 — taux d’usure (BdF)' },
  ],
  champs: [
    date('debut', 'Début de la période', { defaut: '2025-03-01' }),
    date('fin', 'Fin de la période', { defaut: '2025-03-31' }),
    montant('soldeInitial', 'Solde initial (négatif si débiteur)', { defaut: '-4200' }),
    table('mouvements', 'Mouvements (dates de valeur)', [date('dateValeur', 'Date de valeur'), texte('libelle', 'Libellé', { optionnel: true }), montant('montant', 'Montant (+ crédit / − débit)')], {
      defaut: [
        { dateValeur: '2025-03-06', libelle: 'Paiement fournisseur', montant: '-6800' },
        { dateValeur: '2025-03-12', libelle: 'Règlement client', montant: '5300' },
        { dateValeur: '2025-03-20', libelle: 'Salaires', montant: '-9100' },
        { dateValeur: '2025-03-27', libelle: 'Règlement client', montant: '12500' },
      ],
    }),
    taux('tauxDebiteur', 'Taux débiteur annuel', { defaut: '9.5' }),
    taux('cpfd', 'Commission du plus fort découvert (mensuelle)', { defaut: '0.05' }),
    taux('commissionMouvement', 'Commission de mouvement', { defaut: '0.025' }),
    taux('tauxUsure', 'Taux de l’usure applicable', { defaut: '15.2' }),
  ],
  exemples: [{ titre: 'Mars 2025', entrees: {}, attendu: { nombresDebiteurs: '247700.00', interets: '65.37', plusFortDecouvert: '14800.00', commissionPfd: '7.40', commissionMvt: '3.98', totalAgios: '76.75' } }],
  calculer(e, c) {
    type Mv = { dateValeur: string; libelle?: string; montant: Decimal };
    const mvts = [...(e.mouvements as Mv[])].filter((m) => comparer(m.dateValeur, e.debut) >= 0 && comparer(m.dateValeur, e.fin) <= 0).sort((a, b) => comparer(a.dateValeur, b.dateValeur));
    let solde: Decimal = e.soldeInitial;
    let date_ = e.debut as string;
    let nombres = ZERO;
    let pfd = positif(solde.neg());
    const lignes: Record<string, string>[] = [];
    const avancer = (jusqua: string, libelle: string) => {
      const j = joursEntre(date_, jusqua);
      const nb = solde.isNegative() ? solde.neg().times(j) : ZERO;
      nombres = nombres.plus(nb);
      lignes.push({ du: date_, libelle, solde: solde.toFixed(2), jours: String(j), nombres: nb.toFixed(2) });
    };
    for (const m of mvts) {
      avancer(m.dateValeur, 'Solde');
      solde = solde.plus(m.montant);
      date_ = m.dateValeur;
      pfd = max(pfd, solde.neg());
    }
    // la période inclut le dernier jour
    const j = joursEntre(date_, e.fin) + 1;
    const nb = solde.isNegative() ? solde.neg().times(j) : ZERO;
    nombres = nombres.plus(nb);
    lignes.push({ du: date_, libelle: 'Solde final', solde: solde.toFixed(2), jours: String(j), nombres: nb.toFixed(2) });
    c.calc('nombresDebiteurs', 'Nombres débiteurs', 'Σ solde débiteur × jours', nombres);
    const int = c.calc('interets', 'Intérêts débiteurs', `${fr(nombres)} × ${fp(e.tauxDebiteur)} / 360`, euros(nombres.times(e.tauxDebiteur).div(360)));
    c.res('plusFortDecouvert', 'Plus fort découvert', pfd);
    const cp = c.calc('commissionPfd', 'Commission du plus fort découvert', `${fr(pfd)} × ${fp(e.cpfd)}`, euros(pfd.times(e.cpfd)));
    const debits = somme(mvts.filter((m) => m.montant.isNegative()).map((m) => m.montant.neg()));
    const cm = c.calc('commissionMvt', 'Commission de mouvement', `${fr(debits)} × ${fp(e.commissionMouvement)}`, euros(debits.times(e.commissionMouvement)));
    const total = c.calc('totalAgios', 'Total des agios', 'intérêts + commissions', int.plus(cp).plus(cm), 'EUR', { principal: true });
    if (nombres.greaterThan(0)) {
      const teg = c.calc('tauxEffectif', 'Taux effectif du découvert', `${fr(total)} × 360 / ${fr(nombres)}`, total.times(360).div(nombres), '%');
      c.verifier(teg.lessThanOrEqualTo(e.tauxUsure), 'USURE', 'Taux effectif inférieur au taux de l’usure.', `Taux effectif (${fp(teg, 2)}) supérieur au taux de l’usure (${fp(e.tauxUsure, 2)}) : taux usuraire.`);
    }
    c.tableau({
      titre: 'Échelle d’intérêts',
      colonnes: [
        { cle: 'du', libelle: 'Du', unite: 'date' },
        { cle: 'libelle', libelle: 'Libellé', unite: 'texte' },
        { cle: 'solde', libelle: 'Solde', unite: 'EUR' },
        { cle: 'jours', libelle: 'Jours', unite: 'entier' },
        { cle: 'nombres', libelle: 'Nombres débiteurs', unite: 'nombre' },
      ],
      lignes,
    });
    c.ecriture('Agios bancaires', [
      { compte: '6615', intitule: 'Intérêts des comptes courants et dépôts', debit: int },
      { compte: '627', intitule: 'Services bancaires (commissions)', debit: cp.plus(cm) },
      { compte: '512', intitule: 'Banque', credit: total },
    ], 'BQ');
  },
});

export const escompte = formule({
  id: 'escompte-dailly',
  moteur: M,
  nom: 'Escompte commercial et cession Dailly',
  categorie: 'Crédits court terme',
  description: 'Calcule l’escompte de chaque effet (jours de banque, minimum de jours), les commissions et leur TVA, le net crédité et le taux réel de revient du financement.',
  expression: 'Escompte = nominal × taux × jours / 360 (jours = max(échéance − remise + jours de banque ; minimum)) ; net = Σ nominaux − escompte − commissions TTC',
  references: [
    { texte: 'Code de commerce art. L.511-1 et s. — lettre de change' },
    { texte: 'Code monétaire et financier art. L.313-23 à L.313-34 — cession de créances professionnelles (Dailly)' },
    { texte: 'CGI art. 261 C-1° — exonération de TVA des intérêts' },
  ],
  champs: [
    choix('operation', 'Opération', [
      ['escompte', 'Escompte d’effets de commerce'],
      ['dailly', 'Cession Dailly'],
    ]),
    date('dateRemise', 'Date de remise / cession', { defaut: '2025-04-10' }),
    table('effets', 'Effets / créances', [texte('reference', 'Référence'), montant('nominal', 'Nominal'), date('echeance', 'Échéance')], {
      min: '1',
      defaut: [
        { reference: 'LCR 1021', nominal: '8400', echeance: '2025-05-31' },
        { reference: 'LCR 1022', nominal: '3250', echeance: '2025-06-15' },
        { reference: 'LCR 1023', nominal: '960', echeance: '2025-04-18' },
      ],
    }),
    taux('taux', 'Taux d’escompte annuel', { defaut: '6.2' }),
    entier('joursBanque', 'Jours de banque', { defaut: 1, min: '0' }),
    entier('minimumJours', 'Minimum de jours', { defaut: 10, min: '0' }),
    montant('commissionParEffet', 'Commission HT par effet', { defaut: '6.50' }),
    taux('tvaCommissions', 'TVA sur commissions', { defaut: '20' }),
  ],
  exemples: [{ titre: 'Bordereau de 3 LCR', entrees: {}, attendu: { totalNominal: '12610.00', escompte: '114.38', commissionsHT: '19.50', net: '12472.22' } }],
  calculer(e, c) {
    type Ef = { reference: string; nominal: Decimal; echeance: string };
    let esc = ZERO;
    let nomJours = ZERO;
    const lignes = (e.effets as Ef[]).map((f) => {
      const j = Math.max(joursEntre(e.dateRemise, f.echeance) + e.joursBanque, e.minimumJours);
      const x = euros(f.nominal.times(e.taux).times(j).div(360));
      esc = esc.plus(x);
      nomJours = nomJours.plus(f.nominal.times(j));
      return { reference: f.reference, nominal: f.nominal.toFixed(2), echeance: f.echeance, jours: String(j), escompte: x.toFixed(2) };
    });
    const tn = c.calc('totalNominal', 'Total des nominaux', 'Σ nominaux', somme((e.effets as Ef[]).map((f) => f.nominal)));
    c.calc('escompte', 'Escompte', 'Σ nominal × taux × jours / 360', esc);
    const com = c.calc('commissionsHT', 'Commissions HT', `${(e.effets as Ef[]).length} × ${fr(e.commissionParEffet)}`, euros(d(e.commissionParEffet).times((e.effets as Ef[]).length)));
    const tva = c.calc('tvaCommissions', 'TVA sur commissions', `${fr(com)} × ${fp(e.tvaCommissions)}`, euros(com.times(e.tvaCommissions)));
    const net = c.calc('net', 'Net crédité', `${fr(tn)} − ${fr(esc)} − ${fr(com)} − ${fr(tva)}`, tn.minus(esc).minus(com).minus(tva), 'EUR', { principal: true });
    if (nomJours.greaterThan(0)) c.calc('tauxReel', 'Taux réel de revient (HT)', '(escompte + commissions) × 360 / Σ (nominal × jours)', esc.plus(com).times(360).div(nomJours), '%');
    c.tableau({
      titre: 'Bordereau',
      colonnes: [
        { cle: 'reference', libelle: 'Référence', unite: 'texte' },
        { cle: 'nominal', libelle: 'Nominal', unite: 'EUR' },
        { cle: 'echeance', libelle: 'Échéance', unite: 'date' },
        { cle: 'jours', libelle: 'Jours', unite: 'entier' },
        { cle: 'escompte', libelle: 'Escompte', unite: 'EUR' },
      ],
      lignes,
    });
    const dailly = e.operation === 'dailly';
    c.ecriture(dailly ? 'Cession Dailly' : 'Remise à l’escompte', [
      { compte: '512', intitule: 'Banque', debit: net },
      { compte: '6616', intitule: 'Intérêts bancaires et sur opérations de financement', debit: esc },
      { compte: '627', intitule: 'Services bancaires', debit: com },
      { compte: '44566', intitule: 'TVA déductible sur ABS', debit: tva },
      { compte: dailly ? '519' : '5114', intitule: dailly ? 'Concours bancaires — mobilisation de créances' : 'Effets à l’escompte', credit: tn },
    ], 'BQ');
    if (!dailly) c.ctrl('info', 'ENGAGEMENT', 'Les effets escomptés non échus sont des engagements hors bilan à mentionner dans l’annexe.');
  },
});

export const affacturage = formule({
  id: 'affacturage',
  moteur: M,
  nom: 'Coût de l’affacturage',
  categorie: 'Crédits court terme',
  description: 'Coût annuel d’un contrat d’affacturage : commission d’affacturage (TVA en sus), commission de financement sur l’encours financé, retenue de garantie, financement mobilisable et coût rapporté au CA.',
  expression: 'Commission d’affacturage = CA cédé TTC × taux ; financement = CA cédé × (1 − retenue) × taux × délai / 360 ; coût = commissions HT',
  references: [{ texte: 'Code monétaire et financier art. L.313-23 et s. ; subrogation conventionnelle (Code civil art. 1346-1)' }],
  champs: [
    montant('caCedeTTC', 'CA cédé annuel TTC', { defaut: '1800000' }),
    taux('commission', 'Commission d’affacturage', { defaut: '0.6' }),
    taux('tauxFinancement', 'Taux de la commission de financement (annuel)', { defaut: '5.4' }),
    nombre('delaiMoyen', 'Délai moyen de règlement des clients (jours)', { defaut: '58' }),
    taux('retenue', 'Retenue de garantie', { defaut: '10' }),
    taux('tva', 'TVA sur commission d’affacturage', { defaut: '20' }),
  ],
  exemples: [{ titre: 'CA cédé 1,8 M€', entrees: {}, attendu: { commissionAffacturage: '10800.00', commissionFinancement: '14094.00', coutTotalHT: '24894.00', financementDisponible: '1620000.00' } }],
  calculer(e, c) {
    const ca: Decimal = e.caCedeTTC;
    const ca_ = c.calc('commissionAffacturage', 'Commission d’affacturage HT', `${fr(ca)} × ${fp(e.commission)}`, euros(ca.times(e.commission)));
    c.calc('tvaCommission', 'TVA sur commission', `${fr(ca_)} × ${fp(e.tva)}`, euros(ca_.times(e.tva)));
    const fin = ca.times(UN.minus(e.retenue));
    c.calc('financementDisponible', 'Montant financé annuel', `${fr(ca)} × (1 − ${fp(e.retenue)})`, euros(fin));
    const cf = c.calc('commissionFinancement', 'Commission de financement', `${fr(fin)} × ${fp(e.tauxFinancement)} × ${frn(e.delaiMoyen)} / 360`, euros(fin.times(e.tauxFinancement).times(e.delaiMoyen).div(360)));
    const tot = c.calc('coutTotalHT', 'Coût total HT', 'commission d’affacturage + financement', ca_.plus(cf), 'EUR', { principal: true });
    c.calc('coutSurCa', 'Coût en % du CA cédé', `${fr(tot)} / ${fr(ca)}`, tot.div(ca), '%');
    c.calc('encoursMoyen', 'Encours moyen financé', `${fr(fin)} × ${frn(e.delaiMoyen)} / 360`, euros(fin.times(e.delaiMoyen).div(360)));
    c.calc('tauxGlobal', 'Coût rapporté à l’encours financé', 'coût / encours moyen', diviser(tot, fin.times(e.delaiMoyen).div(360)), '%');
  },
});

export const budgetTresorerie = formule({
  id: 'budget-tresorerie',
  moteur: M,
  nom: 'Budget de trésorerie mensuel',
  categorie: 'Prévisionnel',
  description: 'Transforme les ventes et achats en encaissements et décaissements décalés selon les délais clients et fournisseurs, ajoute les autres flux, calcule la trésorerie de fin de mois et détecte les tensions.',
  expression: 'Encaissements(m) = Σ CA(m − k) × %k ; décaissements(m) = Σ achats(m − k) × %k + autres ; trésorerie(m) = trésorerie(m − 1) + encaissements − décaissements',
  references: [{ texte: 'Gestion de trésorerie — budget des encaissements et des décaissements' }],
  champs: [
    montant('tresorerieInitiale', 'Trésorerie de début', { defaut: '25000' }),
    taux('clientsComptant', 'Clients payés au comptant', { defaut: '20', groupe: 'Délais clients' }),
    taux('clients30', 'Clients à 30 jours', { defaut: '50', groupe: 'Délais clients' }),
    taux('clients60', 'Clients à 60 jours', { defaut: '30', groupe: 'Délais clients' }),
    taux('fournisseursComptant', 'Fournisseurs payés au comptant', { defaut: '0', groupe: 'Délais fournisseurs' }),
    taux('fournisseurs30', 'Fournisseurs à 30 jours', { defaut: '40', groupe: 'Délais fournisseurs' }),
    taux('fournisseurs60', 'Fournisseurs à 60 jours', { defaut: '60', groupe: 'Délais fournisseurs' }),
    montant('creancesInitialesM1', 'Créances antérieures encaissées en M1', { defaut: '38000', groupe: 'Encours d’ouverture' }),
    montant('creancesInitialesM2', 'Créances antérieures encaissées en M2', { defaut: '14000', groupe: 'Encours d’ouverture' }),
    montant('dettesInitialesM1', 'Dettes fournisseurs antérieures payées en M1', { defaut: '21000', groupe: 'Encours d’ouverture' }),
    montant('dettesInitialesM2', 'Dettes fournisseurs antérieures payées en M2', { defaut: '9000', groupe: 'Encours d’ouverture' }),
    table(
      'mois',
      'Prévisions mensuelles (TTC)',
      [
        texte('mois', 'Mois'),
        montant('ventes', 'Ventes TTC'),
        montant('achats', 'Achats TTC'),
        montant('salaires', 'Salaires et charges', { defaut: '0' }),
        montant('autresDecaissements', 'Autres décaissements (loyers, TVA, impôts…)', { defaut: '0' }),
        montant('investissements', 'Investissements', { defaut: '0' }),
        montant('autresEncaissements', 'Autres encaissements (emprunts, subventions…)', { defaut: '0' }),
      ],
      {
        min: '1',
        defaut: [
          { mois: 'Janvier', ventes: '60000', achats: '30000', salaires: '22000', autresDecaissements: '6000', investissements: '0', autresEncaissements: '0' },
          { mois: 'Février', ventes: '55000', achats: '28000', salaires: '22000', autresDecaissements: '9500', investissements: '0', autresEncaissements: '0' },
          { mois: 'Mars', ventes: '72000', achats: '41000', salaires: '22000', autresDecaissements: '6000', investissements: '35000', autresEncaissements: '30000' },
          { mois: 'Avril', ventes: '80000', achats: '45000', salaires: '23000', autresDecaissements: '11000', investissements: '0', autresEncaissements: '0' },
          { mois: 'Mai', ventes: '78000', achats: '40000', salaires: '23000', autresDecaissements: '6000', investissements: '0', autresEncaissements: '0' },
          { mois: 'Juin', ventes: '90000', achats: '47000', salaires: '23000', autresDecaissements: '14500', investissements: '0', autresEncaissements: '0' },
        ],
      },
    ),
  ],
  exemples: [{ titre: 'Semestre', entrees: {}, attendu: { tresorerieFinale: '33600.00', tresorerieMin: '26000.00', moisTension: '0' } }],
  calculer(e, c) {
    type Mo = { mois: string; ventes: Decimal; achats: Decimal; salaires: Decimal; autresDecaissements: Decimal; investissements: Decimal; autresEncaissements: Decimal };
    const ms = e.mois as Mo[];
    const sc = somme([e.clientsComptant, e.clients30, e.clients60]);
    const sf = somme([e.fournisseursComptant, e.fournisseurs30, e.fournisseurs60]);
    if (!sc.equals(1)) c.ctrl('erreur', 'REPARTITION_CLIENTS', `La répartition des délais clients totalise ${fp(sc)} au lieu de 100 %.`);
    if (!sf.equals(1)) c.ctrl('erreur', 'REPARTITION_FOURNISSEURS', `La répartition des délais fournisseurs totalise ${fp(sf)} au lieu de 100 %.`);
    let treso: Decimal = e.tresorerieInitiale;
    let tmin: Decimal | null = null;
    let tensions = 0;
    const lignes = ms.map((m, i) => {
      const v = (k: number) => (i - k >= 0 ? ms[i - k].ventes : ZERO);
      const a = (k: number) => (i - k >= 0 ? ms[i - k].achats : ZERO);
      const enc = euros(somme([v(0).times(e.clientsComptant), v(1).times(e.clients30), v(2).times(e.clients60), i === 0 ? e.creancesInitialesM1 : ZERO, i === 1 ? e.creancesInitialesM2 : ZERO, m.autresEncaissements]));
      const dec = euros(somme([a(0).times(e.fournisseursComptant), a(1).times(e.fournisseurs30), a(2).times(e.fournisseurs60), i === 0 ? e.dettesInitialesM1 : ZERO, i === 1 ? e.dettesInitialesM2 : ZERO, m.salaires, m.autresDecaissements, m.investissements]));
      const debut = treso;
      treso = treso.plus(enc).minus(dec);
      tmin = tmin === null ? treso : min(tmin, treso);
      if (treso.isNegative()) {
        tensions++;
        c.ctrl('avertissement', 'TENSION', `${m.mois} : trésorerie négative (${fe(treso)}).`);
      }
      return { mois: m.mois, debut: debut.toFixed(2), encaissements: enc.toFixed(2), decaissements: dec.toFixed(2), solde: enc.minus(dec).toFixed(2), fin: treso.toFixed(2) };
    });
    c.calc('tresorerieFinale', 'Trésorerie de fin de période', 'trésorerie initiale + Σ (encaissements − décaissements)', treso, 'EUR', { principal: true });
    c.calc('tresorerieMin', 'Point bas de trésorerie', 'min des soldes de fin de mois', tmin ?? treso);
    c.res('moisTension', 'Mois en tension', tensions, 'entier');
    c.res('besoinFinancement', 'Besoin de financement court terme', positif((tmin ?? treso).neg()));
    c.tableau({
      titre: 'Budget de trésorerie',
      colonnes: [
        { cle: 'mois', libelle: 'Mois', unite: 'texte' },
        { cle: 'debut', libelle: 'Trésorerie début', unite: 'EUR' },
        { cle: 'encaissements', libelle: 'Encaissements', unite: 'EUR' },
        { cle: 'decaissements', libelle: 'Décaissements', unite: 'EUR' },
        { cle: 'solde', libelle: 'Solde du mois', unite: 'EUR' },
        { cle: 'fin', libelle: 'Trésorerie fin', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'lignes', x: 'mois', series: ['encaissements', 'decaissements', 'fin'] },
    });
  },
});

export const plan13Semaines = formule({
  id: 'plan-13-semaines',
  moteur: M,
  nom: 'Plan de trésorerie à 13 semaines',
  categorie: 'Prévisionnel',
  description: 'Prévision glissante hebdomadaire : solde de chaque semaine, comparaison au seuil de sécurité et à la ligne de crédit autorisée, besoin de financement.',
  expression: 'Trésorerie(s) = trésorerie(s − 1) + encaissements(s) − décaissements(s) ; alerte si < seuil ; besoin = max(0 ; −point bas − ligne autorisée)',
  references: [{ texte: 'Pratique de gestion de trésorerie (13-week cash flow forecast)' }],
  champs: [
    montant('tresorerieInitiale', 'Trésorerie disponible', { defaut: '42000' }),
    montant('seuil', 'Seuil de sécurité', { defaut: '15000' }),
    montant('ligneAutorisee', 'Découvert / ligne de crédit autorisée', { defaut: '30000' }),
    table('semaines', 'Semaines', [texte('semaine', 'Semaine'), montant('encaissements', 'Encaissements'), montant('decaissements', 'Décaissements')], {
      min: '1',
      defaut: Array.from({ length: 13 }, (_, i) => ({
        semaine: `S${i + 1}`,
        encaissements: String([18000, 22000, 15000, 30000, 12000, 26000, 19000, 24000, 14000, 33000, 17000, 21000, 28000][i]),
        decaissements: String([21000, 16000, 38000, 19000, 24000, 18000, 41000, 17000, 22000, 20000, 39000, 18000, 23000][i]),
      })),
    }),
  ],
  exemples: [{ titre: '13 semaines', entrees: {}, attendu: { tresorerieFinale: '5000.00', pointBas: '-3000.00', semainesSousSeuil: '6', besoinFinancement: '0.00' } }],
  calculer(e, c) {
    type S = { semaine: string; encaissements: Decimal; decaissements: Decimal };
    let t: Decimal = e.tresorerieInitiale;
    let bas = t;
    let sous = 0;
    const lignes = (e.semaines as S[]).map((s) => {
      t = t.plus(s.encaissements).minus(s.decaissements);
      bas = min(bas, t);
      const alerte = t.lessThan(e.seuil);
      if (alerte) sous++;
      return { semaine: s.semaine, encaissements: s.encaissements.toFixed(2), decaissements: s.decaissements.toFixed(2), tresorerie: t.toFixed(2), seuil: d(e.seuil).toFixed(2), statut: t.isNegative() ? 'Découvert' : alerte ? 'Sous le seuil' : 'OK' };
    });
    c.calc('tresorerieFinale', 'Trésorerie en semaine 13', 'solde glissant', t, 'EUR', { principal: true });
    c.calc('pointBas', 'Point bas', 'min des soldes', bas);
    c.res('semainesSousSeuil', 'Semaines sous le seuil de sécurité', sous, 'entier');
    const besoin = c.calc('besoinFinancement', 'Besoin de financement au-delà de la ligne', `max(0 ; −${fr(bas)} − ${fr(e.ligneAutorisee)})`, positif(bas.neg().minus(e.ligneAutorisee)));
    if (sous) c.ctrl('avertissement', 'SEUIL', `${sous} semaine(s) sous le seuil de sécurité de ${fe(e.seuil)}.`);
    if (besoin.greaterThan(0)) c.ctrl('erreur', 'RUPTURE', `Rupture de trésorerie : la ligne autorisée est insuffisante de ${fe(besoin)}.`);
    c.tableau({
      titre: 'Plan glissant',
      colonnes: [
        { cle: 'semaine', libelle: 'Semaine', unite: 'texte' },
        { cle: 'encaissements', libelle: 'Encaissements', unite: 'EUR' },
        { cle: 'decaissements', libelle: 'Décaissements', unite: 'EUR' },
        { cle: 'tresorerie', libelle: 'Trésorerie', unite: 'EUR' },
        { cle: 'seuil', libelle: 'Seuil', unite: 'EUR' },
        { cle: 'statut', libelle: 'Statut', unite: 'texte' },
      ],
      lignes,
      graphique: { type: 'lignes', x: 'semaine', series: ['tresorerie', 'seuil'] },
    });
  },
});

export const interets = formule({
  id: 'interets-placement',
  moteur: M,
  nom: 'Intérêts simples et composés, valeur acquise et actuelle',
  categorie: 'Placements',
  description: 'Intérêts simples ou composés (capitalisation annuelle, mensuelle…), valeur acquise d’un placement ou valeur actuelle d’une somme future, taux actuariel équivalent.',
  expression: 'Simples : I = C × i × n ; composés : Cn = C × (1 + i/k)^(n×k) ; valeur actuelle : C0 = Cn / (1 + i/k)^(n×k)',
  references: [{ texte: 'Mathématiques financières — capitalisation et actualisation' }],
  champs: [
    choix('calcul', 'Calcul', [
      ['simples', 'Intérêts simples'],
      ['composes', 'Intérêts composés (valeur acquise)'],
      ['actuelle', 'Valeur actuelle d’une somme future'],
    ]),
    montant('montant', 'Capital placé (ou somme future)', { defaut: '50000' }),
    taux('taux', 'Taux annuel', { defaut: '3.5' }),
    nombre('duree', 'Durée (années)', { defaut: '5', min: '0' }),
    choix('capitalisation', 'Capitalisation', [
      ['1', 'Annuelle'],
      ['2', 'Semestrielle'],
      ['4', 'Trimestrielle'],
      ['12', 'Mensuelle'],
    ], { visibleSi: { champ: 'calcul', valeurs: ['composes', 'actuelle'] } }),
  ],
  exemples: [
    { titre: 'Composés annuels', entrees: { calcul: 'composes' }, attendu: { valeur: '59384.32', interets: '9384.32' } },
    { titre: 'Simples', entrees: {}, attendu: { interets: '8750.00', valeur: '58750.00' } },
    { titre: 'Valeur actuelle', entrees: { calcul: 'actuelle', montant: '59384.32' }, attendu: { valeur: '50000.00' } },
  ],
  calculer(e, c) {
    const C: Decimal = e.montant;
    const i: Decimal = e.taux;
    const n: Decimal = e.duree;
    if (e.calcul === 'simples') {
      const I = c.calc('interets', 'Intérêts simples', `${fr(C)} × ${fp(i)} × ${frn(n)}`, euros(C.times(i).times(n)), 'EUR', { principal: true });
      c.calc('valeur', 'Valeur acquise', `${fr(C)} + ${fr(I)}`, C.plus(I));
      return;
    }
    const k = Number(e.capitalisation);
    const f = UN.plus(i.div(k)).pow(n.times(k));
    c.etape('Facteur de capitalisation', `(1 + ${fp(i)}/${k})^(${frn(n)} × ${k})`, f, 'nombre');
    c.calc('tauxActuariel', 'Taux annuel actuariel équivalent', `(1 + ${fp(i)}/${k})^${k} − 1`, UN.plus(i.div(k)).pow(k).minus(1), '%', { decimales: 4 });
    if (e.calcul === 'composes') {
      const v = c.calc('valeur', 'Valeur acquise', `${fr(C)} × ${frn(f, 8)}`, euros(C.times(f)), 'EUR', { principal: true });
      c.calc('interets', 'Intérêts composés', `${fr(v)} − ${fr(C)}`, v.minus(C));
    } else {
      const v = c.calc('valeur', 'Valeur actuelle', `${fr(C)} / ${frn(f, 8)}`, euros(C.div(f)), 'EUR', { principal: true });
      c.calc('escompte', 'Escompte rationnel', `${fr(C)} − ${fr(v)}`, C.minus(v));
    }
  },
});

export const obligation = formule({
  id: 'rendement-obligation',
  moteur: M,
  nom: 'Obligation : taux actuariel, duration, sensibilité',
  categorie: 'Placements',
  description: 'Taux de rendement actuariel d’une obligation à coupon fixe acquise à un prix donné, duration de Macaulay, duration modifiée (sensibilité) et convexité.',
  expression: 'Prix = Σ coupon / (1 + r)^t + remboursement / (1 + r)^n ; D = Σ t × CFt / (1 + r)^t / prix ; S = −D / (1 + r)',
  references: [{ texte: 'Mathématiques financières — évaluation obligataire' }],
  champs: [
    montant('nominal', 'Valeur nominale', { defaut: '1000' }),
    montant('prix', 'Prix d’acquisition (pied de coupon)', { defaut: '965' }),
    taux('coupon', 'Taux du coupon annuel', { defaut: '3' }),
    entier('annees', 'Années restant à courir', { defaut: 6, min: '1', max: '100' }),
    taux('primeRemboursement', 'Prix de remboursement (% du nominal)', { defaut: '100' }),
  ],
  exemples: [{ titre: 'Obligation 3 % à 6 ans', entrees: {}, attendu: { tauxActuariel: '3.6603', duration: '5.5708', sensibilite: '-5.3741' } }],
  calculer(e, c) {
    const nom: Decimal = e.nominal;
    const cp = nom.times(e.coupon);
    const n: number = e.annees;
    const flux: Decimal[] = [d(e.prix).neg()];
    for (let t = 1; t <= n; t++) flux.push(t === n ? cp.plus(nom.times(e.primeRemboursement)) : cp);
    const r = tri(flux);
    if (!r) {
      c.ctrl('erreur', 'TRA', 'Taux actuariel introuvable.');
      return;
    }
    c.calc('tauxActuariel', 'Taux de rendement actuariel', 'r tel que prix = Σ flux actualisés', r, '%', { decimales: 4, principal: true });
    c.res('coupon', 'Coupon annuel', cp);
    let num = ZERO;
    let conv = ZERO;
    for (let t = 1; t <= n; t++) {
      const va = flux[t].div(UN.plus(r).pow(t));
      num = num.plus(va.times(t));
      conv = conv.plus(va.times(t * (t + 1)));
    }
    const dur = c.calc('duration', 'Duration de Macaulay', 'Σ t × VA(CFt) / prix', num.div(e.prix), 'annees', { decimales: 4 });
    c.calc('sensibilite', 'Sensibilité (duration modifiée)', `−${frn(dur, 4)} / (1 + ${fp(r, 4)})`, dur.neg().div(UN.plus(r)), 'nombre', { decimales: 4 });
    c.calc('convexite', 'Convexité', 'Σ t(t+1) VA(CFt) / [prix × (1 + r)²]', conv.div(d(e.prix).times(UN.plus(r).pow(2))), 'nombre', { decimales: 4 });
    c.res('rendementCourant', 'Rendement courant (coupon / prix)', cp.div(e.prix), '%');
    c.verifier(van(r, flux).abs().lessThan('0.000001'), 'TRA_EXACT', 'Le taux actuariel annule exactement la VAN des flux.', 'Résidu de VAN non nul.', 'avertissement');
  },
});

export const annuites = formule({
  id: 'annuites',
  moteur: M,
  nom: 'Valeur actuelle et valeur acquise d’une suite d’annuités',
  categorie: 'Placements',
  description: 'Valeur actuelle et valeur acquise d’une suite de versements constants en fin ou en début de période (épargne, loyers, rentes).',
  expression: 'VA = a × (1 − (1 + i)^−n) / i ; VF = a × ((1 + i)^n − 1) / i ; × (1 + i) en début de période',
  references: [{ texte: 'Mathématiques financières — annuités constantes' }],
  champs: [
    montant('annuite', 'Versement périodique', { defaut: '500' }),
    taux('taux', 'Taux périodique', { defaut: '0.25' }),
    entier('n', 'Nombre de versements', { defaut: 120, min: '1', max: '1200' }),
    choix('terme', 'Versements', [
      ['echu', 'En fin de période'],
      ['echoir', 'En début de période'],
    ]),
  ],
  exemples: [{ titre: '500 €/mois pendant 10 ans à 0,25 %/mois', entrees: {}, attendu: { valeurActuelle: '51780.88', valeurAcquise: '69870.71', totalVerse: '60000.00' } }],
  calculer(e, c) {
    const a: Decimal = e.annuite;
    const i: Decimal = e.taux;
    const n: number = e.n;
    const f = e.terme === 'echoir' ? UN.plus(i) : UN;
    const va = i.isZero() ? a.times(n) : a.times(UN.minus(UN.plus(i).pow(-n))).div(i).times(f);
    const vf = i.isZero() ? a.times(n) : a.times(UN.plus(i).pow(n).minus(1)).div(i).times(f);
    c.calc('valeurActuelle', 'Valeur actuelle', `${fr(a)} × (1 − (1 + ${fp(i)})^−${n}) / ${fp(i)}${e.terme === 'echoir' ? ' × (1 + i)' : ''}`, euros(va), 'EUR', { principal: true });
    c.calc('valeurAcquise', 'Valeur acquise', `${fr(a)} × ((1 + ${fp(i)})^${n} − 1) / ${fp(i)}${e.terme === 'echoir' ? ' × (1 + i)' : ''}`, euros(vf), 'EUR', { principal: true });
    const tv = c.calc('totalVerse', 'Total versé', `${fr(a)} × ${n}`, a.times(n));
    c.calc('interetsCumules', 'Intérêts cumulés', 'valeur acquise − total versé', euros(vf).minus(tv));
  },
});

export const loyerCreditBail = formule({
  id: 'loyer-credit-bail',
  moteur: M,
  nom: 'Loyer de crédit-bail ou de location financière',
  categorie: 'Emprunts',
  description: 'Calcule le loyer périodique constant à partir de la valeur du bien, du taux, de la durée et de la valeur résiduelle (option d’achat), terme échu ou à échoir.',
  expression: 'Loyer échu = (V − VR / (1 + i)^n) × i / (1 − (1 + i)^−n) ; à échoir : loyer échu / (1 + i)',
  references: [{ texte: 'Code monétaire et financier art. L.313-7 — crédit-bail' }],
  champs: [
    montant('valeur', 'Valeur du bien HT', { defaut: '60000' }),
    montant('valeurResiduelle', 'Valeur résiduelle / option d’achat', { defaut: '600' }),
    taux('taux', 'Taux annuel', { defaut: '4.5' }),
    entier('nbLoyers', 'Nombre de loyers', { defaut: 20, min: '1', max: '600' }),
    champPeriodicite,
    choix('terme', 'Paiement', [
      ['echoir', 'Terme à échoir'],
      ['echu', 'Terme échu'],
    ]),
  ],
  exemples: [{ titre: 'Matériel 60 000 €', entrees: { periodicite: '4' }, attendu: { loyer: '3302.84' } }],
  calculer(e, c) {
    const k = Number(e.periodicite);
    const i = d(e.taux).div(k);
    let l = annuiteConstante(e.valeur, i, e.nbLoyers, e.valeurResiduelle);
    if (e.terme === 'echoir') l = l.div(UN.plus(i));
    const loyer = c.calc('loyer', 'Loyer périodique HT', `(${fr(e.valeur)} − ${fr(e.valeurResiduelle)} / (1 + ${fp(i)})^${e.nbLoyers}) × i / (1 − (1 + i)^−${e.nbLoyers})${e.terme === 'echoir' ? ' / (1 + i)' : ''}`, euros(l), 'EUR', { principal: true });
    const tot = c.calc('totalLoyers', 'Total des loyers', `${fr(loyer)} × ${e.nbLoyers}`, loyer.times(e.nbLoyers));
    c.calc('coutFinancement', 'Coût du financement', 'loyers + option − valeur du bien', tot.plus(e.valeurResiduelle).minus(e.valeur));
    c.ctrl('info', 'RETRAITEMENT', 'Retraitement du contrat (dette + amortissement) : voir le moteur Amortissements — « Retraitement du crédit-bail ».');
  },
});

export const formulesTresorerie = [emprunt, empruntTauxVariable, agios, escompte, affacturage, budgetTresorerie, plan13Semaines, interets, obligation, annuites, loyerCreditBail];

