/** MOTEUR 6 (suite) — Déclarations : contrôle du FEC, DAS2, IFU / prélèvement forfaitaire. */
import {
  booleen,
  comparer,
  d,
  dateOperation,
  Decimal,
  estDateIso,
  euros,
  fe,
  formule,
  fr,
  montant,
  pct,
  somme,
  table,
  texte,
  ZERO,
  date,
} from '../noyau';
import { BaremeDivers } from './baremes';

const M = 'fiscal' as const;

export const COLONNES_FEC = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
];

const OBLIGATOIRES = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'ValidDate'];

const FEC_EXEMPLE = [
  COLONNES_FEC.join('|'),
  'AC|Achats|1|20240105|607000|Achats de marchandises|||F101|20240105|Facture Dupont|1000,00|0,00|||20240110||',
  'AC|Achats|1|20240105|445660|TVA déductible|||F101|20240105|Facture Dupont|200,00|0,00|||20240110||',
  'AC|Achats|1|20240105|401000|Fournisseurs|401DUP|Dupont|F101|20240105|Facture Dupont|0,00|1200,00|||20240110||',
  'VE|Ventes|2|20240112|411000|Clients|411MAR|Martin|V55|20240112|Facture Martin|2400,00|0,00|||20240115||',
  'VE|Ventes|2|20240112|706000|Prestations|||V55|20240112|Facture Martin|0,00|2000,00|||20240115||',
  'VE|Ventes|2|20240112|445710|TVA collectée|||V55|20240112|Facture Martin|0,00|400,00|||20240115||',
].join('\n');

/** Montant FEC : virgule décimale, éventuellement vide. */
function montantFec(s: string | undefined): Decimal | null {
  const v = (s ?? '').trim();
  if (v === '') return ZERO;
  return /^-?\d+([.,]\d{1,2})?$/.test(v) ? d(v.replace(',', '.')) : null;
}

function dateFec(s: string | undefined): string | null {
  const v = (s ?? '').trim();
  if (!/^\d{8}$/.test(v)) return null;
  const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return estDateIso(iso) ? iso : null;
}

export const controleFec = formule({
  id: 'controle-fec',
  moteur: M,
  nom: 'Contrôle du fichier des écritures comptables (FEC)',
  categorie: 'Déclarations',
  description:
    'Analyse un FEC (séparateur | ou tabulation) : structure des 18 colonnes, champs obligatoires, formats de dates et montants, équilibre de chaque écriture et du fichier, numérotation et chronologie de validation, appartenance des dates à l’exercice.',
  expression: '18 colonnes A47 A-1 ; Σ débit = Σ crédit par EcritureNum et au total ; dates AAAAMMJJ dans l’exercice ; ValidDate ≥ EcritureDate',
  references: [
    { texte: 'LPF art. L.47 A-I — remise du FEC lors d’un contrôle' },
    { texte: 'LPF art. A.47 A-1 — format et contenu du fichier' },
    { texte: 'CGI art. 1729 D — amende pour défaut de présentation' },
  ],
  champs: [
    texte('fichier', 'Contenu du FEC', { defaut: FEC_EXEMPLE, aide: 'Coller le fichier texte (première ligne = en-têtes).' }),
    date('debutExercice', 'Début de l’exercice', { defaut: '2024-01-01' }),
    date('finExercice', 'Fin de l’exercice', { defaut: '2024-12-31' }),
  ],
  exemples: [
    { titre: 'FEC conforme', entrees: {}, attendu: { lignes: '6', ecritures: '2', totalDebit: '3600.00', totalCredit: '3600.00', anomalies: '0' } },
    {
      titre: 'Écriture déséquilibrée',
      entrees: { fichier: FEC_EXEMPLE.replace('0,00|400,00|', '0,00|399,00|') },
      attendu: { anomalies: '1' },
    },
  ],
  calculer(e, c) {
    const lignesBrutes = (e.fichier as string).split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lignesBrutes.length < 2) {
      c.ctrl('erreur', 'VIDE', 'Le fichier ne contient pas d’écritures.');
      return;
    }
    const sep = lignesBrutes[0].includes('\t') ? '\t' : '|';
    const entete = lignesBrutes[0].split(sep).map((x) => x.trim().replace(/^﻿/, ''));
    const anomalies: { ligne: string; type: string; detail: string }[] = [];
    const ajouter = (ligne: number | string, type: string, detail: string) => {
      if (anomalies.length < 500) anomalies.push({ ligne: String(ligne), type, detail });
    };
    const manquantes = COLONNES_FEC.slice(0, 16).filter((col) => !entete.includes(col));
    if (manquantes.length) ajouter(1, 'Structure', `Colonnes manquantes : ${manquantes.join(', ')}`);
    const idx = (col: string) => entete.indexOf(col);
    const parEcriture = new Map<string, { debit: Decimal; credit: Decimal; ligne: number }>();
    let td = ZERO;
    let tc = ZERO;
    let derniereValidation = '';
    let n = 0;
    for (let i = 1; i < lignesBrutes.length; i++) {
      const champs = lignesBrutes[i].split(sep);
      const val = (col: string) => (idx(col) >= 0 ? champs[idx(col)]?.trim() ?? '' : '');
      const num = i + 1;
      n++;
      for (const col of OBLIGATOIRES) if (idx(col) >= 0 && val(col) === '') ajouter(num, 'Champ obligatoire', `${col} vide`);
      const dE = dateFec(val('EcritureDate'));
      const dV = dateFec(val('ValidDate'));
      if (!dE) ajouter(num, 'Date', `EcritureDate invalide (${val('EcritureDate')})`);
      else if (comparer(dE, e.debutExercice) < 0 || comparer(dE, e.finExercice) > 0) ajouter(num, 'Date', `EcritureDate ${val('EcritureDate')} hors exercice`);
      if (!dV) ajouter(num, 'Date', `ValidDate invalide (${val('ValidDate')})`);
      else {
        if (dE && comparer(dV, dE) < 0) ajouter(num, 'Chronologie', 'ValidDate antérieure à EcritureDate');
        if (derniereValidation && comparer(dV, derniereValidation) < 0) ajouter(num, 'Chronologie', 'Validation non chronologique');
        derniereValidation = dV;
      }
      if (!/^[1-8]\d{2,}/.test(val('CompteNum'))) ajouter(num, 'Compte', `CompteNum non conforme au PCG (${val('CompteNum')})`);
      const deb = montantFec(val('Debit'));
      const cre = montantFec(val('Credit'));
      if (!deb || !cre) {
        ajouter(num, 'Montant', 'Debit/Credit au format invalide');
        continue;
      }
      if (!deb.isZero() && !cre.isZero()) ajouter(num, 'Montant', 'Débit et crédit renseignés sur la même ligne');
      td = td.plus(deb);
      tc = tc.plus(cre);
      const cle = `${val('JournalCode')}|${val('EcritureNum')}`;
      const ec = parEcriture.get(cle) ?? { debit: ZERO, credit: ZERO, ligne: num };
      ec.debit = ec.debit.plus(deb);
      ec.credit = ec.credit.plus(cre);
      parEcriture.set(cle, ec);
    }
    for (const [cle, ec] of parEcriture)
      if (!ec.debit.equals(ec.credit)) ajouter(ec.ligne, 'Équilibre', `Écriture ${cle.replace('|', ' n° ')} déséquilibrée : ${fe(ec.debit)} / ${fe(ec.credit)}`);
    c.res('lignes', 'Lignes analysées', n, 'entier');
    c.res('ecritures', 'Écritures', parEcriture.size, 'entier');
    c.calc('totalDebit', 'Total débit', 'Σ Debit', td);
    c.calc('totalCredit', 'Total crédit', 'Σ Credit', tc);
    c.res('anomalies', 'Anomalies détectées', anomalies.length, 'entier', { principal: true });
    c.verifier(td.equals(tc), 'EQUILIBRE_FEC', 'Le fichier est équilibré au global.', `Fichier déséquilibré de ${fe(td.minus(tc))}.`);
    if (anomalies.length === 0) c.ctrl('ok', 'FEC_CONFORME', 'Aucune anomalie de structure ni de contenu détectée.');
    else {
      c.ctrl('erreur', 'FEC_ANOMALIES', `${anomalies.length} anomalie(s) à corriger avant remise à l’administration.`);
      c.tableau({
        titre: 'Anomalies',
        colonnes: [
          { cle: 'ligne', libelle: 'Ligne', unite: 'entier' },
          { cle: 'type', libelle: 'Type', unite: 'texte' },
          { cle: 'detail', libelle: 'Détail', unite: 'texte' },
        ],
        lignes: anomalies,
      });
    }
  },
});

export const das2 = formule({
  id: 'das2',
  moteur: M,
  nom: 'Déclaration des honoraires (DAS2)',
  categorie: 'Déclarations',
  description: 'Détermine les bénéficiaires à déclarer : honoraires, commissions, courtages, ristournes et droits d’auteur versés à un même bénéficiaire au-delà de 1 200 € TTC par an.',
  expression: 'Déclarable si Σ sommes versées au bénéficiaire > 1 200 € TTC',
  references: [{ texte: 'CGI art. 240 et 241 — déclaration des honoraires' }, { texte: 'CGI art. 1736 I — amende de 50 % des sommes non déclarées' }],
  baremes: ['fiscal.divers'],
  champs: [
    dateOperation('Année (date)', { defaut: '2024-12-31' }),
    table('versements', 'Versements', [texte('beneficiaire', 'Bénéficiaire'), texte('nature', 'Nature'), montant('montant', 'Montant TTC')], {
      min: '1',
      defaut: [
        { beneficiaire: 'Cabinet Lefèvre avocats', nature: 'Honoraires', montant: '4800' },
        { beneficiaire: 'M. Garnier (graphiste)', nature: 'Droits d’auteur', montant: '950' },
        { beneficiaire: 'Cabinet Lefèvre avocats', nature: 'Honoraires', montant: '1200' },
        { beneficiaire: 'Agent commercial Roux', nature: 'Commissions', montant: '2600' },
      ],
    }),
  ],
  exemples: [{ titre: 'Quatre versements', entrees: {}, attendu: { aDeclarer: '2', montantDeclare: '8600.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeDivers>('fiscal.divers', e.dateOperation);
    const m = new Map<string, Decimal>();
    for (const v of e.versements as { beneficiaire: string; montant: Decimal }[]) m.set(v.beneficiaire.trim(), (m.get(v.beneficiaire.trim()) ?? ZERO).plus(v.montant));
    const lignes = [...m.entries()].map(([ben, tot]) => ({ beneficiaire: ben, total: tot.toFixed(2), declarable: tot.greaterThan(b.seuilDas2) ? 'Oui' : 'Non' }));
    const decl = lignes.filter((l) => l.declarable === 'Oui');
    c.res('aDeclarer', 'Bénéficiaires à déclarer', decl.length, 'entier', { principal: true });
    c.calc('montantDeclare', 'Montant total déclaré', 'Σ bénéficiaires > seuil', somme(decl.map((l) => l.total)));
    c.tableau({
      titre: 'Cumul par bénéficiaire',
      colonnes: [
        { cle: 'beneficiaire', libelle: 'Bénéficiaire', unite: 'texte' },
        { cle: 'total', libelle: 'Total versé', unite: 'EUR' },
        { cle: 'declarable', libelle: 'À déclarer', unite: 'texte' },
      ],
      lignes,
    });
  },
});

export const ifuDividendes = formule({
  id: 'ifu-dividendes',
  moteur: M,
  nom: 'Dividendes : prélèvements et IFU',
  categorie: 'Déclarations',
  description: 'Calcule le prélèvement forfaitaire non libératoire (12,8 %) et les prélèvements sociaux (17,2 %) à retenir à la source sur les dividendes versés à des personnes physiques résidentes, et les montants à porter sur l’IFU.',
  expression: 'PFNL = dividende brut × 12,8 % (sauf dispense) ; PS = dividende brut × 17,2 % ; net versé = brut − PFNL − PS',
  references: [
    { texte: 'CGI art. 117 quater — prélèvement forfaitaire non libératoire' },
    { texte: 'CGI art. 200 A — prélèvement forfaitaire unique (PFU)' },
    { texte: 'CGI art. 242 ter — imprimé fiscal unique (2561)' },
  ],
  baremes: ['fiscal.divers'],
  champs: [
    dateOperation('Date de mise en paiement', { defaut: '2024-06-15' }),
    table('associes', 'Associés personnes physiques', [texte('nom', 'Associé'), montant('dividende', 'Dividende brut'), booleen('dispense', 'Dispense de PFNL (RFR sous le seuil)')], {
      min: '1',
      defaut: [
        { nom: 'Mme Bernard', dividende: '25000', dispense: false },
        { nom: 'M. Petit', dividende: '8000', dispense: true },
      ],
    }),
  ],
  exemples: [{ titre: 'Deux associés', entrees: {}, attendu: { pfnl: '3200.00', prelevementsSociaux: '5676.00', netVerse: '24124.00' } }],
  calculer(e, c) {
    const b = c.bareme<BaremeDivers>('fiscal.divers', e.dateOperation);
    type A = { nom: string; dividende: Decimal; dispense: boolean };
    let pf = ZERO;
    let ps = ZERO;
    let brut = ZERO;
    const lignes = (e.associes as A[]).map((a) => {
      const p1 = a.dispense ? ZERO : euros(a.dividende.times(pct(b.pfuIr)));
      const p2 = euros(a.dividende.times(pct(b.prelevementsSociaux)));
      pf = pf.plus(p1);
      ps = ps.plus(p2);
      brut = brut.plus(a.dividende);
      return { nom: a.nom, brut: a.dividende.toFixed(2), pfnl: p1.toFixed(2), ps: p2.toFixed(2), net: a.dividende.minus(p1).minus(p2).toFixed(2) };
    });
    c.calc('pfnl', 'Prélèvement forfaitaire non libératoire', `Σ brut × ${b.pfuIr} %`, pf);
    c.calc('prelevementsSociaux', 'Prélèvements sociaux', `Σ brut × ${b.prelevementsSociaux} %`, ps);
    c.calc('netVerse', 'Net versé aux associés', `${fr(brut)} − ${fr(pf)} − ${fr(ps)}`, brut.minus(pf).minus(ps), 'EUR', { principal: true });
    c.tableau({
      titre: 'Montants par associé (IFU 2561)',
      colonnes: [
        { cle: 'nom', libelle: 'Associé', unite: 'texte' },
        { cle: 'brut', libelle: 'Brut (case 2DC/2TR)', unite: 'EUR' },
        { cle: 'pfnl', libelle: 'PFNL (case 2CK)', unite: 'EUR' },
        { cle: 'ps', libelle: 'Prélèvements sociaux', unite: 'EUR' },
        { cle: 'net', libelle: 'Net versé', unite: 'EUR' },
      ],
      lignes,
    });
    c.ecriture('Mise en paiement des dividendes', [
      { compte: '457', intitule: 'Associés — dividendes à payer', debit: brut },
      { compte: '442', intitule: 'État — prélèvements à la source', credit: pf.plus(ps) },
      { compte: '512', intitule: 'Banque', credit: brut.minus(pf).minus(ps) },
    ], 'BQ');
    c.ctrl('info', 'ECHEANCE', 'Prélèvements à reverser avant le 15 du mois suivant le paiement (formulaire 2777) ; IFU à déposer avant le 15 février N+1.');
  },
});

export const formulesDeclarations = [controleFec, das2, ifuDividendes];
