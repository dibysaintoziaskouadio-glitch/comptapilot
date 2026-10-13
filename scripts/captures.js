/**
 * Captures d'écran de l'interface (Playwright + Chrome système).
 *
 * Prérequis : API (4100) et Vite (5174) démarrés, base de dev accessible.
 * Usage : node scripts/captures.js [urlDeBase]
 * Sortie : docs/screenshots/*.png (ou $CAPTURES_DIR) ; les erreurs de console sont listées à la fin.
 *
 * Chaque étape a un délai explicite ; une étape en échec est signalée sans
 * bloquer les suivantes, et un chien de garde arrête le script après 4 minutes.
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');

const BASE = process.argv[2] || 'http://localhost:5174';
const SORTIE = process.env.CAPTURES_DIR || path.join(__dirname, '..', 'docs', 'screenshots');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const COMPTE = { nom: 'Compte de démonstration', email: 'demo@comptapilot.fr', motDePasse: 'demonstration-2026' };

const DELAI_ACTION = 15_000;
const DELAI_NAVIGATION = 20_000;
const DELAI_CALCUL = 20_000;
const DELAI_GLOBAL = 240_000;

const chien = setTimeout(() => {
  console.error(`Chien de garde : arrêt après ${DELAI_GLOBAL / 1000} s`);
  process.exit(2);
}, DELAI_GLOBAL);

const erreursConsole = [];
const echecs = [];

async function connecter(contexte) {
  const opts = { timeout: DELAI_ACTION };
  let r = await contexte.request.post(`${BASE}/api/auth/connexion`, { data: { email: COMPTE.email, motDePasse: COMPTE.motDePasse }, ...opts });
  if (r.status() === 401) r = await contexte.request.post(`${BASE}/api/auth/inscription`, { data: COMPTE, ...opts });
  if (!r.ok()) throw new Error(`Connexion impossible : HTTP ${r.status()} ${await r.text()}`);
}

async function nouvellePage(navigateur, { sombre = false, mobile = false, connecte = true } = {}) {
  const contexte = await navigateur.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    locale: 'fr-FR',
    colorScheme: sombre ? 'dark' : 'light',
  });
  await contexte.addInitScript((t) => localStorage.setItem('theme', t), sombre ? 'dark' : 'light');
  if (connecte) await connecter(contexte);
  const page = await contexte.newPage();
  page.setDefaultTimeout(DELAI_ACTION);
  page.setDefaultNavigationTimeout(DELAI_NAVIGATION);
  page.on('console', (m) => m.type() === 'error' && erreursConsole.push(`[${page.url()}] ${m.text()}`));
  page.on('pageerror', (e) => erreursConsole.push(`[${page.url()}] exception : ${e.message}`));
  return page;
}

async function aller(page, route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DELAI_NAVIGATION }).catch(() => {});
}

/** Attend la fin du calcul en direct (indicateur « Calculé en … ms »). */
const attendreCalcul = (page) => page.getByText(/Calculé en/).first().waitFor({ timeout: DELAI_CALCUL });

async function capturer(page, nom, { pleinePage = false } = {}) {
  await page.waitForTimeout(400); // fin des animations d'apparition
  const { large, fenetre } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, fenetre: window.innerWidth }));
  if (large > fenetre) echecs.push(`${nom} : défilement horizontal (${large} px pour une fenêtre de ${fenetre} px)`);
  await page.screenshot({ path: path.join(SORTIE, `${nom}.png`), fullPage: pleinePage, timeout: DELAI_ACTION });
  console.log(`  ✓ ${nom}.png`);
}

async function etape(nom, fn) {
  const t0 = Date.now();
  try {
    await fn();
  } catch (e) {
    echecs.push(`${nom} : ${e.message.split('\n')[0]}`);
    console.log(`  ✗ ${nom} (${Date.now() - t0} ms) — ${e.message.split('\n')[0]}`);
  }
}

async function formule(page, route, nom, opts) {
  await aller(page, route);
  await attendreCalcul(page);
  await capturer(page, nom, opts);
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const navigateur = await chromium.launch({ executablePath: CHROME, headless: true, timeout: DELAI_NAVIGATION });
  try {
    console.log('Thème clair');
    // Le compte de démonstration doit exister pour que l'écran montre la connexion, pas le premier démarrage.
    const prepa = await navigateur.newContext();
    await connecter(prepa);
    await prepa.close();
    const anonyme = await nouvellePage(navigateur, { connecte: false });
    await etape('connexion', async () => {
      await aller(anonyme, '/connexion');
      await anonyme.locator('form').waitFor();
      await capturer(anonyme, '01-connexion');
    });
    await anonyme.context().close();

    const p = await nouvellePage(navigateur);
    await etape('tableau de bord', async () => {
      await aller(p, '/');
      await p.getByText(/moteurs/i).first().waitFor();
      await p.waitForTimeout(1200); // fin de l'animation du graphique d'activité
      await capturer(p, '02-tableau-de-bord', { pleinePage: true });
    });
    await etape('bulletin', () => formule(p, '/calcul/paie/bulletin', '03-bulletin', { pleinePage: true }));
    await etape('emprunt', async () => {
      await aller(p, '/calcul/tresorerie/emprunt');
      await attendreCalcul(p);
      await p.getByRole('tab', { name: /Tableaux/ }).or(p.getByRole('button', { name: /Tableaux/ })).first().click();
      await capturer(p, '04-emprunt', { pleinePage: true });
    });
    await etape('ca3', () => formule(p, '/calcul/tva/ca3', '05-ca3', { pleinePage: true }));
    await etape('balance', () => formule(p, '/calcul/financier/etats-depuis-balance', '06-balance', { pleinePage: true }));
    await etape('moteur tva', async () => {
      await aller(p, '/moteur/tva');
      await p.getByText(/CA3/).first().waitFor();
      await capturer(p, '07-moteur-tva', { pleinePage: true });
    });
    await etape('barèmes', async () => {
      await aller(p, '/baremes');
      await p.getByText(/tva\.taux|paie\.constantes/).first().waitFor();
      await capturer(p, '08-baremes', { pleinePage: true });
    });
    await etape('historique', async () => {
      await aller(p, '/historique');
      await p.locator('main').waitFor();
      await capturer(p, '09-historique');
    });
    await etape('palette', async () => {
      await aller(p, '/');
      await p.keyboard.press('Control+k');
      const recherche = p.locator('input:focus');
      await recherche.waitFor();
      await recherche.pressSequentially('amortissement', { delay: 20 });
      await p.waitForTimeout(300);
      await capturer(p, '10-palette');
    });
    await p.context().close();

    console.log('Thème sombre');
    const s = await nouvellePage(navigateur, { sombre: true });
    await etape('monte-carlo sombre', () => formule(s, '/calcul/investissement/monte-carlo', '11-sombre-montecarlo', { pleinePage: true }));
    await etape('accueil sombre', async () => {
      await aller(s, '/');
      await s.getByText(/moteurs/i).first().waitFor();
      await s.waitForTimeout(1200);
      await capturer(s, '12-sombre-accueil');
    });
    await s.context().close();

    console.log('Mobile');
    const m = await nouvellePage(navigateur, { mobile: true });
    await etape('mobile', () => formule(m, '/calcul/tva/ht-ttc', '13-mobile', { pleinePage: true }));
    await m.context().close();
  } finally {
    await navigateur.close();
    clearTimeout(chien);
  }

  console.log(`\nErreurs de console : ${erreursConsole.length}`);
  for (const e of [...new Set(erreursConsole)]) console.log(`  - ${e}`);
  console.log(`Étapes en échec : ${echecs.length}`);
  for (const e of echecs) console.log(`  - ${e}`);
  process.exit(echecs.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
