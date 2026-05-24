import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import type { Duration } from '@upstash/ratelimit';
import {
  RATE_LIMIT_FORGOT_MAX,
  RATE_LIMIT_FORGOT_WINDOW,
  RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_LOGIN_WINDOW,
} from '@/lib/constants/auth';

const MISSING_REDIS_ENV_MESSAGE =
  'Rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.';

let cachedRedis: Redis | null = null;

/**
 * Retourne le singleton Upstash Redis. Lazy : on n'instancie qu'a
 * la premiere utilisation pour ne pas faire planter `next build`
 * dans des contextes sans variables d'environnement.
 *
 * Lit les vars UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN.
 * Throw clair si manquantes (pas de fallback silencieux).
 */
export function getRedisClient(): Redis {
  if (cachedRedis) {
    return cachedRedis;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(MISSING_REDIS_ENV_MESSAGE);
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

interface RateLimiterConfig {
  readonly prefix: string;
  readonly max: number;
  readonly window: Duration;
}

/**
 * Factory : cree un Ratelimit sliding-window pre-configure.
 * Utilise un cache module-level pour eviter de re-creer le client
 * Redis a chaque requete.
 */
export function createRateLimiter({
  prefix,
  max,
  window,
}: RateLimiterConfig): Ratelimit {
  return new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(max, window),
    prefix,
    analytics: false,
  });
}

let loginLimiter: Ratelimit | null = null;
let forgotPasswordLimiter: Ratelimit | null = null;

/**
 * Rate limiter login : 5 / 15 min. Lazy-init pour ne pas requerir
 * les env vars en build / tests qui n'utilisent pas le rate limit.
 */
export function getLoginRateLimiter(): Ratelimit {
  if (!loginLimiter) {
    loginLimiter = createRateLimiter({
      prefix: 'rl:login',
      max: RATE_LIMIT_LOGIN_MAX,
      window: RATE_LIMIT_LOGIN_WINDOW,
    });
  }
  return loginLimiter;
}

/**
 * Rate limiter forgot-password : 3 / 1h.
 */
export function getForgotPasswordRateLimiter(): Ratelimit {
  if (!forgotPasswordLimiter) {
    forgotPasswordLimiter = createRateLimiter({
      prefix: 'rl:forgot',
      max: RATE_LIMIT_FORGOT_MAX,
      window: RATE_LIMIT_FORGOT_WINDOW,
    });
  }
  return forgotPasswordLimiter;
}

export interface RateLimitResult {
  readonly success: boolean;
  /** Nombre de secondes avant de pouvoir reessayer (0 si success). */
  readonly retryAfterSeconds: number;
}

/**
 * Wrapper standardise autour de Ratelimit.limit().
 * Retourne un Result simple a consommer cote API route.
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitResult> {
  const { success, reset } = await limiter.limit(identifier);
  const retryAfterSeconds = success
    ? 0
    : Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return { success, retryAfterSeconds };
}
