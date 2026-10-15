/**
 * Tests d'intégration de l'API sur une base PostgreSQL de test (DATABASE_URL_TEST).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://compta:compta@localhost:5433/compta_test?schema=public';
process.env.JWT_SECRET = 'secret-de-test-suffisamment-long-pour-jwt-0123456789';
// Aucun fournisseur d'envoi en test : les codes sont renvoyés dans les réponses (mode démonstration).
process.env.CODES_VISIBLES = 'true';

import request from 'supertest';
import { creerApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { synchroniserBaremes } from '../src/modules/baremes/baremes.service';
import { arreterExecuteur } from '../src/modules/calc/executeur';
import * as expediteur from '../src/modules/notifications/expediteur';

// Messages « envoyés » : les codes de réinitialisation ne sont jamais renvoyés par l'API, on les lit ici comme le destinataire.
const envoyes: string[] = [];
jest.spyOn(expediteur, 'envoyer').mockImplementation(async (m) => {
  envoyes.push(m.texte);
  return false;
});
const dernierCode = () => /\b(\d{6})\b/.exec(envoyes[envoyes.length - 1])![1];

const app = creerApp();
const admin = request.agent(app);
const comptable = request.agent(app);

type Agent = ReturnType<typeof request.agent>;
/** Inscription complète : création puis saisie des deux codes reçus (e-mail et téléphone). */
async function inscrire(agent: Agent, donnees: Record<string, unknown>) {
  const r = await agent.post('/api/auth/inscription').send(donnees);
  if (r.status !== 201) return r;
  const v = r.body.verification;
  await agent.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: v.codesDemo.email });
  return agent.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'telephone', code: v.codesDemo.telephone });
}

beforeAll(async () => {
  await prisma.journalAudit.deleteMany();
  await prisma.calcul.deleteMany();
  await prisma.versionBareme.deleteMany();
  await prisma.utilisateur.deleteMany();
  await synchroniserBaremes();
});
afterAll(async () => {
  await arreterExecuteur();
  await prisma.$disconnect();
});

describe('Authentification', () => {
  test('les routes de calcul exigent une session', async () => {
    const r = await request(app).get('/api/calc/catalogue');
    expect(r.status).toBe(401);
  });
  test('le premier compte est administrateur, après confirmation de l’e-mail et du téléphone', async () => {
    const r = await admin.post('/api/auth/inscription').send({ email: 'Admin@Cabinet.fr', nom: 'Admin', telephone: '07 01 02 03 04', pays: 'CI', motDePasse: 'Grand-Livre#2026' });
    expect(r.status).toBe(201);
    expect(r.headers['set-cookie']).toBeUndefined(); // pas de session avant confirmation
    const v = r.body.verification;
    expect(v).toMatchObject({ emailVerifie: false, telephoneVerifie: false, canalTelephone: 'SMS' });
    expect(v.email).toMatch(/^a•+@cabinet\.fr$/);
    expect(v.telephone).toMatch(/04$/);
    expect(v.codesDemo.email).toMatch(/^\d{6}$/);
    expect((await admin.get('/api/calc/catalogue')).status).toBe(401);

    const e = await admin.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: v.codesDemo.email });
    expect(e.body.verification).toMatchObject({ emailVerifie: true, telephoneVerifie: false });
    const t = await admin.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'telephone', code: v.codesDemo.telephone });
    expect(t.status).toBe(200);
    expect(t.body.utilisateur).toMatchObject({ email: 'admin@cabinet.fr', role: 'ADMIN', telephone: '+2250701020304' });
    expect(t.headers['set-cookie'][0]).toMatch(/compta_session=.*HttpOnly/);
  });
  test('les comptes suivants sont comptables ; code par WhatsApp', async () => {
    const r = await inscrire(comptable, { email: 'compta@cabinet.fr', nom: 'Camille', telephone: '+33612345678', canalTelephone: 'WHATSAPP', motDePasse: 'Balance&Bilan-42' });
    expect(r.body.utilisateur.role).toBe('COMPTABLE');
  });
  test('validation des données, doublons et identifiants incorrects', async () => {
    expect((await request(app).post('/api/auth/inscription').send({ email: 'x', nom: 'A', telephone: '12', motDePasse: 'court' })).status).toBe(422);
    const tel = await request(app).post('/api/auth/inscription').send({ email: 'z@cabinet.fr', nom: 'Zoé Test', telephone: '12345', pays: 'CI', motDePasse: 'Grand-Livre#2026' });
    expect(tel.body.erreur.details[0]).toMatchObject({ champ: 'telephone' });
    expect((await request(app).post('/api/auth/connexion').send({ email: 'admin@cabinet.fr', motDePasse: 'mauvais' })).status).toBe(401);
    const doublon = await request(app).post('/api/auth/inscription').send({ email: 'admin@cabinet.fr', nom: 'Bis', telephone: '+2250501020304', motDePasse: 'Grand-Livre#2026' });
    expect(doublon.status).toBe(409);
    expect(doublon.body.erreur.code).toBe('EMAIL_UTILISE');
    const numero = await request(app).post('/api/auth/inscription').send({ email: 'autre@cabinet.fr', nom: 'Autre', telephone: '+33612345678', motDePasse: 'Grand-Livre#2026' });
    expect(numero.body.erreur.code).toBe('TELEPHONE_UTILISE');
  });
  test('politique de mot de passe à l’inscription', async () => {
    const essai = (motDePasse: string, nom = 'Dominique Martin') => request(app).post('/api/auth/inscription').send({ email: 'dominique.martin@cabinet.fr', nom, telephone: '+2250102030405', motDePasse });
    for (const faible of ['Court#1a', 'sansmajuscule#2026', 'SANSMINUSCULE#2026', 'SansChiffre#Ici', 'SansSpecial2026x', 'Martin-Compta#2026']) {
      const r = await essai(faible);
      expect(r.status).toBe(422);
      expect(r.body.erreur.details[0].champ).toBe('motDePasse');
    }
    expect((await essai('Dominique#Paie-2026')).body.erreur.details[0].message).toMatch(/nom ni votre e-mail/);
  });
  test('connexion par e-mail ou par téléphone', async () => {
    const a = request.agent(app);
    expect((await a.post('/api/auth/connexion').send({ identifiant: 'compta@cabinet.fr', motDePasse: 'Balance&Bilan-42' })).status).toBe(200);
    expect((await a.get('/api/auth/moi')).body.utilisateur.nom).toBe('Camille');
    expect((await request(app).post('/api/auth/connexion').send({ identifiant: '06 12 34 56 78', pays: 'FR', motDePasse: 'Balance&Bilan-42' })).status).toBe(200);
    expect((await request(app).post('/api/auth/connexion').send({ email: 'compta@cabinet.fr', motDePasse: 'Balance&Bilan-42' })).status).toBe(200); // ancien format
  });
  test('code faux : essais comptés puis épuisés ; renvoi limité dans le temps', async () => {
    const a = request.agent(app);
    const r = await a.post('/api/auth/inscription').send({ email: 'lent@cabinet.fr', nom: 'Léa Lente', telephone: '+2250708091011', motDePasse: 'Grand-Livre#2026' });
    const v = r.body.verification;
    const faux = v.codesDemo.email === '000000' ? '111111' : '000000';
    const e1 = await a.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: faux });
    expect(e1.status).toBe(422);
    expect(e1.body.erreur).toMatchObject({ code: 'CODE_INCORRECT', details: { restants: 4 } });
    for (let i = 0; i < 4; i++) await a.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: faux });
    expect((await a.post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: v.codesDemo.email })).body.erreur.code).toBe('CODE_EPUISE');
    const renvoi = await a.post('/api/auth/verification/renvoyer').send({ jeton: v.jeton, cible: 'email' });
    expect(renvoi.status).toBe(429);
    expect(renvoi.body.erreur.code).toBe('PATIENTER');
    // Compte non confirmé : la connexion renvoie vers la vérification, sans session.
    const c = await a.post('/api/auth/connexion').send({ identifiant: 'lent@cabinet.fr', motDePasse: 'Grand-Livre#2026' });
    expect(c.status).toBe(403);
    expect(c.body.erreur.code).toBe('COMPTE_NON_VERIFIE');
    expect(c.body.verification.jeton).toBeTruthy();
    expect(c.headers['set-cookie']).toBeUndefined();
    expect((await a.post('/api/auth/verification/verifier').send({ jeton: 'faux.jeton.signe', cible: 'email', code: '123456' })).body.erreur.code).toBe('VERIFICATION_EXPIREE');
  });
  test('mot de passe oublié : code par e-mail puis nouveau mot de passe', async () => {
    const inconnu = await request(app).post('/api/auth/mot-de-passe/oubli').send({ identifiant: 'personne@nulle-part.fr', canal: 'EMAIL' });
    expect(inconnu.status).toBe(200);
    expect(inconnu.body).toEqual({ envoye: true, nonEnvoye: true }); // même réponse : pas d'énumération
    const ancienneSession = request.agent(app);
    expect((await ancienneSession.post('/api/auth/connexion').send({ identifiant: 'compta@cabinet.fr', motDePasse: 'Balance&Bilan-42' })).status).toBe(200);
    const o = await request(app).post('/api/auth/mot-de-passe/oubli').send({ identifiant: 'compta@cabinet.fr', canal: 'EMAIL' });
    // Mode démonstration : le code n'est jamais affiché (sinon n'importe qui pourrait prendre le compte).
    expect(o.body).toEqual({ envoye: true, nonEnvoye: true });
    const code = dernierCode();
    const faible = await request(app).post('/api/auth/mot-de-passe/reinitialiser').send({ identifiant: 'compta@cabinet.fr', code, motDePasse: 'faible' });
    expect(faible.body.erreur.details[0].champ).toBe('motDePasse');
    const ok = await request(app).post('/api/auth/mot-de-passe/reinitialiser').send({ identifiant: 'compta@cabinet.fr', code, motDePasse: 'Nouveau#Bilan-2027' });
    expect(ok.body).toEqual({ reinitialise: true });
    expect((await request(app).post('/api/auth/mot-de-passe/reinitialiser').send({ identifiant: 'compta@cabinet.fr', code, motDePasse: 'Encore#Bilan-2028' })).body.erreur.code).toBe('CODE_INCORRECT'); // usage unique
    expect((await request(app).post('/api/auth/connexion').send({ identifiant: 'compta@cabinet.fr', motDePasse: 'Balance&Bilan-42' })).status).toBe(401);
    expect((await ancienneSession.get('/api/auth/moi')).status).toBe(401); // sessions ouvertes avant le changement : fermées
    expect((await comptable.post('/api/auth/connexion').send({ identifiant: 'compta@cabinet.fr', motDePasse: 'Nouveau#Bilan-2027' })).status).toBe(200);
  });
  test('mot de passe oublié par SMS avec le numéro de téléphone', async () => {
    const o = await request(app).post('/api/auth/mot-de-passe/oubli').send({ identifiant: '0701020304', pays: 'CI', canal: 'SMS' });
    expect(o.body.codeDemo).toBeUndefined();
    const ok = await request(app).post('/api/auth/mot-de-passe/reinitialiser').send({ identifiant: '+2250701020304', code: dernierCode(), motDePasse: 'Grand-Livre#2027' });
    expect(ok.body).toEqual({ reinitialise: true });
    expect((await admin.post('/api/auth/connexion').send({ identifiant: 'admin@cabinet.fr', motDePasse: 'Grand-Livre#2027' })).status).toBe(200);
  });
  test('essais simultanés : jamais plus de 5 par code', async () => {
    const r = await request(app).post('/api/auth/inscription').send({ email: 'rafale@cabinet.fr', nom: 'Rafale', telephone: '+2250708091099', motDePasse: 'Grand-Livre#2026' });
    const v = r.body.verification;
    const faux = v.codesDemo.email === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 12 }, () => request(app).post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: faux })));
    const c = await prisma.codeVerification.findFirst({ where: { objet: 'VERIFICATION_EMAIL', destination: 'rafale@cabinet.fr' } });
    expect(c!.tentatives).toBe(5);
    expect((await request(app).post('/api/auth/verification/verifier').send({ jeton: v.jeton, cible: 'email', code: v.codesDemo.email })).body.erreur.code).toBe('CODE_EPUISE');
  });
  test('corps de requête limité hors calculs', async () => {
    const r = await request(app).post('/api/auth/connexion').send({ identifiant: 'x'.repeat(200_000), motDePasse: 'x' });
    expect(r.status).toBe(413);
  });
  test('état public : canaux disponibles et mode démonstration', async () => {
    const r = await request(app).get('/api/auth/etat');
    expect(r.body).toMatchObject({ premierDemarrage: false, canaux: { email: true, sms: true, whatsapp: true }, demonstration: true });
  });
});

describe('Moteur de calcul', () => {
  test('catalogue des 13 moteurs', async () => {
    const r = await comptable.get('/api/calc/catalogue');
    expect(r.status).toBe(200);
    expect(r.body.moteurs).toHaveLength(13);
    expect(r.body.moteurs.reduce((n: number, m: { formules: unknown[] }) => n + m.formules.length, 0)).toBeGreaterThanOrEqual(160);
  });
  test('description d’une formule', async () => {
    const r = await comptable.get('/api/calc/tva/ht-ttc');
    expect(r.body.formule).toMatchObject({ id: 'ht-ttc', moteur: 'tva' });
    expect((await comptable.get('/api/calc/tva/nexiste-pas')).status).toBe(404);
  });
  test('exécution sans enregistrement : résultat, trace, empreinte', async () => {
    const r = await comptable.post('/api/calc/tva/ht-ttc').send({ entrees: { depuis: 'HT', montant: '1000', taux: '20' } });
    expect(r.status).toBe(200);
    expect(r.body.resultat.resultats.ttc.valeur).toBe('1200.00');
    expect(r.body.resultat.etapes.length).toBeGreaterThan(0);
    expect(r.body.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(r.body.calculId).toBeUndefined();
    const r2 = await comptable.post('/api/calc/tva/ht-ttc').send({ entrees: { taux: '20', montant: '1000', depuis: 'HT' } });
    expect(r2.body.empreinte).toBe(r.body.empreinte);
  });
  test('entrées invalides → 422 détaillé', async () => {
    const r = await comptable.post('/api/calc/tva/ht-ttc').send({ entrees: { montant: 'abc' } });
    expect(r.status).toBe(422);
    expect(r.body.erreur.details[0]).toEqual({ champ: 'montant', message: 'nombre attendu' });
  });
  test('saisies démesurées refusées sans bloquer le serveur', async () => {
    const loyers = await comptable.post('/api/calc/amortissements/credit-bail').send({ entrees: { nbRedevances: '100000000' } });
    expect(loyers.status).toBe(422);
    expect(loyers.body.erreur.details[0]).toEqual({ champ: 'nbRedevances', message: 'doit être ≤ 600' });
    const duree = await comptable.post('/api/calc/tresorerie/interets-placement').send({ entrees: { calcul: 'composes', duree: '100000000' } });
    expect(duree.status).toBe(422);
    expect(duree.body.erreur.code).toBe('CALCUL_IMPOSSIBLE');
    const enorme = await comptable.post('/api/calc/base/repartition-proportionnelle').send({ entrees: { total: '9'.repeat(40) } });
    expect(enorme.body.erreur.details[0]).toEqual({ champ: 'total', message: 'valeur hors limites' });
    // Le serveur répond toujours normalement.
    expect((await comptable.post('/api/calc/tva/ht-ttc').send({ entrees: { depuis: 'HT', montant: '1000', taux: '20' } })).status).toBe(200);
  });
});

describe('Préférences de langue et de monnaie', () => {
  test('valeurs par défaut, modification et contrôle', async () => {
    expect((await comptable.get('/api/auth/moi')).body.utilisateur).toMatchObject({ langue: 'fr', devise: 'EUR' });
    const r = await comptable.patch('/api/auth/preferences').send({ langue: 'en', devise: 'XOF' });
    expect(r.status).toBe(200);
    expect((await comptable.get('/api/auth/moi')).body.utilisateur).toMatchObject({ langue: 'en', devise: 'XOF' });
    expect((await comptable.patch('/api/auth/preferences').send({ devise: 'BTC' })).status).toBe(422);
    expect((await comptable.patch('/api/auth/preferences').send({ langue: 'de' })).status).toBe(422);
    expect((await comptable.patch('/api/auth/preferences').send({})).status).toBe(422);
    await comptable.patch('/api/auth/preferences').send({ langue: 'fr', devise: 'EUR' });
  });
  test('la monnaie est archivée avec le calcul et distingue l’empreinte', async () => {
    const entrees = { connu: 'ht', montant: '1000', taux: '18' };
    const eur = await comptable.post('/api/calc/tva/ht-ttc').send({ entrees });
    const xof = await comptable.post('/api/calc/tva/ht-ttc').send({ entrees, devise: 'XOF', enregistrer: true });
    expect(xof.body.resultat.resultats).toEqual(eur.body.resultat.resultats); // aucune conversion
    expect(xof.body.empreinte).not.toBe(eur.body.empreinte);
    const c = (await comptable.get(`/api/historique/${xof.body.calculId}`)).body.calcul;
    expect(c).toMatchObject({ devise: 'XOF', principalValeur: '180.00', principalUnite: 'EUR' });
    await comptable.delete(`/api/historique/${xof.body.calculId}`);
    expect((await comptable.post('/api/calc/tva/ht-ttc').send({ entrees, devise: 'BTC' })).status).toBe(422);
  });
});

describe('Historique des calculs', () => {
  let id = '';
  test('enregistrement dans le journal', async () => {
    const r = await comptable.post('/api/calc/paie/bulletin').send({ entrees: { dateOperation: '2024-06-30', salaireBase: '3200' }, enregistrer: true, libelle: 'Paie juin — Dupont' });
    id = r.body.calculId;
    expect(id).toBeTruthy();
    const liste = await comptable.get('/api/historique');
    expect(liste.body.total).toBe(1);
    expect(liste.body.calculs[0]).toMatchObject({ libelle: 'Paie juin — Dupont', statut: 'BROUILLON', moteur: 'paie' });
  });
  test('isolation entre utilisateurs', async () => {
    expect((await admin.get('/api/historique')).body.total).toBe(0);
    expect((await admin.get(`/api/historique/${id}`)).status).toBe(404);
  });
  test('validation puis suppression interdite', async () => {
    const v = await comptable.patch(`/api/historique/${id}`).send({ valider: true });
    expect(v.body.calcul.statut).toBe('VALIDE');
    expect((await comptable.delete(`/api/historique/${id}`)).status).toBe(409);
    const s = await comptable.get('/api/historique/statistiques');
    expect(s.body).toMatchObject({ total: 1, valides: 1, parMoteur: { paie: 1 } });
  });
  test('suppression d’un brouillon', async () => {
    const r = await comptable.post('/api/calc/base/arrondi').send({ entrees: {}, enregistrer: true });
    expect((await comptable.delete(`/api/historique/${r.body.calculId}`)).status).toBe(204);
    expect(await prisma.journalAudit.count({ where: { action: 'SUPPRESSION_CALCUL', cible: r.body.calculId } })).toBe(1);
  });
});

describe('Barèmes versionnés', () => {
  test('liste avec versions et statut', async () => {
    const r = await comptable.get('/api/baremes');
    const pmss = r.body.baremes.find((b: { code: string }) => b.code === 'paie.constantes');
    expect(pmss.versions.length).toBeGreaterThanOrEqual(4);
    expect(await prisma.versionBareme.count()).toBeGreaterThan(20);
  });
  test('seul un administrateur ajoute une version', async () => {
    const v = { du: '2027-01-01', valeurs: { pmss: '4100', smicHoraire: '12.30', dureeLegaleMensuelle: '151.67' }, source: 'Arrêté PASS 2027 (test)' };
    expect((await comptable.post('/api/baremes/paie.constantes/versions').send(v)).status).toBe(403);
    expect((await admin.post('/api/baremes/paie.constantes/versions').send({ ...v, valeurs: { pmss: '1' } })).status).toBe(422);
    expect((await admin.post('/api/baremes/paie.constantes/versions').send(v)).status).toBe(201);
    // La nouvelle version est appliquée immédiatement selon la date d'opération.
    const r = await comptable.post('/api/calc/paie/conversion-salaire').send({ entrees: { dateOperation: '2027-03-31', montant: '2460' } });
    expect(r.body.resultat.baremes[0]).toMatchObject({ du: '2027-01-01', source: 'Arrêté PASS 2027 (test)' });
    expect(r.body.resultat.resultats.ratioSmic.valeur).toBe('131.87');
  });
});

describe('Administration des comptes', () => {
  const cible = request.agent(app);
  test('réservée aux administrateurs', async () => {
    expect((await comptable.get('/api/admin/utilisateurs')).status).toBe(403);
    expect((await request(app).get('/api/admin/utilisateurs')).status).toBe(401);
  });
  test('liste des comptes avec activité et journal des connexions', async () => {
    await request(app).post('/api/auth/connexion').send({ identifiant: 'compta@cabinet.fr', motDePasse: 'Mauvais#Essai-1' });
    const r = await admin.get('/api/admin/utilisateurs');
    expect(r.status).toBe(200);
    const moi = r.body.utilisateurs.find((u: { email: string }) => u.email === 'admin@cabinet.fr');
    expect(moi).toMatchObject({ role: 'ADMIN', actif: true, enLigne: true, confirme: true });
    expect(moi.motDePasse).toBeUndefined();
    const j = await admin.get('/api/admin/connexions');
    expect(j.body.evenements[0]).toMatchObject({ action: 'CONNEXION_ECHOUEE', cible: 'compta@cabinet.fr' });
  });
  test('désactivation : sessions fermées et connexion refusée, puis réactivation', async () => {
    const r = await inscrire(cible, { email: 'stagiaire@cabinet.fr', nom: 'Sacha Stagiaire', telephone: '+2250708091077', motDePasse: 'Grand-Livre#2026' });
    const id = r.body.utilisateur.id;
    expect((await cible.get('/api/auth/moi')).status).toBe(200);
    expect((await admin.patch(`/api/admin/utilisateurs/${id}`).send({ actif: false })).body.utilisateur.actif).toBe(false);
    expect((await cible.get('/api/auth/moi')).status).toBe(401);
    const c = await request(app).post('/api/auth/connexion').send({ identifiant: 'stagiaire@cabinet.fr', motDePasse: 'Grand-Livre#2026' });
    expect(c.body.erreur.code).toBe('COMPTE_DESACTIVE');
    await admin.patch(`/api/admin/utilisateurs/${id}`).send({ actif: true, role: 'LECTEUR' });
    const c2 = await cible.post('/api/auth/connexion').send({ identifiant: 'stagiaire@cabinet.fr', motDePasse: 'Grand-Livre#2026' });
    expect(c2.body.utilisateur.role).toBe('LECTEUR');
    expect(await prisma.journalAudit.count({ where: { action: { in: ['COMPTE_DESACTIVE', 'COMPTE_REACTIVE', 'CHANGEMENT_ROLE'] }, cible: 'stagiaire@cabinet.fr' } })).toBe(3);
  });
  test('impossible de se modifier soi-même ou de retirer le dernier administrateur', async () => {
    const moi = (await admin.get('/api/auth/moi')).body.utilisateur.id;
    expect((await admin.patch(`/api/admin/utilisateurs/${moi}`).send({ role: 'COMPTABLE' })).body.erreur.code).toBe('SOI_MEME');
  });
});
