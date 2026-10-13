/**
 * MOTEUR 10 — Investissement et décision : VAN, TRI, TRIM, IP, DRCI, flux
 * d'investissement, CMPC, MEDAF, bêta, scénarios, Monte-Carlo, arbre de
 * décision, choix de financement.
 */
import {
  centile,
  choix,
  covariance,
  d,
  Decimal,
  diviser,
  ecartType,
  entier,
  euros,
  fe,
  formule,
  fp,
  fr,
  frn,
  generateurEntier,
  ECHELLE_FIXE,
  liste,
  montant,
  moyenne,
  nombre,
  somme,
  table,
  taux,
  texte,
  tirageNormalFixe,
  tri,
  UN,
  van,
  variance,
  ZERO,
} from '../noyau';

const M = 'investissement' as const;
const REF_CHOIX = { texte: 'Finance d’entreprise — critères de choix d’investissement (VAN, TRI, IP, DRCI)' };

/** DRCI par interpolation linéaire dans l'année de récupération. */
function delaiRecuperation(cumuls: Decimal[]): Decimal | null {
  for (let t = 1; t < cumuls.length; t++)
    if (cumuls[t].greaterThanOrEqualTo(0) && cumuls[t - 1].isNegative()) return d(t - 1).plus(cumuls[t - 1].neg().div(cumuls[t].minus(cumuls[t - 1])));
  return cumuls.length && cumuls[0].greaterThanOrEqualTo(0) ? ZERO : null;
}

export const vanTri = formule({
  id: 'van-tri',
  moteur: M,
  nom: 'VAN, TRI, TRIM, IP et délai de récupération',
  categorie: 'Critères de choix',
  description: 'Évalue un projet à partir de l’investissement initial et des flux nets de trésorerie : VAN, TRI, TRI modifié, indice de profitabilité, délai de récupération simple et actualisé.',
  expression: 'VAN = Σ CFt / (1 + k)^t − I0 ; TRI : VAN = 0 ; IP = Σ CFt actualisés / I0 ; TRIM = (VF des flux au taux de réinvestissement / I0)^(1/n) − 1',
  references: [REF_CHOIX],
  champs: [
    montant('investissement', 'Investissement initial (I0)', { defaut: '250000' }),
    liste('flux', 'Flux nets de trésorerie (années 1 à n)', { min: '1', defaut: ['62000', '78000', '85000', '80000', '74000'] }),
    taux('taux', 'Taux d’actualisation', { defaut: '9' }),
    montant('valeurResiduelle', 'Valeur résiduelle et récupération du BFR (année n)', { defaut: '20000' }),
    taux('tauxReinvestissement', 'Taux de réinvestissement (TRIM)', { defaut: '6' }),
  ],
  exemples: [{ titre: 'Projet industriel', entrees: {}, attendu: { van: '55934.94', tri: '16.77', ip: '1.2237', drci: '3.31', drciActualise: '4.08' } }],
  calculer(e, c) {
    const k: Decimal = e.taux;
    const cf = [...(e.flux as Decimal[])];
    cf[cf.length - 1] = cf[cf.length - 1].plus(e.valeurResiduelle);
    const flux = [d(e.investissement).neg(), ...cf];
    let cum = d(e.investissement).neg();
    let cumAct = cum;
    const cumuls = [cum];
    const cumulsAct = [cumAct];
    const lignes = cf.map((f, i) => {
      const t = i + 1;
      const fa = f.div(UN.plus(k).pow(t));
      cum = cum.plus(f);
      cumAct = cumAct.plus(fa);
      cumuls.push(cum);
      cumulsAct.push(cumAct);
      return { annee: String(t), flux: f.toFixed(2), actualise: euros(fa).toFixed(2), cumul: euros(cum).toFixed(2), cumulActualise: euros(cumAct).toFixed(2) };
    });
    const v = c.calc('van', 'Valeur actuelle nette', `Σ CFt / (1 + ${fp(k)})^t − ${fr(e.investissement)}`, euros(van(k, flux)), 'EUR', { principal: true });
    const r = tri(flux);
    if (r) c.calc('tri', 'Taux de rentabilité interne', 'k tel que VAN = 0', r, '%', { principal: true });
    else c.ctrl('avertissement', 'TRI', 'TRI indéterminé (flux sans changement de signe).');
    const sa = somme(cf.map((f, i) => f.div(UN.plus(k).pow(i + 1))));
    c.calc('ip', 'Indice de profitabilité', `${fr(sa)} / ${fr(e.investissement)}`, diviser(sa, e.investissement), 'nombre', { decimales: 4 });
    const n = cf.length;
    const vf = somme(cf.map((f, i) => f.times(UN.plus(e.tauxReinvestissement).pow(n - i - 1))));
    c.calc('trim', 'TRI modifié', `(${fr(vf)} / ${fr(e.investissement)})^(1/${n}) − 1`, vf.div(e.investissement).pow(UN.div(n)).minus(1), '%');
    const dr = delaiRecuperation(cumuls);
    const dra = delaiRecuperation(cumulsAct);
    if (dr) c.calc('drci', 'Délai de récupération (simple)', 'interpolation sur flux cumulés', dr, 'annees', { decimales: 2 });
    else c.ctrl('avertissement', 'NON_RECUPERE', 'Investissement non récupéré sur la durée du projet.');
    if (dra) c.calc('drciActualise', 'Délai de récupération actualisé', 'interpolation sur flux actualisés cumulés', dra, 'annees', { decimales: 2 });
    c.ctrl(v.greaterThan(0) ? 'ok' : 'avertissement', 'DECISION', v.greaterThan(0) ? `VAN positive : le projet crée ${fe(v)} de valeur au taux de ${fp(k, 2)}.` : 'VAN négative : le projet détruit de la valeur au taux exigé.');
    c.tableau({
      titre: 'Flux actualisés',
      colonnes: [
        { cle: 'annee', libelle: 'Année', unite: 'entier' },
        { cle: 'flux', libelle: 'Flux', unite: 'EUR' },
        { cle: 'actualise', libelle: 'Flux actualisé', unite: 'EUR' },
        { cle: 'cumul', libelle: 'Cumul', unite: 'EUR' },
        { cle: 'cumulActualise', libelle: 'Cumul actualisé', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'lignes', x: 'annee', series: ['cumul', 'cumulActualise'] },
    });
    // Profil de VAN
    c.tableau({
      titre: 'Profil de la VAN selon le taux',
      colonnes: [
        { cle: 'taux', libelle: 'Taux', unite: '%' },
        { cle: 'van', libelle: 'VAN', unite: 'EUR' },
      ],
      lignes: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30].map((t) => ({ taux: d(t).toFixed(2), van: euros(van(d(t).div(100), flux)).toFixed(2) })),
      graphique: { type: 'lignes', x: 'taux', series: ['van'] },
    });
  },
});

export const fluxInvestissement = formule({
  id: 'flux-investissement',
  moteur: M,
  nom: 'Construction des flux nets de trésorerie d’un projet',
  categorie: 'Critères de choix',
  description: 'Construit les flux annuels à partir du CA, des charges décaissables, des dotations (économie d’impôt), de la variation du BFR et de la valeur résiduelle nette d’impôt, puis calcule VAN et TRI.',
  expression: 'CAF d’exploitation = (EBE − dotations) × (1 − t) + dotations ; flux = CAF − ΔBFR − investissement + VR nette',
  references: [REF_CHOIX],
  champs: [
    montant('investissement', 'Investissement (amortissable linéairement)', { defaut: '300000' }),
    entier('duree', 'Durée du projet et d’amortissement (années)', { defaut: 5, min: '1', max: '50' }),
    montant('caAnnee1', 'Chiffre d’affaires année 1', { defaut: '400000' }),
    taux('croissance', 'Croissance annuelle du CA', { defaut: '5' }),
    taux('tauxCharges', 'Charges décaissables en % du CA', { defaut: '70' }),
    taux('bfr', 'BFR en % du CA', { defaut: '10' }),
    montant('valeurResiduelle', 'Prix de revente en fin de projet', { defaut: '30000' }),
    taux('tauxIs', 'Taux d’IS', { defaut: '25' }),
    taux('taux', 'Taux d’actualisation', { defaut: '8' }),
  ],
  exemples: [{ titre: 'Nouvelle ligne de production', entrees: {}, attendu: { van: '158831.32', tri: '23.52' } }],
  calculer(e, c) {
    const n: number = e.duree;
    const t: Decimal = e.tauxIs;
    const dot = d(e.investissement).div(n);
    c.etape('Dotation annuelle', `${fr(e.investissement)} / ${n}`, euros(dot), 'EUR');
    const flux: Decimal[] = [d(e.investissement).neg()];
    let bfrPrec = ZERO;
    const lignes: Record<string, string>[] = [];
    for (let a = 1; a <= n; a++) {
      const ca = d(e.caAnnee1).times(UN.plus(e.croissance).pow(a - 1));
      const ebe = ca.times(UN.minus(e.tauxCharges));
      const is = ebe.minus(dot).times(t);
      const caf = ebe.minus(is);
      const bfr = ca.times(e.bfr);
      const dBfr = bfr.minus(bfrPrec);
      bfrPrec = bfr;
      let f = caf.minus(dBfr);
      if (a === n) f = f.plus(bfr).plus(d(e.valeurResiduelle).times(UN.minus(t))); // récupération BFR + VR nette d’IS (VNC nulle)
      flux.push(f);
      lignes.push({ annee: String(a), ca: euros(ca).toFixed(2), ebe: euros(ebe).toFixed(2), is: euros(is).toFixed(2), caf: euros(caf).toFixed(2), dBfr: euros(dBfr).toFixed(2), flux: euros(f).toFixed(2) });
    }
    // ΔBFR de l’année 1 décaissé en début de projet (convention t = 0)
    const v = c.calc('van', 'VAN', `Σ flux / (1 + ${fp(e.taux)})^t`, euros(van(e.taux, flux)), 'EUR', { principal: true });
    const r = tri(flux);
    if (r) c.calc('tri', 'TRI', 'VAN = 0', r, '%', { principal: true });
    c.tableau({
      titre: 'Flux nets de trésorerie',
      colonnes: [
        { cle: 'annee', libelle: 'Année', unite: 'entier' },
        { cle: 'ca', libelle: 'CA', unite: 'EUR' },
        { cle: 'ebe', libelle: 'EBE', unite: 'EUR' },
        { cle: 'is', libelle: 'IS', unite: 'EUR' },
        { cle: 'caf', libelle: 'CAF d’exploitation', unite: 'EUR' },
        { cle: 'dBfr', libelle: 'Δ BFR', unite: 'EUR' },
        { cle: 'flux', libelle: 'Flux net', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'annee', series: ['caf', 'flux'] },
    });
    c.ctrl('info', 'CONVENTION', 'Convention : variation du BFR en fin d’année, BFR récupéré et valeur résiduelle (nette d’IS, VNC nulle) en année n.');
    if (v.isNegative()) c.ctrl('avertissement', 'VAN_NEGATIVE', 'VAN négative au taux exigé.');
  },
});

export const cmpc = formule({
  id: 'cmpc',
  moteur: M,
  nom: 'Coût moyen pondéré du capital (CMPC / WACC)',
  categorie: 'Coût du capital',
  description: 'Pondère le coût des fonds propres et le coût de la dette après impôt par leurs valeurs de marché.',
  expression: 'CMPC = Ke × CP / (CP + D) + Kd × (1 − t) × D / (CP + D)',
  references: [{ texte: 'Finance d’entreprise — coût du capital (Modigliani-Miller avec impôt)' }],
  champs: [
    montant('capitauxPropres', 'Valeur de marché des capitaux propres', { defaut: '6000000' }),
    montant('dettes', 'Valeur de marché de la dette nette', { defaut: '2500000' }),
    taux('coutFondsPropres', 'Coût des fonds propres (Ke)', { defaut: '11.2' }),
    taux('coutDette', 'Coût de la dette avant impôt (Kd)', { defaut: '4.8' }),
    taux('tauxIs', 'Taux d’IS', { defaut: '25' }),
  ],
  exemples: [{ titre: 'ETI', entrees: {}, attendu: { cmpc: '8.96', poidsFondsPropres: '70.59' } }],
  calculer(e, c) {
    const v = d(e.capitauxPropres).plus(e.dettes);
    const wc = c.calc('poidsFondsPropres', 'Poids des fonds propres', `${fr(e.capitauxPropres)} / ${fr(v)}`, d(e.capitauxPropres).div(v), '%');
    const wd = c.calc('poidsDette', 'Poids de la dette', `${fr(e.dettes)} / ${fr(v)}`, d(e.dettes).div(v), '%');
    const kd = c.calc('coutDetteNet', 'Coût de la dette après impôt', `${fp(e.coutDette)} × (1 − ${fp(e.tauxIs)})`, d(e.coutDette).times(UN.minus(e.tauxIs)), '%');
    c.calc('cmpc', 'CMPC', `${fp(e.coutFondsPropres)} × ${fp(wc, 2)} + ${fp(kd, 2)} × ${fp(wd, 2)}`, d(e.coutFondsPropres).times(wc).plus(kd.times(wd)), '%', { principal: true });
  },
});

export const medaf = formule({
  id: 'medaf',
  moteur: M,
  nom: 'Coût des fonds propres (MEDAF) et bêta',
  categorie: 'Coût du capital',
  description: 'Coût des fonds propres par le MEDAF, avec désendettement et réendettement du bêta (formule de Hamada) pour adapter un bêta sectoriel à la structure financière de l’entreprise.',
  expression: 'Ke = Rf + β × (Rm − Rf) [+ prime spécifique] ; βu = βl / (1 + (1 − t) × D/CP) ; βl = βu × (1 + (1 − t) × D/CP)',
  references: [{ texte: 'Sharpe (1964), Lintner (1965) — MEDAF ; Hamada (1972)' }],
  champs: [
    taux('sansRisque', 'Taux sans risque (OAT 10 ans)', { defaut: '3.1' }),
    taux('primeMarche', 'Prime de risque du marché (Rm − Rf)', { defaut: '5.5' }),
    nombre('betaReference', 'Bêta endetté de référence (comparables)', { defaut: '1.15' }),
    nombre('detteSurCpReference', 'D/CP des comparables', { defaut: '0.4' }),
    nombre('detteSurCpCible', 'D/CP de l’entreprise', { defaut: '0.6' }),
    taux('tauxIs', 'Taux d’IS', { defaut: '25' }),
    taux('primeSpecifique', 'Prime spécifique (taille, illiquidité)', { defaut: '1.5' }),
  ],
  exemples: [{ titre: 'PME non cotée', entrees: {}, attendu: { betaDesendette: '0.884615', betaReendette: '1.282692', ke: '11.65' } }],
  calculer(e, c) {
    const f = UN.minus(e.tauxIs);
    const bu = c.calc('betaDesendette', 'Bêta désendetté', `${frn(e.betaReference)} / (1 + ${frn(f)} × ${frn(e.detteSurCpReference)})`, d(e.betaReference).div(UN.plus(f.times(e.detteSurCpReference))), 'nombre');
    const bl = c.calc('betaReendette', 'Bêta réendetté', `${frn(bu)} × (1 + ${frn(f)} × ${frn(e.detteSurCpCible)})`, bu.times(UN.plus(f.times(e.detteSurCpCible))), 'nombre');
    c.calc('ke', 'Coût des fonds propres', `${fp(e.sansRisque)} + ${frn(bl, 4)} × ${fp(e.primeMarche)} + ${fp(e.primeSpecifique)}`, d(e.sansRisque).plus(bl.times(e.primeMarche)).plus(e.primeSpecifique), '%', { principal: true });
  },
});

export const beta = formule({
  id: 'beta',
  moteur: M,
  nom: 'Bêta d’un titre (régression sur le marché)',
  categorie: 'Coût du capital',
  description: 'Estime le bêta d’un titre à partir des séries de rentabilités du titre et du marché, ainsi que le coefficient de corrélation et le R².',
  expression: 'β = cov(Ri, Rm) / var(Rm) ; ρ = cov / (σi × σm) ; α = moy(Ri) − β × moy(Rm)',
  references: [{ texte: 'Modèle de marché (Sharpe, 1963)' }],
  champs: [
    liste('titre', 'Rentabilités du titre (%)', { min: '3', defaut: ['2.1', '-1.4', '3.5', '0.8', '-2.2', '4.1', '1.6', '-0.5', '2.9', '1.2', '-3.1', '2.4'] }),
    liste('marche', 'Rentabilités du marché (%)', { min: '3', defaut: ['1.5', '-0.9', '2.6', '0.4', '-1.8', '3.0', '1.1', '-0.2', '2.0', '0.9', '-2.5', '1.7'] }),
  ],
  exemples: [{ titre: '12 mois', entrees: {}, attendu: { beta: '1.337' } }],
  calculer(e, c) {
    const x = e.marche as Decimal[];
    const y = e.titre as Decimal[];
    if (x.length !== y.length) {
      c.ctrl('erreur', 'LONGUEURS', 'Les deux séries doivent avoir la même longueur.');
      return;
    }
    const cov = covariance(y, x);
    const vm = variance(x);
    const b = c.calc('beta', 'Bêta', `cov(Ri, Rm) / var(Rm) = ${frn(cov, 6)} / ${frn(vm, 6)}`, cov.div(vm), 'nombre', { decimales: 3, principal: true });
    const rho = cov.div(ecartType(y).times(ecartType(x)));
    c.calc('correlation', 'Coefficient de corrélation', 'cov / (σi σm)', rho, 'nombre', { decimales: 4 });
    c.calc('r2', 'R²', 'ρ²', rho.pow(2), '%');
    c.calc('alpha', 'Alpha (% par période)', 'moy(Ri) − β × moy(Rm)', moyenne(y).minus(b.times(moyenne(x))), 'nombre', { decimales: 4 });
    if (x.length < 24) c.ctrl('info', 'ECHANTILLON', 'Moins de 24 observations : estimation peu robuste (usage : 2 à 5 ans de données mensuelles).');
  },
});

export const scenarios = formule({
  id: 'scenarios',
  moteur: M,
  nom: 'Analyse par scénarios',
  categorie: 'Risque',
  description: 'VAN de chaque scénario (pessimiste, réaliste, optimiste…), espérance, écart-type et coefficient de variation de la VAN, probabilité de VAN négative.',
  expression: 'VAN(s) = Σ CF(s) / (1 + k)^t − I0 ; E(VAN) = Σ p(s) × VAN(s) ; σ = √Σ p(s) × (VAN(s) − E)²',
  references: [REF_CHOIX],
  champs: [
    montant('investissement', 'Investissement initial', { defaut: '250000' }),
    entier('duree', 'Durée (années)', { defaut: 5, min: '1' }),
    taux('taux', 'Taux d’actualisation', { defaut: '9' }),
    table('scenarios', 'Scénarios', [texte('scenario', 'Scénario'), taux('probabilite', 'Probabilité'), montant('fluxAnnuel', 'Flux annuel constant')], {
      min: '1',
      defaut: [
        { scenario: 'Pessimiste', probabilite: '25', fluxAnnuel: '52000' },
        { scenario: 'Réaliste', probabilite: '50', fluxAnnuel: '75000' },
        { scenario: 'Optimiste', probabilite: '25', fluxAnnuel: '96000' },
      ],
    }),
  ],
  exemples: [{ titre: 'Trois scénarios', entrees: {}, attendu: { esperance: '39779.02', ecartType: '60540.02', probaVanNegative: '25.00' } }],
  calculer(e, c) {
    type S = { scenario: string; probabilite: Decimal; fluxAnnuel: Decimal };
    const ss = e.scenarios as S[];
    const k: Decimal = e.taux;
    const fa = UN.minus(UN.plus(k).pow(-e.duree)).div(k);
    c.etape('Facteur d’annuité', `(1 − (1 + ${fp(k)})^−${e.duree}) / ${fp(k)}`, fa, 'nombre');
    const vans = ss.map((s) => euros(s.fluxAnnuel.times(fa).minus(e.investissement)));
    const sp = somme(ss.map((s) => s.probabilite));
    if (!sp.equals(1)) c.ctrl('erreur', 'PROBABILITES', `Somme des probabilités : ${fp(sp)} (100 % attendu).`);
    const esp = c.calc('esperance', 'Espérance de la VAN', 'Σ p × VAN', euros(somme(ss.map((s, i) => s.probabilite.times(vans[i])))), 'EUR', { principal: true });
    const v = somme(ss.map((s, i) => s.probabilite.times(vans[i].minus(esp).pow(2))));
    const et = c.calc('ecartType', 'Écart-type de la VAN', '√Σ p × (VAN − E)²', euros(v.sqrt()));
    if (!esp.isZero()) c.calc('coefficientVariation', 'Coefficient de variation', 'σ / E', et.div(esp).abs(), '%');
    c.calc('probaVanNegative', 'Probabilité de VAN négative', 'Σ p des scénarios à VAN < 0', somme(ss.filter((_, i) => vans[i].isNegative()).map((s) => s.probabilite)), '%');
    c.tableau({
      titre: 'VAN par scénario',
      colonnes: [
        { cle: 'scenario', libelle: 'Scénario', unite: 'texte' },
        { cle: 'probabilite', libelle: 'Probabilité', unite: '%' },
        { cle: 'van', libelle: 'VAN', unite: 'EUR' },
      ],
      lignes: ss.map((s, i) => ({ scenario: s.scenario, probabilite: s.probabilite.times(100).toFixed(2), van: vans[i].toFixed(2) })),
      graphique: { type: 'barres', x: 'scenario', series: ['van'] },
    });
  },
});

export const monteCarlo = formule({
  id: 'monte-carlo',
  moteur: M,
  nom: 'Simulation de Monte-Carlo de la VAN',
  categorie: 'Risque',
  description: 'Simule la VAN d’un projet en tirant chaque année un flux selon une loi normale (moyenne, écart-type). Le générateur pseudo-aléatoire est initialisé par une graine : la simulation est reproductible.',
  expression: 'CFt ~ N(μ, σ) ; VAN_s = Σ CFt,s / (1 + k)^t − I0 ; statistiques sur les simulations',
  references: [{ texte: 'Méthode de Monte-Carlo appliquée au choix d’investissement (Hertz, 1964)' }],
  champs: [
    montant('investissement', 'Investissement initial', { defaut: '250000' }),
    entier('duree', 'Durée (années)', { defaut: 5, min: '1', max: '30' }),
    montant('fluxMoyen', 'Flux annuel moyen', { defaut: '75000' }),
    montant('ecartTypeFlux', 'Écart-type du flux annuel', { defaut: '18000' }),
    taux('taux', 'Taux d’actualisation', { defaut: '9' }),
    entier('simulations', 'Nombre de simulations', { defaut: 1000, min: '100', max: '5000' }),
    entier('graine', 'Graine du générateur', { defaut: 42, min: '0' }),
  ],
  exemples: [{ titre: '1 000 tirages, graine 42', entrees: {}, attendu: { simulations: '1000', vanMoyenne: '42495.93', ecartType: '31974.76', probaVanNegative: '7.70' } }],
  calculer(e, c) {
    const u = generateurEntier(e.graine);
    const k: Decimal = e.taux;
    const facteurs = Array.from({ length: e.duree }, (_, t) => UN.div(UN.plus(k).pow(t + 1)));
    const sf = somme(facteurs);
    // Boucle de simulation en virgule fixe entière : VAN = μ Σ v^t − I0 + σ Σ z_t v^t
    const vFixe = facteurs.map((f) => BigInt(f.times('1e15').toDecimalPlaces(0).toFixed()));
    const baseCentimes = BigInt(euros(d(e.fluxMoyen).times(sf).minus(e.investissement)).times(100).toFixed(0));
    const sigmaCentimes = BigInt(euros(e.ecartTypeFlux).times(100).toFixed(0));
    const ECHELLE2 = ECHELLE_FIXE * ECHELLE_FIXE;
    const vans: bigint[] = [];
    for (let s_ = 0; s_ < e.simulations; s_++) {
      let sz = 0n;
      for (let t = 0; t < e.duree; t++) sz += tirageNormalFixe(u) * vFixe[t];
      const x = sigmaCentimes * sz;
      // arrondi au centime le plus proche (demi vers l'infini)
      const q = (x >= 0n ? x + ECHELLE2 / 2n : x - ECHELLE2 / 2n) / ECHELLE2;
      vans.push(baseCentimes + q);
    }
    const n = BigInt(e.simulations);
    const sommeV = vans.reduce((a, b) => a + b, 0n);
    const sommeV2 = vans.reduce((a, b) => a + b * b, 0n);
    const enEuros = (centimes: bigint | Decimal) => d(centimes.toString()).div(100);
    c.res('simulations', 'Simulations', e.simulations, 'entier');
    c.calc('vanTheorique', 'VAN espérée théorique', `${fr(e.fluxMoyen)} × Σ actualisation − ${fr(e.investissement)}`, euros(d(e.fluxMoyen).times(sf).minus(e.investissement)));
    const moy = d(sommeV.toString()).div(n.toString());
    c.calc('vanMoyenne', 'VAN moyenne simulée', 'moyenne des VAN', euros(enEuros(moy)), 'EUR', { principal: true });
    // Variance d'échantillon exacte : (Σx² − (Σx)²/n) / (n − 1)
    const varCentimes = d((sommeV2 * n - sommeV * sommeV).toString()).div((n * (n - 1n)).toString());
    c.calc('ecartType', 'Écart-type de la VAN', 'σ des VAN simulées', euros(enEuros(varCentimes.sqrt())));
    const neg = vans.filter((v) => v < 0n).length;
    c.calc('probaVanNegative', 'Probabilité de VAN négative', `${neg} / ${e.simulations}`, d(neg).div(e.simulations), '%', { principal: true });
    const tries = [...vans].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const cent = (p: number) => {
      const h = (tries.length - 1) * p;
      const b = Math.floor(h);
      const hautI = Math.min(b + 1, tries.length - 1);
      return euros(enEuros(d(tries[b].toString()).plus(d(h - b).times((tries[hautI] - tries[b]).toString()))));
    };
    c.res('p5', 'VAN au 5e centile (VaR 95 %)', cent(0.05));
    c.res('p50', 'VAN médiane', cent(0.5));
    c.res('p95', 'VAN au 95e centile', cent(0.95));
    const mn = tries[0];
    const mx = tries[tries.length - 1];
    const nb = 20n;
    const pas = (mx - mn) / nb || 1n;
    const classes = Array.from({ length: 20 }, () => 0);
    for (const v of vans) classes[Math.min(19, Number((v - mn) / pas))]++;
    c.tableau({
      titre: 'Distribution des VAN simulées',
      colonnes: [
        { cle: 'classe', libelle: 'Centre de classe', unite: 'EUR' },
        { cle: 'effectif', libelle: 'Effectif', unite: 'entier' },
      ],
      lignes: classes.map((nbr, i) => ({ classe: enEuros(mn + pas * BigInt(i) + pas / 2n).toFixed(2), effectif: String(nbr) })),
      graphique: { type: 'barres', x: 'classe', series: ['effectif'] },
    });
    c.ctrl('info', 'REPRODUCTIBLE', `Graine ${e.graine} : le même jeu d’entrées produit exactement les mêmes résultats.`);
  },
});

export const arbreDecision = formule({
  id: 'arbre-decision',
  moteur: M,
  nom: 'Arbre de décision',
  categorie: 'Risque',
  description: 'Calcule l’espérance de gain de chaque option (somme des issues pondérées par leur probabilité, moins le coût de l’option) et recommande l’option dominante.',
  expression: 'E(option) = Σ p(issue) × gain(issue) − coût ; décision = argmax E',
  references: [{ texte: 'Théorie de la décision — critère de l’espérance mathématique' }],
  champs: [
    table('issues', 'Options et issues', [texte('option', 'Option'), texte('issue', 'Issue'), taux('probabilite', 'Probabilité'), montant('gain', 'Gain (VAN)')], {
      min: '1',
      defaut: [
        { option: 'Grande usine', issue: 'Demande forte', probabilite: '60', gain: '900000' },
        { option: 'Grande usine', issue: 'Demande faible', probabilite: '40', gain: '-300000' },
        { option: 'Petite usine', issue: 'Demande forte', probabilite: '60', gain: '450000' },
        { option: 'Petite usine', issue: 'Demande faible', probabilite: '40', gain: '120000' },
        { option: 'Sous-traitance', issue: 'Certaine', probabilite: '100', gain: '260000' },
      ],
    }),
  ],
  exemples: [{ titre: 'Capacité de production', entrees: {}, attendu: { meilleure: 'Grande usine', esperanceMax: '420000.00' } }],
  calculer(e, c) {
    type I = { option: string; issue: string; probabilite: Decimal; gain: Decimal };
    const opts = new Map<string, I[]>();
    for (const i of e.issues as I[]) opts.set(i.option, [...(opts.get(i.option) ?? []), i]);
    let best: [string, Decimal] | null = null;
    const lignes: Record<string, string>[] = [];
    for (const [o, is] of opts) {
      const sp = somme(is.map((i) => i.probabilite));
      if (!sp.equals(1)) c.ctrl('erreur', 'PROBABILITES', `Option « ${o} » : probabilités totalisant ${fp(sp)}.`);
      const esp = euros(somme(is.map((i) => i.probabilite.times(i.gain))));
      const pire = is.reduce((a, b) => (b.gain.lessThan(a.gain) ? b : a)).gain;
      c.etape(`Espérance — ${o}`, is.map((i) => `${fp(i.probabilite)} × ${fr(i.gain)}`).join(' + '), esp, 'EUR');
      lignes.push({ option: o, esperance: esp.toFixed(2), pire: pire.toFixed(2) });
      if (!best || esp.greaterThan(best[1])) best = [o, esp];
    }
    c.res('meilleure', 'Option recommandée (espérance maximale)', best![0], 'texte', { principal: true });
    c.res('esperanceMax', 'Espérance de l’option recommandée', best![1], 'EUR', { principal: true });
    const maximin = lignes.reduce((a, b) => (d(b.pire).greaterThan(a.pire) ? b : a));
    c.res('maximin', 'Option prudente (critère maximin)', maximin.option, 'texte');
    c.tableau({
      titre: 'Comparaison des options',
      colonnes: [
        { cle: 'option', libelle: 'Option', unite: 'texte' },
        { cle: 'esperance', libelle: 'Espérance', unite: 'EUR' },
        { cle: 'pire', libelle: 'Pire issue', unite: 'EUR' },
      ],
      lignes,
      graphique: { type: 'barres', x: 'option', series: ['esperance', 'pire'] },
    });
  },
});

export const choixFinancement = formule({
  id: 'choix-financement',
  moteur: M,
  nom: 'Choix du mode de financement',
  categorie: 'Financement',
  description: 'Compare la valeur actuelle des décaissements nets d’impôt d’un financement par fonds propres, par emprunt et par crédit-bail, et retient la solution la moins coûteuse.',
  expression: 'Emprunt : Σ (annuité − économie d’IS sur intérêts et dotations) actualisés ; crédit-bail : Σ (loyer × (1 − t)) + option − économies d’IS ; actualisation au coût de la dette après impôt',
  references: [REF_CHOIX, { texte: 'Code monétaire et financier art. L.313-7 — crédit-bail' }],
  champs: [
    montant('investissement', 'Montant de l’investissement', { defaut: '200000' }),
    entier('duree', 'Durée d’amortissement et de financement (années)', { defaut: 5, min: '1', max: '30' }),
    taux('tauxIs', 'Taux d’IS', { defaut: '25' }),
    taux('tauxEmprunt', 'Taux de l’emprunt', { defaut: '4.5' }),
    montant('loyerAnnuel', 'Loyer annuel de crédit-bail (début d’année)', { defaut: '45500' }),
    montant('optionAchat', 'Option d’achat (fin de contrat)', { defaut: '2000' }),
    taux('tauxActualisation', 'Taux d’actualisation (coût de la dette après impôt)', { defaut: '3.375' }),
  ],
  exemples: [{ titre: 'Machine 200 000 €', entrees: {}, attendu: { meilleure: 'Emprunt' } }],
  calculer(e, c) {
    const n: number = e.duree;
    const t: Decimal = e.tauxIs;
    const k: Decimal = e.tauxActualisation;
    const I: Decimal = e.investissement;
    const act = (x: Decimal, an: number) => x.div(UN.plus(k).pow(an));
    const dot = I.div(n);
    // Fonds propres : décaissement immédiat, économies d'IS sur dotations
    let fp_ = I;
    for (let a = 1; a <= n; a++) fp_ = fp_.minus(act(dot.times(t), a));
    // Emprunt à annuités constantes
    const i: Decimal = e.tauxEmprunt;
    const annuite = I.times(i).div(UN.minus(UN.plus(i).pow(-n)));
    let crd = I;
    let emp = ZERO;
    for (let a = 1; a <= n; a++) {
      const int = crd.times(i);
      crd = crd.minus(annuite.minus(int));
      emp = emp.plus(act(annuite.minus(int.plus(dot).times(t)), a));
    }
    // Crédit-bail : loyers en début d'année, déductibles ; option en fin, amortie ensuite (simplifié : économie d'IS ignorée)
    let cb = ZERO;
    for (let a = 0; a < n; a++) cb = cb.plus(act(d(e.loyerAnnuel), a)).minus(act(d(e.loyerAnnuel).times(t), a + 1));
    cb = cb.plus(act(d(e.optionAchat), n));
    const opts: [string, Decimal][] = [
      ['Fonds propres', euros(fp_)],
      ['Emprunt', euros(emp)],
      ['Crédit-bail', euros(cb)],
    ];
    opts.forEach(([o, v]) => c.etape(`Coût actualisé — ${o}`, 'Σ décaissements nets d’impôt actualisés', v, 'EUR'));
    c.res('fondsPropres', 'Coût actualisé — fonds propres', opts[0][1]);
    c.res('emprunt', 'Coût actualisé — emprunt', opts[1][1]);
    c.res('creditBail', 'Coût actualisé — crédit-bail', opts[2][1]);
    // Au coût de la dette après impôt, l’emprunt a une VAN nulle : la comparaison pertinente oppose emprunt et crédit-bail.
    const [emprunt_, cb_] = [opts[1], opts[2]];
    const best = cb_[1].lessThan(emprunt_[1]) ? cb_ : emprunt_;
    c.res('meilleure', 'Financement le moins coûteux (emprunt / crédit-bail)', best[0], 'texte', { principal: true });
    c.res('economie', 'Économie actualisée', emprunt_[1].minus(cb_[1]).abs(), 'EUR', { principal: true });
    c.tableau({
      titre: 'Comparaison des financements',
      colonnes: [
        { cle: 'mode', libelle: 'Mode', unite: 'texte' },
        { cle: 'cout', libelle: 'Coût actualisé net d’impôt', unite: 'EUR' },
      ],
      lignes: opts.map(([mode, v]) => ({ mode, cout: v.toFixed(2) })),
      graphique: { type: 'barres', x: 'mode', series: ['cout'] },
    });
    c.ctrl('info', 'HYPOTHESES', 'Hypothèses : amortissement linéaire, économies d’impôt en fin d’année, actualisation au coût de la dette après impôt (l’emprunt est alors équivalent aux fonds propres en valeur actuelle) ; une augmentation de capital s’évalue au coût des fonds propres (MEDAF).');
  },
});

export const formulesInvestissement = [vanTri, fluxInvestissement, cmpc, medaf, beta, scenarios, monteCarlo, arbreDecision, choixFinancement];
