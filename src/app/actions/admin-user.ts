'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import type { Session } from 'next-auth';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import {
  userInviteSchema,
  acceptInvitationSchema,
  updateUserAssignmentSchema,
} from '@/lib/validations/admin';
import {
  acceptInvitation,
  disableUser,
  enableUser,
  inviteUser,
  updateUserAssignment,
  type InviteUserError,
  type UpdateUserError,
} from '@/lib/services/user.service';
import { sendUserInvitationEmail } from '@/lib/services/email-invitation.service';
import { ENTITY_DISABLE_MOTIF_MAX } from '@/lib/constants/admin';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { getClientIp } from '@/lib/utils/request';
import { assertAdminOrRedirect } from '@/lib/utils/admin-auth';
import { readRequiredString, readOptionalString } from '@/lib/utils/form-data';
import { logger } from '@/lib/logger';
import type {
  AcceptInvitationActionState,
  UpdateUserAssignmentActionState,
  UserActionErrorCode,
  UserInviteActionState,
} from './admin-user.types';

/**
 * Server Actions admin Utilisateurs (US-ADM-003).
 *
 * Pipeline commun (mirror de admin-boutique.ts / admin-equipement.ts) :
 *   1. auth() + role ADMIN (defense en profondeur). Sauf
 *      `acceptInvitationAction` qui est public (l'invite n'est pas
 *      encore connecte).
 *   2. Rate-limit Upstash :
 *      - USER_INVITE       : 10 / 1h par admin (session.user.id)
 *      - INVITATION_ACCEPT : 5 / 15 min par IP (anti-bruteforce token)
 *   3. Parse FormData via Zod (userInviteSchema / acceptInvitationSchema).
 *   4. Delegation au service `user.service` (Result pattern).
 *   5. revalidatePath('/admin/users') apres toute mutation.
 *   6. redirect() pour acceptation -> /login?welcome=true.
 *
 * L'email d'invitation est dispatch via `after()` pour ne pas bloquer
 * la reponse (envoi Resend 500ms-2s).
 */

const ADMIN_USERS_PATH = '/admin/users';
const ACCEPT_SUCCESS_REDIRECT = '/login?welcome=true';
const DEFAULT_APP_BASE_URL = 'http://localhost:3000';

interface AdminGuardOk {
  readonly ok: true;
  readonly session: Session;
}
interface AdminGuardKo {
  readonly ok: false;
  readonly state: UserInviteActionState;
}
type AdminGuardResult = AdminGuardOk | AdminGuardKo;

async function ensureAdmin(): Promise<AdminGuardResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return {
      ok: false,
      state: { status: 'error', code: 'FORBIDDEN' },
    };
  }
  return { ok: true, session };
}

function mapInviteServiceError(error: InviteUserError): UserActionErrorCode {
  if (error === 'EMAIL_ALREADY_EXISTS') {
    return 'EMAIL_ALREADY_EXISTS';
  }
  return 'BOUTIQUE_NOT_FOUND';
}

function readBoutiquesResponsable(formData: FormData): readonly string[] {
  const all = formData.getAll('boutiquesResponsable');
  return all.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? DEFAULT_APP_BASE_URL;
}

function buildInviteUrl(plainToken: string): string {
  return `${getAppBaseUrl()}/accept-invitation/${plainToken}`;
}

interface DispatchInviteEmailArgs {
  readonly to: string;
  readonly inviteUrl: string;
  readonly expiresAt: Date;
  readonly role: UserRole;
  readonly inviterName: string | null;
}

/**
 * Dispatch l'email d'invitation en post-response (`after`) : la Server
 * Action retourne immediatement, l'envoi Resend ne bloque pas la reponse.
 * Erreurs Resend journalisees sans details sensibles (PAS l'inviteUrl
 * qui contient le token en clair).
 */
function dispatchInvitationEmail({
  to,
  inviteUrl,
  expiresAt,
  role,
  inviterName,
}: DispatchInviteEmailArgs): void {
  after(async () => {
    const result = await sendUserInvitationEmail({
      to,
      inviteUrl,
      expiresAt,
      role,
      inviterName,
    });
    if (!result.success) {
      logger.error('[invite-user] email send failed', {
        to,
        role,
        error: result.error,
      });
    }
  });
}

/**
 * Cree une invitation utilisateur puis redirige vers la liste. Envoi
 * email post-response. Le token plain ne quitte le serveur qu'a travers
 * l'URL email (pas de leak via Result en clair vers le client).
 */
export async function inviteUserAction(
  _prev: UserInviteActionState,
  formData: FormData
): Promise<UserInviteActionState> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return guard.state;
  }

  const rate = await checkRateLimit('USER_INVITE', guard.session.user.id);
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const parsed = userInviteSchema.safeParse({
    email: readRequiredString(formData, 'email'),
    name: readRequiredString(formData, 'name'),
    role: readRequiredString(formData, 'role'),
    boutiqueSalarieId: readOptionalString(formData, 'boutiqueSalarieId'),
    boutiquesResponsable: readBoutiquesResponsable(formData),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await inviteUser(parsed.data, guard.session.user.id);
  if (!result.success) {
    return { status: 'error', code: mapInviteServiceError(result.error) };
  }

  dispatchInvitationEmail({
    to: parsed.data.email,
    inviteUrl: buildInviteUrl(result.data.plainToken),
    expiresAt: result.data.expiresAt,
    role: parsed.data.role,
    inviterName: guard.session.user.name ?? null,
  });

  revalidatePath(ADMIN_USERS_PATH);
  redirect(ADMIN_USERS_PATH);
}

/**
 * Acceptation d'invitation (public, l'utilisateur n'est PAS encore
 * authentifie). Rate-limit par IP pour anti-bruteforce, validation
 * stricte du mot de passe (regle complexite + confirm match), et
 * delegation au service qui consomme atomiquement le token.
 */
export async function acceptInvitationAction(
  _prev: AcceptInvitationActionState,
  formData: FormData
): Promise<AcceptInvitationActionState> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const rate = await checkRateLimit('INVITATION_ACCEPT', ip);
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const parsed = acceptInvitationSchema.safeParse({
    token: readRequiredString(formData, 'token'),
    password: readRequiredString(formData, 'password'),
    confirmPassword: readRequiredString(formData, 'confirmPassword'),
  });
  if (!parsed.success) {
    const firstIssuePath = parsed.error.issues[0]?.path[0];
    if (firstIssuePath === 'token') {
      return { status: 'error', code: 'INVALID' };
    }
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await acceptInvitation(
    parsed.data.token,
    parsed.data.password
  );
  if (!result.success) {
    return { status: 'error', code: 'INVALID' };
  }

  return { status: 'success', redirectTo: ACCEPT_SUCCESS_REDIRECT };
}

/**
 * Normalise un motif optionnel : trim + tronque a la borne metier.
 */
function sanitizeMotif(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, ENTITY_DISABLE_MOTIF_MAX);
}

/**
 * Desactivation utilisateur (toggle actif=false). Le service refuse
 * de desactiver le dernier admin actif (LAST_ADMIN) : on remonte une
 * erreur explicite cote client via le message du throw.
 *
 * `motif` est optionnel (mais recommande HACCP) : il est journalise
 * dans AuditLog par le service.
 */
export async function disableUserAction(
  id: string,
  motif?: string
): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await disableUser({
    id,
    performedById: userId,
    motif: sanitizeMotif(motif),
  });
  if (!result.success) {
    if (result.error === 'LAST_ADMIN') {
      throw new Error(
        'Impossible de desactiver le dernier administrateur actif'
      );
    }
    throw new Error('Utilisateur introuvable');
  }

  revalidatePath(ADMIN_USERS_PATH);
  revalidatePath(`${ADMIN_USERS_PATH}/${id}`);
}

export async function enableUserAction(id: string): Promise<void> {
  const { userId } = await assertAdminOrRedirect();

  const result = await enableUser({
    id,
    performedById: userId,
  });
  if (!result.success) {
    throw new Error('Utilisateur introuvable');
  }

  revalidatePath(ADMIN_USERS_PATH);
  revalidatePath(`${ADMIN_USERS_PATH}/${id}`);
}

/**
 * Mappe les erreurs metier de `updateUserAssignment` vers les codes UI.
 * Le service ne distingue pas boutique introuvable/desactivee : les deux
 * remontent en BOUTIQUE_NOT_FOUND cote client (message unifie).
 */
function mapUpdateAssignmentError(error: UpdateUserError): UserActionErrorCode {
  if (error === 'USER_NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (error === 'BOUTIQUE_INVALID') {
    return 'BOUTIQUE_NOT_FOUND';
  }
  if (error === 'LAST_ADMIN') {
    return 'LAST_ADMIN';
  }
  if (error === 'INVALID_ASSIGNMENT') {
    return 'INVALID_ASSIGNMENT';
  }
  return 'INTERNAL';
}

/**
 * Edition du role + rattachements d'un user existant (US-ADM-006).
 *
 * Pipeline : guard ADMIN -> parse FormData (Zod, coherence
 * role/rattachement) -> service updateUserAssignment (Result) ->
 * revalidatePath liste + detail. Reste sur la page (pas de redirect) :
 * la confirmation est affichee en place via l'etat `success`.
 */
export async function updateUserAssignmentAction(
  _prev: UpdateUserAssignmentActionState,
  formData: FormData
): Promise<UpdateUserAssignmentActionState> {
  const guard = await ensureAdmin();
  if (!guard.ok) {
    return { status: 'error', code: 'FORBIDDEN' };
  }

  const parsed = updateUserAssignmentSchema.safeParse({
    userId: readRequiredString(formData, 'userId'),
    role: readRequiredString(formData, 'role'),
    boutiqueSalarieId: readOptionalString(formData, 'boutiqueSalarieId'),
    boutiquesResponsable: readBoutiquesResponsable(formData),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await updateUserAssignment({
    ...parsed.data,
    performedById: guard.session.user.id,
  });
  if (!result.success) {
    return { status: 'error', code: mapUpdateAssignmentError(result.error) };
  }

  revalidatePath(ADMIN_USERS_PATH);
  revalidatePath(`${ADMIN_USERS_PATH}/${parsed.data.userId}`);
  return { status: 'success' };
}
