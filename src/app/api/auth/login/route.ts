import { type NextRequest } from 'next/server';
import { loginSchema } from '@/lib/validations/auth';
import {
  peekRateLimit,
  formatRetryAfterEnhanced,
} from '@/lib/services/rateLimit';
import { logger } from '@/lib/logger';
import {
  validationErrorResponse,
  internalErrorResponse,
  rateLimitErrorResponse,
} from '@/lib/api/response';
import { extractFirstValidationError } from '@/lib/api/validation';
import { extractErrorMessage } from '@/lib/api/error';
import { getClientIp } from '@/lib/api/rate-limit';

const SUCCESS_RESPONSE = { success: true } as const;
const HTTP_STATUS_OK = 200;

/**
 * Pre-check rate-limit pour le formulaire de login.
 *
 * Cette route NE FAIT PAS l'authentification : elle se contente de
 * verifier (sans incrementer) le rate-limit IP + email AVANT que le
 * client n'appelle `signIn('credentials', ...)`. Cela permet de :
 *
 *   1. Afficher un message FR clair "Reessayez dans X secondes" si
 *      l'IP ou l'email est temporairement bloque.
 *   2. Eviter qu'une avalanche de tentatives ne tape inutilement le
 *      verificateur bcrypt (cout ~250ms par essai).
 *
 * L'auth elle-meme se fait apres via `signIn` cote client, ce qui
 * laisse NextAuth poser proprement le cookie de session (le bug du
 * pattern Server Action venait justement du cookie pas encore visible
 * apres signIn server-side -> auth() retournait null).
 *
 * Pattern aligne sur C8GApp (`src/app/api/auth/login/route.ts`).
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const clientIp = getClientIp(request);

    const body: unknown = await request.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return validationErrorResponse(
        extractFirstValidationError(validated.error)
      );
    }

    const { email } = validated.data;

    // Double cle : IP (anti-script) + email lower-case (anti-targeting).
    // peekRateLimit() ne consomme PAS de quota : la tentative reelle est
    // comptee par NextAuth `authorize()` plus tard, evitant le double count.
    const ipRateLimit = await peekRateLimit('LOGIN', clientIp);
    const emailRateLimit = await peekRateLimit(
      'LOGIN',
      `email:${email.toLowerCase()}`
    );

    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
      const retryAfterMs = Math.max(
        ipRateLimit.retryAfterMs ?? 0,
        emailRateLimit.retryAfterMs ?? 0
      );
      const retryAfter = formatRetryAfterEnhanced(retryAfterMs);
      return rateLimitErrorResponse(
        `Trop de tentatives de connexion. Reessayez dans ${retryAfter}.`,
        retryAfterMs
      );
    }

    return Response.json(SUCCESS_RESPONSE, { status: HTTP_STATUS_OK });
  } catch (error: unknown) {
    logger.error('Login rate limit check error', {
      error: extractErrorMessage(error),
    });
    return internalErrorResponse();
  }
}
