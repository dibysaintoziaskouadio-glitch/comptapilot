/** Textes des messages contenant un code, en français et en anglais. */
import { env } from '../../config/env';

export type ObjetMessage = 'VERIFICATION_EMAIL' | 'VERIFICATION_TELEPHONE' | 'REINITIALISATION';
type Langue = 'fr' | 'en';

const TEXTES = {
  fr: {
    VERIFICATION_EMAIL: { sujet: 'Votre code de confirmation Comptapilot', titre: 'Confirmez votre adresse e-mail', intro: 'Voici votre code de confirmation :' },
    VERIFICATION_TELEPHONE: { sujet: 'Code Comptapilot', titre: 'Confirmez votre numéro', intro: 'Votre code de confirmation Comptapilot :' },
    REINITIALISATION: { sujet: 'Réinitialisation de votre mot de passe Comptapilot', titre: 'Mot de passe oublié', intro: 'Voici le code pour choisir un nouveau mot de passe :' },
    validite: 'Il est valable {min} minutes. Ne le communiquez à personne.',
    ignorer: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
  },
  en: {
    VERIFICATION_EMAIL: { sujet: 'Your Comptapilot confirmation code', titre: 'Confirm your email address', intro: 'Here is your confirmation code:' },
    VERIFICATION_TELEPHONE: { sujet: 'Comptapilot code', titre: 'Confirm your number', intro: 'Your Comptapilot confirmation code:' },
    REINITIALISATION: { sujet: 'Reset your Comptapilot password', titre: 'Forgotten password', intro: 'Here is the code to choose a new password:' },
    validite: 'It is valid for {min} minutes. Do not share it with anyone.',
    ignorer: 'If you did not make this request, please ignore this message.',
  },
} as const;

export function messageCode(objet: ObjetMessage, code: string, langue: Langue, minutes: number) {
  const t = TEXTES[langue] ?? TEXTES.fr;
  const o = t[objet];
  const validite = t.validite.replace('{min}', String(minutes));
  const texte = `${o.intro} ${code}\n${validite}\n${t.ignorer}`;
  // Message court pour SMS et WhatsApp (une seule ligne utile, code en tête pour les aperçus de notification).
  const court = `${code} — ${o.intro.replace(/ :$|:$/, '')} (Comptapilot). ${validite}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif;color:#1a1540">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:linear-gradient(120deg,#5b3cf5,#c026d3);padding:22px 28px;color:#fff;font-size:18px;font-weight:bold">Comptapilot</td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 6px;font-size:20px;font-weight:bold">${o.titre}</p>
        <p style="margin:0 0 18px;color:#5b5675">${o.intro}</p>
        <p style="margin:0 0 18px;font-size:34px;letter-spacing:10px;font-weight:bold;color:#7c3aed">${code}</p>
        <p style="margin:0 0 6px;color:#5b5675;font-size:13px">${validite}</p>
        <p style="margin:0;color:#8a86a0;font-size:12px">${t.ignorer}</p>
      </td></tr>
      <tr><td style="padding:14px 28px;background:#f8f7fc;color:#8a86a0;font-size:11px">Vision Technologie · <a href="${env.PUBLIC_URL}" style="color:#7c3aed">${env.PUBLIC_URL.replace(/^https?:\/\//, '')}</a></td></tr>
    </table>
  </td></tr></table></body></html>`;
  return { sujet: o.sujet, texte, court, html };
}
