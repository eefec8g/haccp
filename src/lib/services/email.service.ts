import { Resend } from 'resend';

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
 * HTML email template. Pas de logger du `resetUrl` (contient le token).
 */
function buildResetEmailHtml(resetUrl: string, expiryLabel: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #0f172a; font-size: 20px;">Reinitialisation de votre mot de passe</h1>
      <p>Bonjour,</p>
      <p>
        Vous avez demande la reinitialisation de votre mot de passe pour
        HACCP Maison Givre. Cliquez sur le lien ci-dessous pour le definir :
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}"
           style="background:#2563eb;color:#fff;padding:12px 20px;
                  border-radius:6px;text-decoration:none;display:inline-block;">
          Reinitialiser mon mot de passe
        </a>
      </p>
      <p style="color:#475569;font-size:14px;">
        Ce lien expire le <strong>${expiryLabel}</strong>.
      </p>
      <p style="color:#475569;font-size:14px;">
        Si vous n'etes pas a l'origine de cette demande, ignorez cet email :
        votre mot de passe actuel reste inchange.
      </p>
    </div>
  `;
}

function buildResetEmailText(resetUrl: string, expiryLabel: string): string {
  return [
    'Reinitialisation de votre mot de passe HACCP Maison Givre',
    '',
    'Cliquez sur le lien ci-dessous pour definir un nouveau mot de passe :',
    resetUrl,
    '',
    `Ce lien expire le ${expiryLabel}.`,
    '',
    "Si vous n'etes pas a l'origine de cette demande, ignorez cet email.",
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
      subject: 'Reinitialisation de votre mot de passe - HACCP Maison Givre',
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
