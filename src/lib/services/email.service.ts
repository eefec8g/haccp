import { Resend } from 'resend';
import { escapeHtml } from '@/lib/utils/escape-html';

const MISSING_API_KEY_MESSAGE =
  'Email service requires RESEND_API_KEY env var.';
const DEFAULT_FROM = 'HACCP Maison Givre <noreply@maison-givre.fr>';

export type EmailResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

let cachedClient: Resend | null = null;

/**
 * Singleton Resend client (lazy init). Throw clair si la cle manque
 * pour ne pas faire planter `next build` sans config email.
 */
function getResendClient(): Resend {
  if (cachedClient) {
    return cachedClient;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(MISSING_API_KEY_MESSAGE);
  }
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
}

function formatExpiryParis(expiresAt: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(expiresAt);
}

/**
 * Template HTML email charte Maison Givre.
 *
 * Contraintes clients mail :
 *   - Tables HTML pour layout (Outlook).
 *   - Styles inline (pas de <style>, peu fiable).
 *   - Pas d'images / SVG decoratives.
 *   - Width max 560px pour mobile.
 *
 * Palette : ivoire #F7F4EF, noir profond #0D0D0D, or mat #C6A46C.
 *
 * `resetUrl` est echappe via `escapeHtml` (defense en profondeur).
 * `expiryLabel` provient d'`Intl.DateTimeFormat` (pas de caracteres
 * HTML possibles) mais on l'echappe aussi pour rester coherent.
 */
function buildResetEmailHtml(resetUrl: string, expiryLabel: string): string {
  const safeResetUrl = escapeHtml(resetUrl);
  const safeExpiryLabel = escapeHtml(expiryLabel);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maison Givre</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F4EF;font-family:Montserrat, 'Segoe UI', system-ui, sans-serif;color:#0D0D0D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F7F4EF;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#FFFFFF;">
          <tr>
            <td style="padding:40px 32px;text-align:center;">
              <p style="margin:0;color:#0D0D0D;font-size:22px;font-weight:300;letter-spacing:0.3em;">MAISON GIVRE</p>
              <div style="margin:16px auto;width:60px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>
              <p style="margin:0;color:#C6A46C;font-size:10px;font-weight:400;letter-spacing:0.3em;">GLACIER ARTISAN</p>
              <p style="margin:8px 0 0;color:#0D0D0D;opacity:0.6;font-size:9px;letter-spacing:0.3em;">&middot; DEPUIS 1933 &middot;</p>

              <h1 style="margin:48px 0 0;color:#0D0D0D;font-size:14px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;">Reinitialisation du mot de passe</h1>
              <div style="margin:24px auto;width:40px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>

              <p style="margin:0 0 16px;color:#0D0D0D;font-size:14px;line-height:1.7;font-weight:300;">
                Vous avez demande la reinitialisation du mot de passe associe a votre compte Maison Givre.
              </p>
              <p style="margin:0 0 32px;color:#0D0D0D;font-size:14px;line-height:1.7;font-weight:300;">
                Pour definir un nouveau mot de passe, cliquez sur le bouton ci-dessous. Ce lien est valable jusqu'au ${safeExpiryLabel}.
              </p>

              <a href="${safeResetUrl}" style="display:inline-block;background-color:#0D0D0D;color:#F7F4EF;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;border:1px solid #0D0D0D;">
                Reinitialiser mon mot de passe
              </a>

              <p style="margin:48px 0 0;color:#0D0D0D;opacity:0.5;font-size:11px;line-height:1.6;font-weight:300;font-style:italic;">
                Si vous n'etes pas a l'origine de cette demande, ignorez cet email.
                Aucun changement ne sera effectue sur votre compte.
              </p>

              <div style="margin:48px auto 0;width:40px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>
              <p style="margin:24px 0 0;color:#0D0D0D;opacity:0.5;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">
                Maison Givre &middot; Glacier Artisan
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText(resetUrl: string, expiryLabel: string): string {
  return [
    'MAISON GIVRE',
    'GLACIER ARTISAN',
    '· DEPUIS 1933 ·',
    '',
    'REINITIALISATION DU MOT DE PASSE',
    '─────',
    '',
    'Vous avez demande la reinitialisation du mot de passe associe a votre compte Maison Givre.',
    '',
    `Pour definir un nouveau mot de passe, ouvrez le lien suivant (valable jusqu'au ${expiryLabel}) :`,
    '',
    resetUrl,
    '',
    "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
    '',
    '—',
    'Maison Givre · Glacier Artisan',
  ].join('\n');
}

interface SendResetEmailArgs {
  readonly email: string;
  readonly resetUrl: string;
  readonly expiresAt: Date;
}

/**
 * Envoie l'email de reinitialisation. Ne JAMAIS logger `resetUrl`
 * ni le token. En cas d'erreur Resend, retourne un Result error
 * et laisse le caller decider (en general : log + repondre success
 * silencieusement pour ne pas leak l'existence du compte).
 */
export async function sendPasswordResetEmail({
  email,
  resetUrl,
  expiresAt,
}: SendResetEmailArgs): Promise<EmailResult> {
  try {
    const expiryLabel = formatExpiryParis(expiresAt);
    const { error } = await getResendClient().emails.send({
      from: getFromAddress(),
      to: email,
      subject: 'Maison Givre - Reinitialisation de votre mot de passe',
      html: buildResetEmailHtml(resetUrl, expiryLabel),
      text: buildResetEmailText(resetUrl, expiryLabel),
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}
