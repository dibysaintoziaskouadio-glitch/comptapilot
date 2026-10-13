import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL requis'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit contenir au moins 32 caractères'),
  JWT_TTL_HEURES: z.coerce.number().int().positive().default(12),
  CORS_ORIGINS: z.string().default('http://localhost:5174'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  ALLOW_REGISTRATION: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** URL publique de l'interface, citée dans les e-mails. */
  PUBLIC_URL: z.string().default('http://localhost:5174'),

  // Codes de vérification : sans fournisseur configuré, le mode démonstration renvoie le code à l'écran.
  CODES_VISIBLES: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // E-mail (SMTP : Gmail, Brevo, OVH, Mailjet…)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_EXPEDITEUR: z.string().default('Comptapilot <no-reply@comptapilot.local>'),

  // SMS et WhatsApp (Twilio)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_SMS_FROM: z.string().optional(), // numéro ou identifiant d'expéditeur, ex. +15005550006 ou COMPTAPILOT
  TWILIO_WHATSAPP_FROM: z.string().optional(), // ex. +14155238886 (bac à sable Twilio)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const estProduction = env.NODE_ENV === 'production';
