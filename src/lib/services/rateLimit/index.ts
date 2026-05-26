/**
 * Point d'entree public du module rate-limit HACCP.
 *
 * API canonique :
 *   - checkRateLimitEnhanced  : check + record (chemin chaud auth)
 *   - peekRateLimit           : check sans consommer (UI affichage quota)
 *   - recordRequest           : enregistrement explicite (alias)
 *   - resetRateLimitEnhanced  : reset compteur (admin / tests)
 *   - getRateLimitHeaders     : helpers headers X-RateLimit-* + Retry-After
 *   - formatRetryAfterEnhanced: format humain "X secondes"/"X minutes"
 *   - toRetryAfterSeconds     : helper ms -> secondes (arrondi superieur)
 *
 * Aliases courts conserves pour symetrie avec C8GApp et faciliter
 * la portabilite des call sites :
 *   - checkRateLimit       = checkRateLimitEnhanced
 *   - recordFailedAttempt  = recordRequest
 *   - resetRateLimit       = resetRateLimitEnhanced
 *   - formatRetryAfter     = formatRetryAfterEnhanced
 *   - RateLimitConfig      = RATE_LIMITS (re-export pour introspection)
 */
import { getRateLimitProvider } from './rateLimitFactory';
import { RATE_LIMITS } from './config';
import type { RateLimitType, RateLimitResult } from './types';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/**
 * Convertit un `retryAfterMs` (potentiellement absent) en secondes pour
 * exposition au client. Garde un contrat simple : `undefined` ou `0`
 * retourne `0` (rien a attendre), arrondi superieur sinon pour ne jamais
 * promettre une attente plus courte que la realite.
 */
export function toRetryAfterSeconds(retryAfterMs: number | undefined): number {
  if (!retryAfterMs) {
    return 0;
  }
  return Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND);
}

export async function checkRateLimitEnhanced(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();
  return provider.checkAndRecord(type, identifier);
}

export async function peekRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();
  return provider.peek(type, identifier);
}

export async function recordRequest(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();
  return provider.checkAndRecord(type, identifier);
}

export async function resetRateLimitEnhanced(
  type: RateLimitType,
  identifier: string
): Promise<void> {
  const provider = getRateLimitProvider();
  return provider.reset(type, identifier);
}

export function getRateLimitHeaders(result: RateLimitResult): {
  readonly 'X-RateLimit-Remaining': string;
  readonly 'X-RateLimit-Reset': string;
  readonly 'Retry-After'?: string;
} {
  const headers: {
    'X-RateLimit-Remaining': string;
    'X-RateLimit-Reset': string;
    'Retry-After'?: string;
  } = {
    'X-RateLimit-Remaining': String(result.remainingRequests),
    'X-RateLimit-Reset': String(
      Math.ceil(result.resetAtMs / MILLISECONDS_PER_SECOND)
    ),
  };

  if (result.retryAfterMs) {
    headers['Retry-After'] = String(
      Math.ceil(result.retryAfterMs / MILLISECONDS_PER_SECOND)
    );
  }

  return headers;
}

export function formatRetryAfterEnhanced(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND);

  if (seconds < SECONDS_PER_MINUTE) {
    return seconds === 1 ? '1 seconde' : `${seconds} secondes`;
  }

  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

export const checkRateLimit = checkRateLimitEnhanced;
export const recordFailedAttempt = recordRequest;
export const resetRateLimit = resetRateLimitEnhanced;
export const formatRetryAfter = formatRetryAfterEnhanced;

export const RateLimitConfig = RATE_LIMITS;
export type { RateLimitType, RateLimitResult };
