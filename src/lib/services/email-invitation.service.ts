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
 * Construit le HTML de l'email d'invitation.
 *
 * Toutes les variables d'origine controlable (inviterName, label de
 * role) sont passees par `escapeHtml` defense en profondeur (Clean
 * Code #1, Security). On NE escape PAS `inviteUrl` ni `expiryLabel` :
 *   - `inviteUrl` est compose serveur-side a partir d'un token base64url
 *     genere par crypto.randomBytes (pas de caracteres HTML).
 *   - `expiryLabel` est produit par `Intl.DateTimeFormat` (pas de
 *     caracteres HTML possibles).
 */
function buildInvitationHtml({
  inviteUrl,
  expiryLabel,
  role,
  inviterName,
}: BuildEmailArgs): string {
  const safeInviterName = inviterName ? escapeHtml(inviterName) : '';
  const inviterLabel = safeInviterName
    ? ` par <strong>${safeInviterName}</strong>`
    : '';
  const safeRoleLabel = escapeHtml(USER_ROLE_LABELS[role]);
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #2A3547; font-size: 20px;">Invitation a rejoindre HACCP Maison Givre</h1>
      <p>Bonjour,</p>
      <p>
        Vous avez ete invite${inviterLabel} a rejoindre l'application
        HACCP de Maison Givre avec le role <strong>${safeRoleLabel}</strong>.
      </p>
      <p>
        Pour activer votre compte et choisir votre mot de passe, cliquez
        sur le lien ci-dessous :
      </p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}"
           style="background:#5D87FF;color:#fff;padding:12px 20px;
                  border-radius:7px;text-decoration:none;display:inline-block;">
          Activer mon compte
        </a>
      </p>
      <p style="color:#475569;font-size:14px;">
        Ce lien expire le <strong>${expiryLabel}</strong>.
      </p>
      <p style="color:#475569;font-size:14px;">
        Si vous n'attendiez pas cette invitation, ignorez simplement cet
        email.
      </p>
    </div>
  `;
}

function buildInvitationText({
  inviteUrl,
  expiryLabel,
  role,
  inviterName,
}: BuildEmailArgs): string {
  const inviterLabel = inviterName ? ` par ${inviterName}` : '';
  return [
    'Invitation a rejoindre HACCP Maison Givre',
    '',
    `Vous avez ete invite${inviterLabel} avec le role ${USER_ROLE_LABELS[role]}.`,
    'Cliquez sur le lien ci-dessous pour activer votre compte :',
    inviteUrl,
    '',
    `Ce lien expire le ${expiryLabel}.`,
    '',
    "Si vous n'attendiez pas cette invitation, ignorez cet email.",
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
      subject: 'Invitation a rejoindre HACCP Maison Givre',
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
