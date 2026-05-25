'use server';

import { headers } from 'next/headers';
import { after } from 'next/server';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth';
import { checkRateLimit } from '@/lib/services/rateLimit';
import {
  generatePasswordResetToken,
  resetPassword,
} from '@/lib/services/auth.service';
import { sendPasswordResetEmail } from '@/lib/services/email.service';
import { getClientIp } from '@/lib/utils/request';

const DEFAULT_APP_BASE_URL = 'http://localhost:3000';
const RESET_SUCCESS_REDIRECT = '/login?reset=success';
const MILLISECONDS_PER_SECOND = 1000;

function toRetryAfterSeconds(retryAfterMs: number | undefined): number {
  if (!retryAfterMs) {
    return 0;
  }
  return Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND);
}

/**
 * Cles d'erreur cote UI. Le composant client mappe vers le message
 * i18n pour eviter toute fuite d'info dans la reponse server.
 */
export type ForgotPasswordErrorCode = 'VALIDATION' | 'RATE_LIMITED';

export type ForgotPasswordActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: ForgotPasswordErrorCode;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_FORGOT_PASSWORD_STATE: ForgotPasswordActionState = {
  status: 'idle',
};

export type ResetPasswordErrorCode =
  | 'VALIDATION'
  | 'INVALID_OR_EXPIRED'
  | 'INTERNAL';

export type ResetPasswordActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: ResetPasswordErrorCode;
    };

export const INITIAL_RESET_PASSWORD_STATE: ResetPasswordActionState = {
  status: 'idle',
};

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? DEFAULT_APP_BASE_URL;
}

function buildResetUrl(plainToken: string): string {
  return `${getAppBaseUrl()}/reset-password/${plainToken}`;
}

interface DispatchEmailArgs {
  readonly email: string;
  readonly resetUrl: string;
  readonly expiresAt: Date;
}

/**
 * Dispatch l'email de reinitialisation en post-response (`after`) :
 * la Server Action retourne immediatement et l'envoi Resend (500ms-2s)
 * ne bloque pas la reponse. Erreurs Resend journalisees sans details
 * sensibles (pas de resetUrl/token), pour ne pas leak l'existence du
 * compte (anti-enum) tout en gardant la tracabilite ops.
 */
function dispatchPasswordResetEmail({
  email,
  resetUrl,
  expiresAt,
}: DispatchEmailArgs): void {
  after(async () => {
    const result = await sendPasswordResetEmail({ email, resetUrl, expiresAt });
    if (!result.success) {
      console.error('[forgot-password] email send failed', {
        email,
        error: result.error,
      });
    }
  });
}

/**
 * Server Action de demande de reinitialisation.
 *
 * Pipeline :
 *   1. rate-limit (Upstash Redis) par IP
 *   2. validation Zod (email)
 *   3. generatePasswordResetToken (anti-enum : silencieux si user inconnu)
 *   4. envoi email post-response via `after()` (non-bloquant)
 *
 * Retourne TOUJOURS `success` apres une validation reussie, meme si
 * l'utilisateur n'existe pas, pour eviter l'enumeration de comptes.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const rateLimit = await checkRateLimit('PASSWORD_RESET', ip);
  if (!rateLimit.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rateLimit.retryAfterMs),
    };
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { status: 'error', code: 'VALIDATION' };
  }

  const tokenResult = await generatePasswordResetToken(parsed.data.email);

  if (
    tokenResult.success &&
    tokenResult.data.plainToken &&
    tokenResult.data.expiresAt
  ) {
    dispatchPasswordResetEmail({
      email: parsed.data.email,
      resetUrl: buildResetUrl(tokenResult.data.plainToken),
      expiresAt: tokenResult.data.expiresAt,
    });
  }

  return { status: 'success' };
}

/**
 * Server Action de reinitialisation effective du mot de passe.
 *
 * Pipeline :
 *   1. validation Zod (token + password fort + confirm match)
 *   2. resetPassword (consomme atomiquement le token + update password)
 *
 * Toutes les erreurs de token sont mappees sur INVALID_OR_EXPIRED
 * (generique) pour ne pas exposer le detail de la cause.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    const firstIssuePath = parsed.error.issues[0]?.path[0];
    const code: ResetPasswordErrorCode =
      firstIssuePath === 'token' ? 'INVALID_OR_EXPIRED' : 'VALIDATION';
    return { status: 'error', code };
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);

  if (!result.success) {
    if (result.error === 'INTERNAL_ERROR') {
      return { status: 'error', code: 'INTERNAL' };
    }
    return { status: 'error', code: 'INVALID_OR_EXPIRED' };
  }

  return { status: 'success', redirectTo: RESET_SUCCESS_REDIRECT };
}
