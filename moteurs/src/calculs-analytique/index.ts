/**
 * MOTEUR 9 — Comptabilité analytique : coûts complets, centres d'analyse avec
 * prestations réciproques, ABC, imputation rationnelle, coûts variables et seuil
 * de rentabilité, analyse des écarts, prix de cession interne, coût cible.
 */
import {
  ajouterJours,
  choix,
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
  resoudreSysteme,
  somme,
  table,
  taux,
  texte,
  UN,
  ZERO,
  arrondi,
} from '../noyau';

const M = 'analytique' as const;
const REF_PCG_ANALYTIQUE = { texte: 'Plan comptable général 1982, titre III — comptabilité analytique (méthode des centres d’analyse)' };

export const coutComplet = formule({
  id: 'cout-complet',
  moteur: M,
  nom: 'Cascade des coûts complets',
  categorie: 'Coûts complets',
  description: 'Du coût d’achat au coût de revient puis au résultat analytique, en totalité et à l’unité.',
  expression: 'Coût d’achat = prix + frais d’approvisionnement ; coût de production = matières consommées + MOD + charges de production ; coût de revient = coût de production des produits vendus + distribution ; résultat = CA − coût de revient',
  references: [REF_PCG_ANALYTIQUE],
  champs: [
    nombre('quantiteAchetee', 'Quantité de matières achetées', { defaut: '12000', groupe: 'Approvisionnement' }),
    montant('prixAchat', 'Prix d’achat unitaire', { defaut: '4.20', groupe: 'Approvisionnement' }),
    montant('fraisApprovisionnement', 'Frais d’approvisionnement', { defaut: '6600', groupe: 'Approvisionnement' }),
    nombre('quantiteConsommee', 'Quantité de matières consommées', { defaut: '11000', groupe: 'Production' }),
    montant('mod', 'Main-d’œuvre directe', { defaut: '38500', groupe: 'Production' }),
    montant('chargesProduction', 'Charges indirectes de production (centres)', { defaut: '27300', groupe: 'Production' }),
    nombre('quantiteProduite', 'Quantité produite', { defaut: '5000', groupe: 'Production' }),
    nombre('quantiteVendue', 'Quantité vendue', { defaut: '4600', groupe: 'Distribution' }),
    montant('distribution', 'Coût de distribution', { defaut: '14100', groupe: 'Distribution' }),
    montant('prixVente', 'Prix de vente unitaire HT', { defaut: '39', groupe: 'Distribution' }),
  ],
  exemples: [{ titre: 'Fabrication', entrees: {}, attendu: { coutAchat: '57000.00', coutAchatUnitaire: '4.7500', coutProduction: '118050.00', coutProductionUnitaire: '23.6100', coutRevient: '122706.00', resultat: '56694.00' } }],
  calculer(e, c) {
    const ca_ = c.calc('coutAchat', 'Coût d’achat', `${frn(e.quantiteAchetee)} × ${fr(e.prixAchat)} + ${fr(e.fraisApprovisionnement)}`, euros(d(e.quantiteAchetee).times(e.prixAchat).plus(e.fraisApprovisionnement)));
    const cau = c.calc('coutAchatUnitaire', 'Coût d’achat unitaire', `${fr(ca_)} / ${frn(e.quantiteAchetee)}`, ca_.div(e.quantiteAchetee), 'nombre', { decimales: 4 });
    const mc = c.etape('Matières consommées', `${frn(e.quantiteConsommee)} × ${frn(cau, 4)}`, euros(d(e.quantiteConsommee).times(cau)), 'EUR');
    const cp = c.calc('coutProduction', 'Coût de production', `${fr(mc)} + ${fr(e.mod)} + ${fr(e.chargesProduction)}`, somme([mc, e.mod, e.chargesProduction]));
    const cpu = c.calc('coutProductionUnitaire', 'Coût de production unitaire', `${fr(cp)} / ${frn(e.quantiteProduite)}`, cp.div(e.quantiteProduite), 'nombre', { decimales: 4 });
    const cpv = c.etape('Coût de production des produits vendus', `${frn(e.quantiteVendue)} × ${frn(cpu, 4)}`, euros(d(e.quantiteVendue).times(cpu)), 'EUR');
    const cr = c.calc('coutRevient', 'Coût de revient', `${fr(cpv)} + ${fr(e.distribution)}`, cpv.plus(e.distribution));
    c.calc('coutRevientUnitaire', 'Coût de revient unitaire', `${fr(cr)} / ${frn(e.quantiteVendue)}`, cr.div(e.quantiteVendue), 'nombre', { decimales: 4 });
    const ca = d(e.quantiteVendue).times(e.prixVente);
    const r = c.calc('resultat', 'Résultat analytique', `${fr(ca)} − ${fr(cr)}`, ca.minus(cr), 'EUR', { principal: true });
    c.calc('margeUnitaire', 'Résultat unitaire', 'résultat / quantité vendue', r.div(e.quantiteVendue), 'nombre', { decimales: 4 });
    c.calc('tauxMarge', 'Taux de marge sur coût de revient', `${fr(r)} / ${fr(cr)}`, diviser(r, cr), '%');
    c.res('stockMatieres', 'Stock final de matières (entrées − sorties)', euros(d(e.quantiteAchetee).minus(e.quantiteConsommee).times(cau)));
    c.res('stockProduits', 'Stock final de produits', euros(d(e.quantiteProduite).minus(e.quantiteVendue).times(cpu)));
    if (d(e.quantiteConsommee).greaterThan(e.quantiteAchetee)) c.ctrl('info', 'STOCK_INITIAL', 'Consommation supérieure aux achats : un stock initial valorisé (CMP) est nécessaire.');
    if (r.isNegative()) c.ctrl('avertissement', 'PERTE', 'Le produit est vendu à perte.');
  },
});

export const repartitionCentres = formule({
  id: 'repartition-centres',
  moteur: M,
  nom: 'Tableau de répartition des charges indirectes',
  categorie: 'Coûts complets',
  description: 'Répartition primaire, répartition secondaire des centres auxiliaires (y compris prestations réciproques résolues par système d’équations) et coût de l’unité d’œuvre des centres principaux.',
  expression: 'Pour chaque auxiliaire A : total(A) = primaire(A) + Σ % reçus × total(autres auxiliaires) ; coût UO = total centre principal / nombre d’UO',
  references: [REF_PCG_ANALYTIQUE],
  champs: [
    table('centres', 'Centres et répartition primaire', [texte('centre', 'Centre'), choix('type', 'Type', [['auxiliaire', 'Auxiliaire'], ['principal', 'Principal']]), montant('primaire', 'Total primaire'), nombre('unitesOeuvre', 'Nombre d’UO', { optionnel: true }), texte('natureUo', 'Nature de l’UO', { optionnel: true })], {
      min: '2',
      max: '200', // prestations réciproques : résolution d'un système n × n
      defaut: [
        { centre: 'Administration', type: 'auxiliaire', primaire: '24000', unitesOeuvre: '', natureUo: '' },
        { centre: 'Entretien', type: 'auxiliaire', primaire: '15000', unitesOeuvre: '', natureUo: '' },
        { centre: 'Approvisionnement', type: 'principal', primaire: '18000', unitesOeuvre: '9000', natureUo: 'kg achetés' },
        { centre: 'Atelier', type: 'principal', primaire: '56000', unitesOeuvre: '2600', natureUo: 'heures machine' },
        { centre: 'Distribution', type: 'principal', primaire: '21000', unitesOeuvre: '1000', natureUo: '100 € de CA' },
      ],
    }),
    table('cles', 'Clés de répartition secondaire (%)', [texte('de', 'Centre cédant'), texte('vers', 'Centre bénéficiaire'), taux('pourcentage', '%')], {
      defaut: [
        { de: 'Administration', vers: 'Entretien', pourcentage: '10' },
        { de: 'Administration', vers: 'Approvisionnement', pourcentage: '20' },
        { de: 'Administration', vers: 'Atelier', pourcentage: '40' },
        { de: 'Administration', vers: 'Distribution', pourcentage: '30' },
        { de: 'Entretien', vers: 'Administration', pourcentage: '20' },
        { de: 'Entretien', vers: 'Approvisionnement', pourcentage: '10' },
        { de: 'Entretien', vers: 'Atelier', pourcentage: '60' },
        { de: 'Entretien', vers: 'Distribution', pourcentage: '10' },
      ],
    }),
  ],
  exemples: [{ titre: 'Deux auxiliaires réciproques', entrees: {}, attendu: { total_Administration: '27551.02', total_Entretien: '17755.10', cout_Atelier: '29.8744', totalPrincipaux: '134000.00' } }],
  calculer(e, c) {
    type Ce = { centre: string; type: string; primaire: Decimal; unitesOeuvre?: Decimal; natureUo?: string };
    type Cl = { de: string; vers: string; pourcentage: Decimal };
    const centres = e.centres as Ce[];
    const cles = e.cles as Cl[];
    const aux = centres.filter((x) => x.type === 'auxiliaire');
    const pri = centres.filter((x) => x.type === 'principal');
    const noms = new Set(centres.map((x) => x.centre));
    for (const k of cles) if (!noms.has(k.de) || !noms.has(k.vers)) c.ctrl('erreur', 'CLE_INCONNUE', `Clé « ${k.de} → ${k.vers} » : centre inconnu.`);
    for (const a of aux) {
      const t = somme(cles.filter((k) => k.de === a.centre).map((k) => k.pourcentage));
      if (!t.equals(1)) c.ctrl('erreur', 'CLES_INCOMPLETES', `Le centre auxiliaire « ${a.centre} » répartit ${fp(t)} de ses charges (100 % attendu).`);
    }
    // Système : T_a − Σ_b p(b→a) T_b = primaire(a)
    const pct = (de: string, vers: string) => somme(cles.filter((k) => k.de === de && k.vers === vers).map((k) => k.pourcentage));
    const A = aux.map((a) => aux.map((b) => (a.centre === b.centre ? UN.minus(pct(b.centre, a.centre)) : pct(b.centre, a.centre).neg())));
    const totaux = aux.length ? resoudreSysteme(A, aux.map((a) => a.primaire)) : [];
    const totalAux = new Map(aux.map((a, i) => [a.centre, totaux[i]]));
    aux.forEach((a, i) => c.calc(`total_${a.centre}`, `Total à répartir — ${a.centre}`, `${fr(a.primaire)} + prestations reçues (système)`, euros(totaux[i])));
    const lignes: Record<string, string>[] = [];
    let totalPrincipaux = ZERO;
    for (const p of pri) {
      const recu = somme(aux.map((a) => totalAux.get(a.centre)!.times(pct(a.centre, p.centre))));
      const total = euros(p.primaire.plus(recu));
      totalPrincipaux = totalPrincipaux.plus(total);
      const uo = p.unitesOeuvre;
      const cout = uo && !uo.isZero() ? total.div(uo) : null;
      if (cout) c.calc(`cout_${p.centre}`, `Coût de l’UO — ${p.centre} (${p.natureUo ?? 'UO'})`, `${fr(total)} / ${frn(uo!)}`, cout, 'nombre', { decimales: 4, principal: true });
      lignes.push({ centre: p.centre, primaire: p.primaire.toFixed(2), secondaire: euros(recu).toFixed(2), total: total.toFixed(2), uo: uo ? uo.toFixed() : '', nature: p.natureUo ?? '', cout: cout ? cout.toDecimalPlaces(4).toFixed() : '' });
    }
    c.calc('totalPrincipaux', 'Total des centres principaux', 'Σ totaux secondaires', totalPrincipaux);
    const totalPrimaire = somme(centres.map((x) => x.primaire));
    c.verifier(totalPrincipaux.minus(totalPrimaire).abs().lessThanOrEqualTo('0.05'), 'CONSERVATION', 'Conservation des charges : Σ centres principaux = Σ répartition primaire.', `Écart de répartition : ${fe(totalPrincipaux.minus(totalPrimaire))}.`);
    c.tableau({
      titre: 'Répartition secondaire',
      colonnes: [
        { cle: 'centre', libelle: 'Centre principal', unite: 'texte' },
        { cle: 'primaire', libelle: 'Primaire', unite: 'EUR' },
        { cle: 'secondaire', libelle: 'Reçu des auxiliaires', unite: 'EUR' },
        { cle: 'total', libelle: 'Total', unite: 'EUR' },
        { cle: 'uo', libelle: 'Nb UO', unite: 'nombre' },
        { cle: 'nature', libelle: 'Nature UO', unite: 'texte' },
        { cle: 'cout', libelle: 'Coût UO', unite: 'nombre' },
      ],
      lignes,
      graphique: { type: 'barres-empilees', x: 'centre', series: ['primaire', 'secondaire'] },
    });
  },
});

export const abc = formule({
  id: 'abc',
  moteur: M,
  nom: 'Méthode ABC (coûts par activités)',
  categorie: 'Coûts complets',
  description: 'Calcule le coût unitaire de chaque inducteur à partir du coût des activités, puis affecte ces coûts aux produits selon leur consommation d’inducteurs.',
  expression: 'Coût de l’inducteur = coût de l’activité / volume de l’inducteur ; coût produit = Σ consommation × coût inducteur',
  references: [{ texte: 'Activity Based Costing (Kaplan & Cooper) ; PCG — comptabilité analytique' }],
  champs: [
    table('activites', 'Activités', [texte('activite', 'Activité'), montant('cout', 'Coût de l’activité'), texte('inducteur', 'Inducteur'), nombre('volume', 'Volume de l’inducteur')], {
      min: '1',
      defaut: [
        { activite: 'Réception', cout: '42000', inducteur: 'Nombre de livraisons', volume: '600' },
        { activite: 'Lancement', cout: '36000', inducteur: 'Nombre de lots', volume: '240' },
        { activite: 'Usinage', cout: '120000', inducteur: 'Heures machine', volume: '8000' },
        { activite: 'Expédition', cout: '27000', inducteur: 'Nombre de commandes', volume: '900' },
      ],
    }),
    table('consommations', 'Consommation d’inducteurs par produit', [texte('produit', 'Produit'), texte('activite', 'Activité'), nombre('quantite', 'Quantité d’inducteur')], {
      min: '1',
      defaut: [
        { produit: 'Standard', activite: 'Réception', quantite: '400' },
        { produit: 'Standard', activite: 'Lancement', quantite: '90' },
        { produit: 'Standard', activite: 'Usinage', quantite: '5500' },
        { produit: 'Standard', activite: 'Expédition', quantite: '650' },
        { produit: 'Sur mesure', activite: 'Réception', quantite: '200' },
        { produit: 'Sur mesure', activite: 'Lancement', quantite: '150' },
        { produit: 'Sur mesure', activite: 'Usinage', quantite: '2500' },
        { produit: 'Sur mesure', activite: 'Expédition', quantite: '250' },
      ],
    }),
  ],
  exemples: [{ titre: 'Deux gammes', entrees: {}, attendu: { 'inducteur_Réception': '70.0000', 'cout_Standard': '143500.00', 'cout_Sur mesure': '81500.00' } }],
  calculer(e, c) {
    type Ac = { activite: string; cout: Decimal; inducteur: string; volume: Decimal };
    type Co = { produit: string; activite: string; quantite: Decimal };
    const acts = e.activites as Ac[];
    const cu = new Map<string, Decimal>();
    for (const a of acts) {
      const v = c.calc(`inducteur_${a.activite}`, `Coût unitaire — ${a.inducteur}`, `${fr(a.cout)} / ${frn(a.volume)}`, diviser(a.cout, a.volume), 'nombre', { decimales: 4 });
      cu.set(a.activite, v);
    }
    const produits = new Map<string, Decimal>();
    for (const x of e.consommations as Co[]) {
      if (!cu.has(x.activite)) {
        c.ctrl('erreur', 'ACTIVITE_INCONNUE', `Activité inconnue : ${x.activite}.`);
        continue;
      }
      produits.set(x.produit, (produits.get(x.produit) ?? ZERO).plus(x.quantite.times(cu.get(x.activite)!)));
    }
    for (const [p, v] of produits) c.calc(`cout_${p}`, `Coût indirect affecté — ${p}`, 'Σ consommation × coût de l’inducteur', euros(v), 'EUR', { principal: true });
    for (const a of acts) {
      const conso = somme((e.consommations as Co[]).filter((x) => x.activite === a.activite).map((x) => x.quantite));
      if (!conso.equals(a.volume)) c.ctrl('avertissement', 'SOUS_ACTIVITE', `${a.activite} : ${frn(conso)} inducteurs consommés pour ${frn(a.volume)} prévus — coût non entièrement affecté.`);
    }
    c.tableau({
      titre: 'Coûts par produit',
      colonnes: [
        { cle: 'produit', libelle: 'Produit', unite: 'texte' },
        { cle: 'cout', libelle: 'Coût indirect', unite: 'EUR' },
      ],
      lignes: [...produits].map(([produit, v]) => ({ produit, cout: euros(v).toFixed(2) })),
      graphique: { type: 'barres', x: 'produit', series: ['cout'] },
    });
  },
});

export const imputationRationnelle = formule({
  id: 'imputation-rationnelle',
  moteur: M,
  nom: 'Imputation rationnelle des charges fixes',
  categorie: 'Coûts complets',
  description: 'Neutralise l’effet du niveau d’activité sur les coûts : charges fixes imputées au prorata de l’activité réelle sur l’activité normale, différence d’incorporation (coût de sous-activité ou boni de suractivité).',
  expression: 'Coefficient = activité réelle / activité normale ; CF imputées = CF × coefficient ; différence = CF − CF imputées',
  references: [{ texte: 'PCG art. 213-31 — exclusion des coûts de sous-activité du coût des stocks' }, REF_PCG_ANALYTIQUE],
  champs: [
    montant('chargesFixes', 'Charges fixes du centre', { defaut: '84000' }),
    montant('chargesVariables', 'Charges variables du centre', { defaut: '46200' }),
    nombre('activiteNormale', 'Activité normale (UO)', { defaut: '12000' }),
    nombre('activiteReelle', 'Activité réelle (UO)', { defaut: '10500' }),
  ],
  exemples: [{ titre: 'Sous-activité', entrees: {}, attendu: { coefficient: '87.50', fixesImputees: '73500.00', difference: '10500.00', coutUoRationnel: '11.4000' } }],
  calculer(e, c) {
    const k = c.calc('coefficient', 'Coefficient d’imputation rationnelle', `${frn(e.activiteReelle)} / ${frn(e.activiteNormale)}`, diviser(e.activiteReelle, e.activiteNormale), '%');
    const fi = c.calc('fixesImputees', 'Charges fixes imputées', `${fr(e.chargesFixes)} × ${fp(k)}`, euros(d(e.chargesFixes).times(k)));
    const diff = c.calc('difference', 'Différence d’incorporation', `${fr(e.chargesFixes)} − ${fr(fi)}`, d(e.chargesFixes).minus(fi), 'EUR', { principal: true });
    c.calc('coutUoRationnel', 'Coût d’UO après imputation rationnelle', `(${fr(e.chargesVariables)} + ${fr(fi)}) / ${frn(e.activiteReelle)}`, diviser(d(e.chargesVariables).plus(fi), e.activiteReelle), 'nombre', { decimales: 4 });
    c.calc('coutUoReel', 'Coût d’UO réel (sans imputation rationnelle)', `(${fr(e.chargesVariables)} + ${fr(e.chargesFixes)}) / ${frn(e.activiteReelle)}`, diviser(d(e.chargesVariables).plus(e.chargesFixes), e.activiteReelle), 'nombre', { decimales: 4 });
    c.res('nature', 'Nature', diff.greaterThan(0) ? 'Coût de sous-activité (charge de la période)' : diff.isZero() ? 'Activité normale' : 'Boni de suractivité', 'texte');
  },
});

export const seuilRentabilite = formule({
  id: 'seuil-rentabilite',
  moteur: M,
  nom: 'Coûts variables et seuil de rentabilité',
  categorie: 'Coûts partiels',
  description: 'Marge sur coût variable, taux de MCV, seuil de rentabilité en valeur et en quantité, point mort (en jours et en date), marge et indice de sécurité, levier opérationnel.',
  expression: 'MCV = CA − CV ; taux MCV = MCV / CA ; SR = CF / taux MCV ; point mort = SR / CA × 360 j ; MS = CA − SR ; IS = MS / CA ; LO = MCV / résultat',
  references: [{ texte: 'Méthode du coût variable (direct costing)' }],
  champs: [
    montant('ca', 'Chiffre d’affaires HT', { defaut: '1200000' }),
    montant('chargesVariables', 'Charges variables', { defaut: '720000' }),
    montant('chargesFixes', 'Charges fixes', { defaut: '330000' }),
    montant('prixUnitaire', 'Prix de vente unitaire (optionnel)', { optionnel: true }),
    date('debutExercice', 'Début de l’exercice', { defaut: '2025-01-01' }),
    choix('fermeture', 'Activité', [
      ['reguliere', 'Régulière sur 12 mois'],
      ['aout', 'Fermeture en août (11 mois d’activité)'],
    ]),
  ],
  exemples: [{ titre: 'PME', entrees: {}, attendu: { mcv: '480000.00', tauxMcv: '40.00', seuil: '825000.00', pointMortJours: '248', dateSeuil: '2025-09-08', margeSecurite: '375000.00', indiceSecurite: '31.25', levier: '3.20' } }],
  calculer(e, c) {
    const ca: Decimal = e.ca;
    const mcv = c.calc('mcv', 'Marge sur coût variable', `${fr(ca)} − ${fr(e.chargesVariables)}`, ca.minus(e.chargesVariables));
    const t = c.calc('tauxMcv', 'Taux de marge sur coût variable', `${fr(mcv)} / ${fr(ca)}`, diviser(mcv, ca), '%');
    if (!t.greaterThan(0)) {
      c.ctrl('erreur', 'MCV_NEGATIVE', 'Marge sur coût variable nulle ou négative : aucun seuil de rentabilité.');
      return;
    }
    const sr = c.calc('seuil', 'Seuil de rentabilité', `${fr(e.chargesFixes)} / ${fp(t)}`, euros(d(e.chargesFixes).div(t)), 'EUR', { principal: true });
    if (e.prixUnitaire) c.calc('seuilQuantite', 'Seuil en quantité', `${fr(sr)} / ${fr(e.prixUnitaire)}`, sr.div(e.prixUnitaire).ceil(), 'unites', { decimales: 0 });
    const r = c.calc('resultat', 'Résultat', `${fr(mcv)} − ${fr(e.chargesFixes)}`, mcv.minus(e.chargesFixes));
    let jours: Decimal;
    if (e.fermeture === 'aout') {
      // 11 mois d'activité : 330 jours ouvrés commerciaux ; août décalé de 30 jours.
      jours = arrondi(sr.div(ca).times(330), 0, 'plafond');
      if (jours.greaterThan(210)) jours = jours.plus(30);
    } else jours = arrondi(sr.div(ca).times(360), 0, 'plafond');
    c.calc('pointMortJours', 'Point mort (jours, année de 360 j)', `${fr(sr)} / ${fr(ca)} × ${e.fermeture === 'aout' ? '330 (+ 30 si après juillet)' : '360'}`, jours, 'jours', { decimales: 0 });
    // Conversion 30/360 en date : mois de 30 jours à partir du début de l'exercice
    const j = jours.toNumber();
    const mois = Math.floor((j - 1) / 30);
    const reste = j - mois * 30;
    const dt = ajouterJours(ajouterMoisSur(e.debutExercice, mois), reste - 1);
    c.res('dateSeuil', 'Date d’atteinte du seuil', dt, 'date');
    const ms = c.calc('margeSecurite', 'Marge de sécurité', `${fr(ca)} − ${fr(sr)}`, ca.minus(sr));
    c.calc('indiceSecurite', 'Indice de sécurité', `${fr(ms)} / ${fr(ca)}`, diviser(ms, ca), '%');
    if (r.greaterThan(0)) c.calc('levier', 'Levier opérationnel', `${fr(mcv)} / ${fr(r)}`, mcv.div(r), 'fois', { decimales: 2 });
    if (ms.isNegative()) c.ctrl('avertissement', 'SOUS_SEUIL', 'CA inférieur au seuil de rentabilité : exploitation déficitaire.');
    c.tableau({
      titre: 'Graphique de rentabilité',
      colonnes: [
        { cle: 'ca', libelle: 'CA', unite: 'EUR' },
        { cle: 'mcv', libelle: 'MCV', unite: 'EUR' },
        { cle: 'cf', libelle: 'Charges fixes', unite: 'EUR' },
      ],
      lignes: [0, 0.25, 0.5, 0.75, 1, 1.25].map((f) => ({ ca: ca.times(f).toFixed(2), mcv: ca.times(f).times(t).toFixed(2), cf: d(e.chargesFixes).toFixed(2) })),
      graphique: { type: 'lignes', x: 'ca', series: ['mcv', 'cf'] },
    });
  },
});

function ajouterMoisSur(dt: string, n: number): string {
  const [a, m, j] = dt.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

export const ecartsMatieres = formule({
  id: 'ecarts-matieres-mod',
  moteur: M,
  nom: 'Écarts sur matières et main-d’œuvre directe',
  categorie: 'Analyse des écarts',
  description: 'Décompose l’écart entre coût réel et coût préétabli de la production réelle en écart sur prix (ou taux) et écart sur quantité (ou temps).',
  expression: 'Écart global = Qr × Pr − Qp × Ps ; écart sur prix = (Pr − Ps) × Qr ; écart sur quantité = (Qr − Qp) × Ps, avec Qp = quantité standard × production réelle',
  references: [{ texte: 'Contrôle de gestion — analyse des écarts sur coûts directs' }],
  champs: [
    choix('nature', 'Nature', [
      ['matieres', 'Matières (écart prix / quantité)'],
      ['mod', 'Main-d’œuvre directe (écart taux / temps)'],
    ]),
    nombre('productionReelle', 'Production réelle (unités)', { defaut: '4800' }),
    nombre('quantiteStandardUnitaire', 'Quantité standard par unité', { defaut: '2.5' }),
    montant('prixStandard', 'Prix (ou taux horaire) standard', { defaut: '6.00' }),
    nombre('quantiteReelle', 'Quantité (ou heures) réelle consommée', { defaut: '12300' }),
    montant('prixReel', 'Prix (ou taux horaire) réel', { defaut: '5.85' }),
  ],
  exemples: [{ titre: 'Matières', entrees: {}, attendu: { coutReel: '71955.00', coutPreetabli: '72000.00', ecartGlobal: '-45.00', ecartPrix: '-1845.00', ecartQuantite: '1800.00' } }],
  calculer(e, c) {
    const qp = c.etape('Quantité préétablie pour la production réelle', `${frn(e.productionReelle)} × ${frn(e.quantiteStandardUnitaire)}`, d(e.productionReelle).times(e.quantiteStandardUnitaire), 'nombre');
    const cr = c.calc('coutReel', 'Coût réel', `${frn(e.quantiteReelle)} × ${fr(e.prixReel)}`, euros(d(e.quantiteReelle).times(e.prixReel)));
    const cp = c.calc('coutPreetabli', 'Coût préétabli de la production réelle', `${frn(qp)} × ${fr(e.prixStandard)}`, euros(qp.times(e.prixStandard)));
    const eg = c.calc('ecartGlobal', 'Écart global', `${fr(cr)} − ${fr(cp)}`, cr.minus(cp), 'EUR', { principal: true });
    const lp = e.nature === 'mod' ? 'taux' : 'prix';
    const lq = e.nature === 'mod' ? 'temps' : 'quantité';
    const ep = c.calc('ecartPrix', `Écart sur ${lp}`, `(${fr(e.prixReel)} − ${fr(e.prixStandard)}) × ${frn(e.quantiteReelle)}`, euros(d(e.prixReel).minus(e.prixStandard).times(e.quantiteReelle)));
    const eq = c.calc('ecartQuantite', `Écart sur ${lq}`, `(${frn(e.quantiteReelle)} − ${frn(qp)}) × ${fr(e.prixStandard)}`, euros(d(e.quantiteReelle).minus(qp).times(e.prixStandard)));
    c.verifier(ep.plus(eq).equals(eg), 'DECOMPOSITION', 'Écart sur prix + écart sur quantité = écart global.', 'La décomposition ne reconstitue pas l’écart global.');
    const sens = (x: Decimal) => (x.greaterThan(0) ? 'défavorable' : x.isNegative() ? 'favorable' : 'nul');
    c.res('lecture', 'Lecture', `Écart sur ${lp} ${sens(ep)}, écart sur ${lq} ${sens(eq)}.`, 'texte');
  },
});

export const ecartsCentre = formule({
  id: 'ecarts-centre',
  moteur: M,
  nom: 'Écarts sur charges indirectes (budget, activité, rendement)',
  categorie: 'Analyse des écarts',
  description: 'Analyse de l’écart d’un centre de production avec un budget flexible : écart sur budget, écart sur activité (imputation des charges fixes) et écart sur rendement.',
  expression: 'Budget flexible BF(A) = CV unitaire × A + CF ; E/budget = CR − BF(Ar) ; E/activité = BF(Ar) − Cs × Ar ; E/rendement = Cs × (Ar − Ap)',
  references: [{ texte: 'Contrôle de gestion — budget flexible et analyse des écarts sur centres' }],
  champs: [
    nombre('activiteNormale', 'Activité normale (UO)', { defaut: '10000' }),
    montant('chargesFixesBudget', 'Charges fixes budgétées', { defaut: '60000' }),
    montant('cvUnitaire', 'Charge variable standard par UO', { defaut: '4.50' }),
    nombre('activiteReelle', 'Activité réelle (UO consommées)', { defaut: '9400' }),
    nombre('activitePreetablie', 'Activité préétablie pour la production réelle (UO)', { defaut: '9000' }),
    montant('coutReel', 'Coût réel du centre', { defaut: '105800' }),
  ],
  exemples: [{ titre: 'Atelier', entrees: {}, attendu: { coutStandardUo: '10.5000', ecartBudget: '3500.00', ecartActivite: '3600.00', ecartRendement: '4200.00', ecartGlobal: '11300.00' } }],
  calculer(e, c) {
    const cs = c.calc('coutStandardUo', 'Coût standard de l’UO', `${fr(e.cvUnitaire)} + ${fr(e.chargesFixesBudget)} / ${frn(e.activiteNormale)}`, d(e.cvUnitaire).plus(d(e.chargesFixesBudget).div(e.activiteNormale)), 'nombre', { decimales: 4 });
    const bf = c.etape('Budget flexible de l’activité réelle', `${fr(e.cvUnitaire)} × ${frn(e.activiteReelle)} + ${fr(e.chargesFixesBudget)}`, euros(d(e.cvUnitaire).times(e.activiteReelle).plus(e.chargesFixesBudget)), 'EUR');
    const eb = c.calc('ecartBudget', 'Écart sur budget', `${fr(e.coutReel)} − ${fr(bf)}`, d(e.coutReel).minus(bf));
    const ea = c.calc('ecartActivite', 'Écart sur activité', `${fr(bf)} − ${frn(cs, 4)} × ${frn(e.activiteReelle)}`, euros(bf.minus(cs.times(e.activiteReelle))));
    const er = c.calc('ecartRendement', 'Écart sur rendement', `${frn(cs, 4)} × (${frn(e.activiteReelle)} − ${frn(e.activitePreetablie)})`, euros(cs.times(d(e.activiteReelle).minus(e.activitePreetablie))));
    const eg = c.calc('ecartGlobal', 'Écart global', `${fr(e.coutReel)} − ${frn(cs, 4)} × ${frn(e.activitePreetablie)}`, euros(d(e.coutReel).minus(cs.times(e.activitePreetablie))), 'EUR', { principal: true });
    c.verifier(eb.plus(ea).plus(er).equals(eg), 'DECOMPOSITION', 'Budget + activité + rendement = écart global.', 'La somme des trois écarts ne reconstitue pas l’écart global (arrondis).', 'avertissement');
  },
});

export const ecartsCa = formule({
  id: 'ecarts-ca',
  moteur: M,
  nom: 'Écarts sur chiffre d’affaires (prix, volume, composition)',
  categorie: 'Analyse des écarts',
  description: 'Décompose l’écart entre CA réel et CA budgété en écart sur prix, écart sur volume global et écart sur composition des ventes (mix).',
  expression: 'E/prix = Σ (Pr − Pp) × Qr ; E/volume = (Qr total − Qp total) × Pp moyen ; E/mix = Σ Pp × (Qr − Qr total × mix prévu) ',
  references: [{ texte: 'Contrôle de gestion — analyse des écarts sur chiffre d’affaires' }],
  champs: [
    table('produits', 'Produits', [texte('produit', 'Produit'), nombre('qPrevue', 'Qté prévue'), montant('pPrevu', 'Prix prévu'), nombre('qReelle', 'Qté réelle'), montant('pReel', 'Prix réel')], {
      min: '1',
      defaut: [
        { produit: 'Gamme A', qPrevue: '2000', pPrevu: '50', qReelle: '2100', pReel: '48' },
        { produit: 'Gamme B', qPrevue: '1000', pPrevu: '80', qReelle: '1150', pReel: '82' },
      ],
    }),
  ],
  exemples: [{ titre: 'Deux gammes', entrees: {}, attendu: { caPrevu: '180000.00', caReel: '195100.00', ecartGlobal: '15100.00', ecartPrix: '-1900.00', ecartVolume: '15000.00', ecartComposition: '2000.00' } }],
  calculer(e, c) {
    type P = { produit: string; qPrevue: Decimal; pPrevu: Decimal; qReelle: Decimal; pReel: Decimal };
    const ps = e.produits as P[];
    const cap = c.calc('caPrevu', 'CA prévu', 'Σ Qp × Pp', somme(ps.map((p) => p.qPrevue.times(p.pPrevu))));
    const car = c.calc('caReel', 'CA réel', 'Σ Qr × Pr', somme(ps.map((p) => p.qReelle.times(p.pReel))));
    c.calc('ecartGlobal', 'Écart global sur CA', `${fr(car)} − ${fr(cap)}`, car.minus(cap), 'EUR', { principal: true });
    const ep = c.calc('ecartPrix', 'Écart sur prix', 'Σ (Pr − Pp) × Qr', euros(somme(ps.map((p) => p.pReel.minus(p.pPrevu).times(p.qReelle)))));
    const qpt = somme(ps.map((p) => p.qPrevue));
    const qrt = somme(ps.map((p) => p.qReelle));
    const pMoyen = cap.div(qpt);
    const ev = c.calc('ecartVolume', 'Écart sur volume global', `(${frn(qrt)} − ${frn(qpt)}) × ${frn(pMoyen, 4)}`, euros(qrt.minus(qpt).times(pMoyen)));
    const em = c.calc('ecartComposition', 'Écart sur composition (mix)', 'Σ Pp × (Qr − Qr total × part prévue)', euros(somme(ps.map((p) => p.pPrevu.times(p.qReelle.minus(qrt.times(p.qPrevue).div(qpt)))))));
    c.verifier(ep.plus(ev).plus(em).minus(car.minus(cap)).abs().lessThanOrEqualTo('0.02'), 'DECOMPOSITION', 'Prix + volume + composition = écart global.', 'La décomposition ne reconstitue pas l’écart global.');
  },
});

export const prixCessionInterne = formule({
  id: 'prix-cession-interne',
  moteur: M,
  nom: 'Prix de cession interne',
  categorie: 'Pilotage',
  description: 'Compare les méthodes de fixation du prix de cession entre centres (coût complet, coût variable, coût majoré, prix de marché) et leur effet sur le résultat de chaque centre.',
  expression: 'Résultat cédant = (PCI − coût complet) × Q ; résultat acheteur = (prix final − PCI − coûts propres) × Q ; Σ = constant',
  references: [{ texte: 'Contrôle de gestion — prix de cession interne ; CGI art. 57 et OCDE (prix de transfert) pour les flux entre entités' }],
  champs: [
    nombre('quantite', 'Quantité cédée', { defaut: '10000' }),
    montant('coutVariable', 'Coût variable unitaire du cédant', { defaut: '18' }),
    montant('coutComplet', 'Coût complet unitaire du cédant', { defaut: '26' }),
    taux('marge', 'Marge sur coût complet', { defaut: '10' }),
    montant('prixMarche', 'Prix de marché unitaire', { defaut: '31' }),
    montant('coutsPropresAcheteur', 'Coûts propres unitaires de l’acheteur', { defaut: '14' }),
    montant('prixVenteFinal', 'Prix de vente final unitaire', { defaut: '48' }),
  ],
  exemples: [{ titre: 'Comparaison', entrees: {}, attendu: { resultatGroupe: '80000.00', 'cedant_marche': '50000.00', 'acheteur_marche': '30000.00' } }],
  calculer(e, c) {
    const q: Decimal = e.quantite;
    const methodes: [string, string, Decimal][] = [
      ['variable', 'Coût variable', e.coutVariable],
      ['complet', 'Coût complet', e.coutComplet],
      ['majore', `Coût complet + ${fp(e.marge)}`, euros(d(e.coutComplet).times(UN.plus(e.marge)))],
      ['marche', 'Prix de marché', e.prixMarche],
    ];
    const groupe = c.calc('resultatGroupe', 'Résultat global du groupe', `(${fr(e.prixVenteFinal)} − ${fr(e.coutComplet)} − ${fr(e.coutsPropresAcheteur)}) × ${frn(q)}`, d(e.prixVenteFinal).minus(e.coutComplet).minus(e.coutsPropresAcheteur).times(q), 'EUR', { principal: true });
    const lignes = methodes.map(([k, lib, pci]) => {
      const rc = pci.minus(e.coutComplet).times(q);
      const ra = d(e.prixVenteFinal).minus(pci).minus(e.coutsPropresAcheteur).times(q);
      c.res(`cedant_${k}`, `Résultat du cédant — ${lib}`, rc);
      c.res(`acheteur_${k}`, `Résultat de l’acheteur — ${lib}`, ra);
      if (!rc.plus(ra).equals(groupe)) c.ctrl('erreur', 'NEUTRALITE', 'Le prix de cession interne doit être neutre pour le résultat global.');
      return { methode: lib, pci: pci.toFixed(2), cedant: rc.toFixed(2), acheteur: ra.toFixed(2) };
    });
    c.tableau({
      titre: 'Effet du prix de cession sur les centres',
      colonnes: [
        { cle: 'methode', libelle: 'Méthode', unite: 'texte' },
        { cle: 'pci', libelle: 'PCI unitaire', unite: 'EUR' },
        { cle: 'cedant', libelle: 'Résultat cédant', unite: 'EUR' },
        { cle: 'acheteur', libelle: 'Résultat acheteur', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'methode', series: ['cedant', 'acheteur'] },
    });
    c.ctrl('info', 'NEUTRALITE', 'Le résultat global est indépendant du prix de cession interne ; seul le partage entre centres change.');
  },
});

export const coutCible = formule({
  id: 'cout-cible',
  moteur: M,
  nom: 'Coût cible (target costing)',
  categorie: 'Pilotage',
  description: 'Déduit le coût admissible du prix de marché et de la marge visée, le compare au coût estimé et ventile l’effort de réduction par fonction.',
  expression: 'Coût cible = prix de marché × (1 − taux de marge visé) ; écart = coût estimé − coût cible',
  references: [{ texte: 'Contrôle de gestion — target costing' }],
  champs: [
    montant('prixMarche', 'Prix de vente accepté par le marché', { defaut: '250' }),
    taux('margeVisee', 'Marge visée sur prix de vente', { defaut: '22' }),
    table('fonctions', 'Coût estimé par fonction', [texte('fonction', 'Fonction'), montant('cout', 'Coût estimé')], {
      min: '1',
      defaut: [
        { fonction: 'Châssis', cout: '72' },
        { fonction: 'Électronique', cout: '64' },
        { fonction: 'Assemblage', cout: '38' },
        { fonction: 'Emballage et logistique', cout: '26' },
        { fonction: 'Garantie', cout: '9' },
      ],
    }),
  ],
  exemples: [{ titre: 'Nouveau produit', entrees: {}, attendu: { coutCible: '195.00', coutEstime: '209.00', ecart: '14.00', reductionNecessaire: '6.70' } }],
  calculer(e, c) {
    type F = { fonction: string; cout: Decimal };
    const fs = e.fonctions as F[];
    const cc = c.calc('coutCible', 'Coût cible', `${fr(e.prixMarche)} × (1 − ${fp(e.margeVisee)})`, euros(d(e.prixMarche).times(UN.minus(e.margeVisee))), 'EUR', { principal: true });
    const ce = c.calc('coutEstime', 'Coût estimé', 'Σ fonctions', somme(fs.map((f) => f.cout)));
    const ec = c.calc('ecart', 'Écart à résorber', `${fr(ce)} − ${fr(cc)}`, ce.minus(cc));
    c.calc('reductionNecessaire', 'Réduction nécessaire', `${fr(ec)} / ${fr(ce)}`, diviser(ec, ce), '%');
    c.calc('margeEstimee', 'Marge avec le coût estimé', `(${fr(e.prixMarche)} − ${fr(ce)}) / ${fr(e.prixMarche)}`, diviser(d(e.prixMarche).minus(ce), e.prixMarche), '%');
    c.tableau({
      titre: 'Objectif par fonction (réduction proportionnelle)',
      colonnes: [
        { cle: 'fonction', libelle: 'Fonction', unite: 'texte' },
        { cle: 'estime', libelle: 'Coût estimé', unite: 'EUR' },
        { cle: 'cible', libelle: 'Coût cible', unite: 'EUR' },
      ],
      lignes: fs.map((f) => ({ fonction: f.fonction, estime: f.cout.toFixed(2), cible: euros(f.cout.times(cc).div(ce)).toFixed(2) })),
      graphique: { type: 'barres', x: 'fonction', series: ['estime', 'cible'] },
    });
    c.ctrl(ec.greaterThan(0) ? 'avertissement' : 'ok', 'COUT_CIBLE', ec.greaterThan(0) ? `Le coût estimé dépasse le coût cible de ${fe(ec)} par unité.` : 'Le coût estimé respecte le coût cible.');
  },
});

export const formulesAnalytique = [coutComplet, repartitionCentres, abc, imputationRationnelle, seuilRentabilite, ecartsMatieres, ecartsCentre, ecartsCa, prixCessionInterne, coutCible];
