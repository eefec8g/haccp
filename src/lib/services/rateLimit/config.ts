import type { Duration } from '@upstash/ratelimit';
import type { RateLimitType } from './types';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/**
 * Configuration par type de rate-limit.
 *
 * Les valeurs sont declarees directement en ms (canonique cote provider
 * in-memory) et converties au format Upstash via `toUpstashDuration`
 * (cote Upstash). Pourquoi inliner ici plutot que reutiliser des
 * constantes externes (`RATE_LIMIT_LOGIN_MAX`, etc.) : ce module est
 * la source de verite du rate-limit ; les anciennes constantes
 * (`*_WINDOW` en format Upstash string) ne servent plus a personne
 * apres ce refacto et ont ete supprimees pour eviter le mort code.
 */
interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxRequests: number;
}

export const RATE_LIMITS: Readonly<Record<RateLimitType, RateLimitConfig>> = {
  LOGIN: { windowMs: 900_000, maxRequests: 5 }, // 15 min, 5 essais
  PASSWORD_RESET: { windowMs: 3_600_000, maxRequests: 3 }, // 1 h, 3 demandes
  USER_INVITE: { windowMs: 3_600_000, maxRequests: 10 }, // 1 h, 10 invitations
  INVITATION_ACCEPT: { windowMs: 900_000, maxRequests: 5 }, // 15 min, 5 essais token
} as const;

/**
 * Convertit une duree (ms) en format Upstash Ratelimit Duration
 * (`"N s"` / `"N m"` / `"N h"`). On arrondit au superieur pour ne
 * jamais raccourcir la fenetre demandee.
 */
export function toUpstashDuration(windowMs: number): Duration {
  const seconds = Math.ceil(windowMs / MILLISECONDS_PER_SECOND);

  if (seconds < SECONDS_PER_MINUTE) {
    // Validated: matches Upstash Duration format "N s"
    return `${seconds} s` as Duration;
  }

  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);

  if (minutes < MINUTES_PER_HOUR) {
    // Validated: matches Upstash Duration format "N m"
    return `${minutes} m` as Duration;
  }

  const hours = Math.ceil(minutes / MINUTES_PER_HOUR);
  // Validated: matches Upstash Duration format "N h"
  return `${hours} h` as Duration;
}
