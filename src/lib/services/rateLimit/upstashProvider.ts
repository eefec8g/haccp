import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';
import { RATE_LIMITS, toUpstashDuration } from './config';
import type {
  RateLimitProvider,
  RateLimitResult,
  RateLimitType,
} from './types';

const PREFIX_NAMESPACE = 'haccp:rl';

/**
 * Cree un Ratelimit Upstash par type. On instancie une seule fois au
 * boot du provider pour eviter la creation d'objets a chaque check.
 */
function createLimiters(
  redis: Redis
): Readonly<Record<RateLimitType, Ratelimit>> {
  const types = Object.keys(RATE_LIMITS) as RateLimitType[];

  return Object.fromEntries(
    types.map((type) => {
      const config = RATE_LIMITS[type];
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          config.maxRequests,
          toUpstashDuration(config.windowMs)
        ),
        prefix: `${PREFIX_NAMESPACE}:${type}`,
        analytics: false,
      });
      return [type, limiter];
    })
  ) as Record<RateLimitType, Ratelimit>;
}

/**
 * Adapter Upstash Redis : delegue les operations au sliding-window
 * algorithm fourni par `@upstash/ratelimit`. Utilise en production
 * (multi-instance / serverless).
 */
export function createUpstashProvider(
  url: string,
  token: string
): RateLimitProvider {
  const redis = new Redis({ url, token });
  const limiters = createLimiters(redis);

  logger.info('Rate limiting using Upstash Redis');

  return {
    async checkAndRecord(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      const limiter = limiters[type];
      const { success, remaining, reset } = await limiter.limit(identifier);

      const resetAtMs = reset;
      const now = Date.now();

      if (!success) {
        const retryAfterMs = Math.max(0, resetAtMs - now);

        logger.warn('Rate limit exceeded', {
          type,
          identifier: identifier.substring(0, 20),
          remaining,
        });

        return {
          allowed: false,
          remainingRequests: 0,
          resetAtMs,
          retryAfterMs,
        };
      }

      return { allowed: true, remainingRequests: remaining, resetAtMs };
    },

    async peek(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      const limiter = limiters[type];
      const { remaining, reset } = await limiter.getRemaining(identifier);
      const config = RATE_LIMITS[type];

      const resetAtMs = reset;
      const now = Date.now();
      const allowed = remaining > 0;

      if (!allowed) {
        const retryAfterMs = Math.max(0, resetAtMs - now);
        return {
          allowed: false,
          remainingRequests: 0,
          resetAtMs,
          retryAfterMs,
        };
      }

      return {
        allowed: true,
        remainingRequests: remaining,
        resetAtMs: resetAtMs || now + config.windowMs,
      };
    },

    async reset(type: RateLimitType, identifier: string): Promise<void> {
      const limiter = limiters[type];
      await limiter.resetUsedTokens(identifier);
    },
  };
}
