'use server';

import { headers } from 'next/headers';
import type { UserRole } from '@prisma/client';
import { auth, signIn } from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';
import { getClientIp } from '@/lib/utils/request';
import { isNextRedirectError } from '@/lib/utils/next-errors';

/**
 * Cles d'erreur cote UI. Le mapping vers le message i18n est fait
 * par le composant client pour eviter toute fuite d'info dans la
 * reponse server (anti-enum) et garder la SRP.
 */
export type LoginErrorCode = 'INVALID' | 'RATE_LIMITED' | 'INTERNAL';

export type LoginActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: LoginErrorCode;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_LOGIN_STATE: LoginActionState = { status: 'idle' };

/**
 * Server Action de connexion.
 *
 * Pipeline :
 *   1. rate-limit (Upstash Redis) par IP
 *   2. validation Zod
 *   3. signIn Credentials (redirect:false)
 *   4. resolution redirectTo par role
 *
 * Toutes les erreurs sont retournees sous forme generique pour
 * eviter l'enumeration utilisateur (EX-AUTH-001, EX-AUTH-004).
 */
export async function loginAction(
  _prev: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  const rateLimit = await checkRateLimit('LOGIN', ip);
  if (!rateLimit.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rateLimit.retryAfterMs),
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', code: 'INVALID' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    // Si NextAuth signale un redirect interne, le laisser remonter
    // pour que Next.js l'execute (sinon la redirection est avalee).
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { status: 'error', code: 'INVALID' };
  }

  // Defensive : on relit la session pour s'assurer que signIn a bien
  // pose un JWT exploitable. Si role absent -> on refuse, pour ne pas
  // signaler un success a une session corrompue.
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role) {
    return { status: 'error', code: 'INVALID' };
  }

  return { status: 'success', redirectTo: POST_LOGIN_REDIRECT[role] };
}
