import type { UserRole } from '@prisma/client';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/utils/escape-html';
import { USER_ROLE_LABELS } from '@/lib/constants/user-labels';

/**
 * Email d'invitation utilisateur.
 *
 * Pourquoi un fichier separe de `email.service.ts` ?
 *   - Eviter qu'`email.service` accumule des concerns metier (reset
 *     password vs invitation vs futur alertes...) -> SRP (Clean Code #3).
 *   - Permet de mocker indpendamment dans les tests d'`acceptInvitation`.
 *
 * Pas de duplication : le pattern (singleton Resend lazy, formattage
 * date FR, Result<...>) est intentionnellement aligne avec
 * `email.service.ts` pour rester lisible. Une eventuelle extraction
 * du client Resend sera faite quand on aura 3+ services email.
 */

const MISSING_API_KEY_MESSAGE =
  'Email service requires RESEND_API_KEY env var.';
const DEFAULT_FROM = 'HACCP Maison Givre <noreply@maison-givre.fr>';

export type InvitationEmailResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

let cachedClient: Resend | null = null;

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

interface BuildEmailArgs {
  readonly inviteUrl: string;
  readonly expiryLabel: string;
  readonly role: UserRole;
  readonly inviterName: string | null;
}

/**
 * Construit le HTML de l'email d'invitation (charte Maison Givre).
 *
 * Toutes les variables d'origine controlable (inviterName, label de
 * role, inviteUrl) sont passees par `escapeHtml` defense en profondeur
 * (Clean Code #1, Security). Le test "should escape HTML in inviterName"
 * verifie que `<script>` devient `&lt;script&gt;`.
 *
 * Contraintes clients mail :
 *   - Tables HTML pour layout (Outlook).
 *   - Styles inline (pas de <style>, peu fiable).
 *   - Pas d'images / SVG decoratives.
 *   - Width max 560px pour mobile.
 */
function buildInvitationHtml({
  inviteUrl,
  expiryLabel,
  role,
  inviterName,
}: BuildEmailArgs): string {
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeExpiryLabel = escapeHtml(expiryLabel);
  const safeRoleLabel = escapeHtml(USER_ROLE_LABELS[role]);
  const safeInviterName = inviterName ? escapeHtml(inviterName) : 'Un membre';
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

              <h1 style="margin:48px 0 0;color:#0D0D0D;font-size:14px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;">Invitation a rejoindre l'equipe</h1>
              <div style="margin:24px auto;width:40px;height:1px;background-color:#C6A46C;line-height:1px;font-size:0;">&nbsp;</div>

              <p style="margin:0 0 16px;color:#0D0D0D;font-size:14px;line-height:1.7;font-weight:300;">
                ${safeInviterName} vous a invite a rejoindre l'equipe Maison Givre en tant que ${safeRoleLabel}.
              </p>
              <p style="margin:0 0 32px;color:#0D0D0D;font-size:14px;line-height:1.7;font-weight:300;">
                Pour activer votre compte et choisir votre mot de passe, cliquez sur le bouton ci-dessous. Ce lien est valable jusqu'au ${safeExpiryLabel}.
              </p>

              <a href="${safeInviteUrl}" style="display:inline-block;background-color:#0D0D0D;color:#F7F4EF;padding:14px 32px;text-decoration:none;font-size:11px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;border:1px solid #0D0D0D;">
                Activer mon compte
              </a>

              <p style="margin:48px 0 0;color:#0D0D0D;opacity:0.5;font-size:11px;line-height:1.6;font-weight:300;font-style:italic;">
                Si vous ne reconnaissez pas cette invitation, ignorez cet email.
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

function buildInvitationText({
  inviteUrl,
  expiryLabel,
  role,
  inviterName,
}: BuildEmailArgs): string {
  const inviterLabel = inviterName ?? 'Un membre';
  return [
    'MAISON GIVRE',
    'GLACIER ARTISAN',
    '· DEPUIS 1933 ·',
    '',
    "INVITATION A REJOINDRE L'EQUIPE",
    '─────',
    '',
    `${inviterLabel} vous a invite a rejoindre l'equipe Maison Givre en tant que ${USER_ROLE_LABELS[role]}.`,
    '',
    `Pour activer votre compte et choisir votre mot de passe, ouvrez le lien suivant (valable jusqu'au ${expiryLabel}) :`,
    '',
    inviteUrl,
    '',
    'Si vous ne reconnaissez pas cette invitation, ignorez cet email.',
    '',
    '—',
    'Maison Givre · Glacier Artisan',
  ].join('\n');
}

interface SendInvitationEmailArgs {
  readonly to: string;
  readonly inviteUrl: string;
  readonly expiresAt: Date;
  readonly role: UserRole;
  readonly inviterName?: string | null;
}

/**
 * Envoie l'email d'invitation. Best-effort : on retourne un Result
 * que le caller decide d'ignorer (logger + repondre success) ou de
 * surfacer. Ne logger NI le token NI l'URL (contient le token).
 */
export async function sendUserInvitationEmail({
  to,
  inviteUrl,
  expiresAt,
  role,
  inviterName = null,
}: SendInvitationEmailArgs): Promise<InvitationEmailResult> {
  try {
    const expiryLabel = formatExpiryParis(expiresAt);
    const args: BuildEmailArgs = {
      inviteUrl,
      expiryLabel,
      role,
      inviterName,
    };
    const { error } = await getResendClient().emails.send({
      from: getFromAddress(),
      to,
      subject: "Maison Givre - Invitation a rejoindre l'equipe",
      html: buildInvitationHtml(args),
      text: buildInvitationText(args),
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
