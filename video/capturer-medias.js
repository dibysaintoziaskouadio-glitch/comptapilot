/**
 * Captures haute définition (thème sombre) utilisées par l'animation de présentation.
 * Prérequis : API et Vite démarrés, compte de démonstration. Sortie : video/medias/*.png
 */
const path = require('node:path');
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:5174';
const SORTIE = path.join(__dirname, 'medias');
const COMPTE = { identifiant: 'demo@comptapilot.fr', motDePasse: 'Comptapilot-2026!' };

(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', timeout: 20000 });
  const prepa = await b.newContext();
  await prepa.request.post(`${BASE}/api/auth/connexion`, { data: COMPTE });
  const cookies = await prepa.cookies();
  const prefs = (langue, devise) => prepa.request.patch(`${BASE}/api/auth/preferences`, { data: { langue, devise } });
  const page = async (opts = {}) => {
    const c = await b.newContext({ viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: opts.mobile ? 3 : 2, locale: 'fr-FR', isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
    await c.addInitScript(() => (localStorage.setItem('theme', 'dark'), localStorage.setItem('installation-refusee', String(Date.now() + 9e9))));
    if (!opts.anonyme) await c.addCookies(cookies);
    const p = await c.newPage();
    p.setDefaultTimeout(20000);
    return p;
  };
  const capture = async (p, nom) => {
    await p.waitForTimeout(1600);
    await p.screenshot({ path: path.join(SORTIE, nom + '.png') });
    console.log('  ✓', nom);
  };
  try {
    await prefs('fr', 'EUR');
    let p = await page();
    await p.goto(`${BASE}/`);
    await p.getByText(/moteurs de calcul/i).first().waitFor();
    await capture(p, 'tableau-de-bord');
    await p.goto(`${BASE}/calcul/paie/bulletin`);
    await p.getByText(/Calculé en/).first().waitFor();
    await capture(p, 'bulletin');
    await p.goto(`${BASE}/calcul/tresorerie/emprunt`);
    await p.getByText(/Calculé en/).first().waitFor();
    await p.getByRole('tab', { name: /Tableaux/ }).click();
    await capture(p, 'emprunt-tableau');
    await p.getByRole('tab', { name: /Formules et étapes/ }).click();
    await capture(p, 'emprunt-etapes');
    await p.context().close();

    await prefs('fr', 'XOF');
    p = await page();
    await p.goto(`${BASE}/`);
    await p.getByText(/moteurs de calcul/i).first().waitFor();
    await p.getByRole('button', { name: 'Langue et monnaie' }).click();
    await capture(p, 'preferences-fcfa');
    await p.context().close();
    await prefs('fr', 'EUR');

    p = await page({ anonyme: true });
    await p.goto(`${BASE}/connexion`);
    await p.locator('form').waitFor();
    await capture(p, 'connexion');
    await p.getByRole('button', { name: /^S’inscrire$/ }).click();
    await p.getByPlaceholder('Camille', { exact: true }).fill('Awa');
    await p.getByPlaceholder('Martin', { exact: true }).fill('Koné');
    await p.getByPlaceholder('camille.martin@cabinet.fr').fill('awa.kone@visiontech.ci');
    await p.getByLabel('Pays').selectOption('CI');
    await p.getByPlaceholder('07 01 02 03 04').fill('07 08 09 10 11');
    await p.getByRole('button', { name: /Continuer/ }).click();
    await p.getByPlaceholder('Choisissez un mot de passe').fill('Compta2026#Bilan!');
    await p.getByPlaceholder('Saisissez-le à nouveau').fill('Compta2026#Bilan!');
    await p.getByRole('radio', { name: /WhatsApp/ }).click();
    await capture(p, 'inscription-securite');
    await p.context().close();

    p = await page({ mobile: true, anonyme: true });
    await p.goto(`${BASE}/connexion`);
    await p.locator('form').waitFor();
    await capture(p, 'mobile-connexion');
    await p.context().close();
    p = await page({ mobile: true });
    await p.goto(`${BASE}/`);
    await p.getByText(/moteurs de calcul/i).first().waitFor();
    await capture(p, 'mobile-accueil');
    await p.goto(`${BASE}/calcul/tva/ht-ttc`);
    await p.getByText(/Calculé en/).first().waitFor();
    await p.mouse.wheel(0, 900);
    await capture(p, 'mobile-resultat');
    await p.context().close();
  } finally {
    await prefs('fr', 'EUR').catch(() => {});
    await b.close();
  }
})();
