/**
 * Tests d'intégration de l'API sur une base PostgreSQL de test (DATABASE_URL_TEST).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://compta:compta@localhost:5433/compta_test?schema=public';
process.env.JWT_SECRET = 'secret-de-test-suffisamment-long-pour-jwt-0123456789';

import request from 'supertest';
import { creerApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { synchroniserBaremes } from '../src/modules/baremes/baremes.service';

const app = creerApp();
const admin = request.agent(app);
const comptable = request.agent(app);

beforeAll(async () => {
  await prisma.journalAudit.deleteMany();
  await prisma.calcul.deleteMany();
  await prisma.versionBareme.deleteMany();
  await prisma.utilisateur.deleteMany();
  await synchroniserBaremes();
});
afterAll(() => prisma.$disconnect());

describe('Authentification', () => {
  test('les routes de calcul exigent une session', async () => {
    const r = await request(app).get('/api/calc/catalogue');
    expect(r.status).toBe(401);
  });
  test('le premier compte est administrateur', async () => {
    const r = await admin.post('/api/auth/inscription').send({ email: 'Admin@Cabinet.fr', nom: 'Admin', motDePasse: 'motdepasse-solide' });
    expect(r.status).toBe(201);
    expect(r.body.utilisateur).toMatchObject({ email: 'admin@cabinet.fr', role: 'ADMIN' });
    expect(r.headers['set-cookie'][0]).toMatch(/compta_session=.*HttpOnly/);
  });
  test('les comptes suivants sont comptables', async () => {
    const r = await comptable.post('/api/auth/inscription').send({ email: 'compta@cabinet.fr', nom: 'Camille', motDePasse: 'autre-motdepasse' });
    expect(r.body.utilisateur.role).toBe('COMPTABLE');
  });
  test('validation des données et identifiants incorrects', async () => {
    expect((await request(app).post('/api/auth/inscription').send({ email: 'x', nom: 'A', motDePasse: 'court' })).status).toBe(422);
    expect((await request(app).post('/api/auth/connexion').send({ email: 'admin@cabinet.fr', motDePasse: 'mauvais' })).status).toBe(401);
    expect((await request(app).post('/api/auth/inscription').send({ email: 'admin@cabinet.fr', nom: 'Bis', motDePasse: 'motdepasse-solide' })).status).toBe(409);
  });
  test('connexion et session', async () => {
    const a = request.agent(app);
    expect((await a.post('/api/auth/connexion').send({ email: 'compta@cabinet.fr', motDePasse: 'autre-motdepasse' })).status).toBe(200);
    expect((await a.get('/api/auth/moi')).body.utilisateur.nom).toBe('Camille');
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
