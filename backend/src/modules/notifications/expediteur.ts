/**
 * Envoi des messages : e-mail par SMTP, SMS et WhatsApp par l'API REST de Twilio.
 * Un canal sans fournisseur configuré est « indisponible » ; en mode démonstration (CODES_VISIBLES),
 * le code est alors seulement renvoyé à l'écran et écrit dans le journal du serveur.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export type Canal = 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface Message {
  canal: Canal;
  destination: string;
  sujet: string;
  texte: string;
  html?: string;
}

const twilioConfigure = () => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);

/** Canaux réellement reliés à un fournisseur. */
export function canauxConfigures(): Record<Canal, boolean> {
  return {
    EMAIL: !!env.SMTP_HOST,
    SMS: twilioConfigure() && !!env.TWILIO_SMS_FROM,
    WHATSAPP: twilioConfigure() && !!env.TWILIO_WHATSAPP_FROM,
  };
}

/** Canaux proposés à l'utilisateur : configurés, ou tous en mode démonstration. */
export function canauxDisponibles(): Record<Canal, boolean> {
  const c = canauxConfigures();
  return env.CODES_VISIBLES ? { EMAIL: true, SMS: true, WHATSAPP: true } : c;
}

let transport: Transporter | null = null;
function smtp(): Transporter {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transport;
}

async function twilio(de: string, a: string, texte: string): Promise<void> {
  const corps = new URLSearchParams({ From: de, To: a, Body: texte });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corps,
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`Twilio ${r.status} : ${detail.slice(0, 300)}`);
  }
}

/**
 * Envoie le message. Renvoie `false` si le canal n'a pas de fournisseur (cas du mode démonstration),
 * lève une erreur si le fournisseur refuse l'envoi.
 */
export async function envoyer(m: Message): Promise<boolean> {
  if (!canauxConfigures()[m.canal]) {
    logger.info({ canal: m.canal, destination: m.destination }, `[démonstration] message non envoyé : ${m.texte}`);
    return false;
  }
  if (m.canal === 'EMAIL') {
    await smtp().sendMail({ from: env.EMAIL_EXPEDITEUR, to: m.destination, subject: m.sujet, text: m.texte, html: m.html });
  } else if (m.canal === 'SMS') {
    await twilio(env.TWILIO_SMS_FROM!, m.destination, m.texte);
  } else {
    await twilio(`whatsapp:${env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, '')}`, `whatsapp:${m.destination}`, m.texte);
  }
  logger.info({ canal: m.canal }, 'Message envoyé');
  return true;
}
