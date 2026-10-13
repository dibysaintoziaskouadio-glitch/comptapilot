/**
 * Envoie un e-mail de test avec la configuration SMTP de backend/.env (ou des variables d'environnement).
 * Usage : npm run test-email -w backend -- destinataire@exemple.com
 */
import { env } from '../src/config/env';
import { canauxConfigures, envoyer } from '../src/modules/notifications/expediteur';
import { messageCode } from '../src/modules/notifications/messages';

async function principal() {
  const a = process.argv[2];
  if (!a) throw new Error('Indiquez le destinataire : npm run test-email -w backend -- vous@exemple.com');
  if (!canauxConfigures().EMAIL) throw new Error('SMTP non configuré : renseignez SMTP_HOST, SMTP_USER, SMTP_PASS et EMAIL_EXPEDITEUR.');
  const m = messageCode('VERIFICATION_EMAIL', '123456', 'fr', 10);
  await envoyer({ canal: 'EMAIL', destination: a, sujet: `[Test] ${m.sujet}`, texte: m.texte, html: m.html });
  console.log(`E-mail de test envoyé à ${a} via ${env.SMTP_HOST} (expéditeur : ${env.EMAIL_EXPEDITEUR}).`);
}

principal()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Échec :', e.message);
    process.exit(1);
  });
