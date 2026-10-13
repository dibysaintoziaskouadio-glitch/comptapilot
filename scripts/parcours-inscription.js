/**
 * Parcours complet en navigateur, en mode démonstration (CODES_VISIBLES=true) :
 * inscription en trois étapes, saisie d'un code faux puis des deux bons codes, arrivée sur le tableau de bord,
 * mot de passe oublié par e-mail, puis connexion avec le numéro de téléphone et le nouveau mot de passe.
 * Le compte de test est supprimé à la fin.
 *
 * Usage : node scripts/parcours-inscription.js [urlDeBase]   (nettoyage via backend/.env)
 */
const path = require('node:path');
const { chromium } = require('playwright-core');
const BASE = process.argv[2] || 'http://localhost:5174';
const SORTIE = process.env.CAPTURES_DIR || path.join(__dirname, '..', 'docs', 'screenshots');
const EMAIL = `awa.kone.${Date.now()}@exemple.ci`;
const D = 15000;
const erreurs = [];
const cap = async (p, nom, pleine) => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(SORTIE, nom + '.png'), fullPage: !!pleine }); console.log('  ✓', nom); };
const codesDemo = async (p) => (await p.locator('[role="note"] strong').allTextContents()).map((s) => s.trim());
const saisirCode = async (p, groupe, code) => { await p.getByRole('group', { name: groupe }).locator('input').first().click(); await p.keyboard.type(code, { delay: 40 }); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', timeout: 20000 });
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
  await c.addInitScript(() => (localStorage.setItem('langue', 'fr'), localStorage.setItem('devise', 'XOF')));
  const p = await c.newPage();
  p.setDefaultTimeout(D);
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/40[13]|422|429/.test(m.text()) && erreurs.push(m.text()));
  try {
    await p.goto(BASE + '/connexion');
    await p.getByRole('button', { name: /^S’inscrire$/ }).click();
    await p.getByPlaceholder('Camille', { exact: true }).fill('Awa');
    await p.getByPlaceholder('Martin', { exact: true }).fill('Koné');
    await p.getByPlaceholder('camille.martin@cabinet.fr').fill(EMAIL);
    await p.getByLabel('Pays').selectOption('CI');
    await p.getByPlaceholder('07 01 02 03 04').fill('07 08 09 10 11');
    await cap(p, '01b-inscription-identite');
    await p.getByRole('button', { name: /Continuer/ }).click();
    await p.getByPlaceholder('Choisissez un mot de passe').pressSequentially('Compta2026', { delay: 10 });
    await cap(p, '01c-inscription-mot-de-passe');
    await p.getByPlaceholder('Choisissez un mot de passe').pressSequentially('#Bilan!', { delay: 10 });
    await p.getByPlaceholder('Saisissez-le à nouveau').fill('Compta2026#Bilan!');
    await p.getByRole('radio', { name: /WhatsApp/ }).click();
    await cap(p, '01d-inscription-valide');
    await p.getByRole('button', { name: /Créer le compte/ }).click();
    await p.getByText('Confirmez vos coordonnées').waitFor();
    const [codeEmail, codeTel] = await codesDemo(p);
    console.log('  codes démo', codeEmail, codeTel);
    await cap(p, '01e-inscription-verification');
    // Un code faux d'abord, pour voir le message
    await saisirCode(p, 'Code reçu par e-mail', codeEmail === '000000' ? '111111' : '000000');
    await p.getByText(/Code incorrect\. 4 essais restants/).waitFor();
    await saisirCode(p, 'Code reçu par e-mail', codeEmail);
    await p.getByText('Confirmé').waitFor();
    await cap(p, '01f-inscription-email-confirme');
    await saisirCode(p, 'Code reçu par WhatsApp', codeTel);
    await p.waitForURL(BASE + '/', { timeout: D });
    await p.getByText(/moteurs de calcul/i).first().waitFor();
    console.log('  ✓ compte activé, tableau de bord affiché');

    // Mot de passe oublié
    await c.clearCookies();
    await p.goto(BASE + '/connexion');
    await p.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await p.getByPlaceholder(/vous@cabinet.fr/).fill(EMAIL);
    await cap(p, '01g-oubli-demande');
    await p.getByRole('button', { name: /Recevoir un code/ }).click();
    await p.getByText(/un code vient d’être envoyé/).waitFor();
    const [codeReinit] = await codesDemo(p);
    await saisirCode(p, 'Code reçu', codeReinit);
    await p.getByPlaceholder('Choisissez un mot de passe').fill('Nouveau#Grand-Livre-27');
    await p.getByPlaceholder('Saisissez-le à nouveau').fill('Nouveau#Grand-Livre-27');
    await cap(p, '01h-oubli-nouveau-mot-de-passe');
    await p.getByRole('button', { name: /Changer le mot de passe/ }).click();
    await p.getByText('Mot de passe modifié. Connectez-vous avec le nouveau.').waitFor();
    await cap(p, '01i-oubli-succes');
    // Connexion avec le numéro de téléphone
    await p.getByPlaceholder(/vous@cabinet.fr/).fill('+225 07 08 09 10 11');
    await p.getByPlaceholder('Votre mot de passe').fill('Nouveau#Grand-Livre-27');
    await p.getByRole('button', { name: /^Se connecter/ }).last().click();
    await p.waitForURL(BASE + '/', { timeout: D });
    console.log('  ✓ connexion par téléphone avec le nouveau mot de passe');
  } catch (e) {
    erreurs.push('ÉCHEC : ' + e.message.split('\n')[0]);
    await p.screenshot({ path: path.join(SORTIE, 'echec.png') }).catch(() => {});
  }
  console.log('erreurs :', erreurs);
  await b.close();
  // Nettoyage : suppression du compte de test (base de développement, via le client Prisma du backend).
  try {
    require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'backend', '.env') });
    const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '@prisma/client'));
    const prisma = new PrismaClient();
    const r = await prisma.utilisateur.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
    console.log('compte de test supprimé :', r.count);
  } catch (e) {
    console.log('compte de test à supprimer à la main :', EMAIL, '-', e.message.split('\n')[0]);
  }
  process.exit(erreurs.length ? 1 : 0);
})();
