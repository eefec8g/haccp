import { logger } from '@/lib/logger';
import { RATE_LIMITS } from './config';
import type {
  RateLimitProvider,
  RateLimitResult,
  RateLimitType,
} from './types';

interface RateLimitEntry {
  readonly count: number;
  readonly expiresAt: number;
}

type StoreMap = Map<string, RateLimitEntry>;

/**
 * Store global partage entre les instances du provider in-memory.
 * On l'attache a `globalThis` pour survivre au HMR Next.js (sinon le
 * compteur serait reset a chaque hot-reload, ce qui masquerait des
 * regressions de rate-limit en dev).
 */
const globalForRateLimit = globalThis as unknown as {
  __rateLimitStore?: StoreMap;
};

const globalStore: StoreMap =
  globalForRateLimit.__rateLimitStore ?? new Map<string, RateLimitEntry>();
globalForRateLimit.__rateLimitStore = globalStore;

let hasWarnedServerless = false;

function buildKey(type: RateLimitType, identifier: string): string {
  return `rl:${type}:${identifier}`;
}

function cleanExpired(): void {
  const now = Date.now();
  for (const [key, entry] of globalStore.entries()) {
    if (now > entry.expiresAt) {
      globalStore.delete(key);
    }
  }
}

function getEntry(key: string): RateLimitEntry | null {
  const entry = globalStore.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    globalStore.delete(key);
    return null;
  }
  return entry;
}

function incrementEntry(key: string, windowMs: number): RateLimitEntry {
  cleanExpired();
  const now = Date.now();
  const existing = getEntry(key);

  if (!existing) {
    const entry: RateLimitEntry = { count: 1, expiresAt: now + windowMs };
    globalStore.set(key, entry);
    return entry;
  }

  const updated: RateLimitEntry = { ...existing, count: existing.count + 1 };
  globalStore.set(key, updated);
  return updated;
}

/**
 * Adapter in-memory : compteur fixe `(count, expiresAt)` par cle. Utilise
 * en dev local et comme fallback resilient quand Upstash echoue. Pas
 * distribue : sur multi-instance (Vercel/Fly/Render/Docker self-host)
 * chaque process a son propre Map -- assume par design pour le fallback
 * (et logue un warning explicite en production).
 */
export function createInMemoryProvider(): RateLimitProvider {
  if (!hasWarnedServerless && process.env.NODE_ENV === 'production') {
    hasWarnedServerless = true;
    logger.warn(
      'Rate limiting using in-memory fallback in production. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.'
    );
  }

  return {
    async checkAndRecord(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      const config = RATE_LIMITS[type];
      const key = buildKey(type, identifier);
      const entry = incrementEntry(key, config.windowMs);

      if (entry.count > config.maxRequests) {
        const retryAfterMs = Math.max(0, entry.expiresAt - Date.now());

        logger.warn('Rate limit exceeded', {
          type,
          identifier: identifier.substring(0, 20),
          count: entry.count,
          maxRequests: config.maxRequests,
        });

        return {
          allowed: false,
          remainingRequests: 0,
          resetAtMs: entry.expiresAt,
          retryAfterMs,
        };
      }

      return {
        allowed: true,
        remainingRequests: config.maxRequests - entry.count,
        resetAtMs: entry.expiresAt,
      };
    },

    async peek(
      type: RateLimitType,
      identifier: string
    ): Promise<RateLimitResult> {
      const config = RATE_LIMITS[type];
      const key = buildKey(type, identifier);
      const now = Date.now();
      const entry = getEntry(key);

      if (!entry) {
        return {
          allowed: true,
          remainingRequests: config.maxRequests,
          resetAtMs: now + config.windowMs,
        };
      }

      if (entry.count >= config.maxRequests) {
        const retryAfterMs = Math.max(0, entry.expiresAt - now);
        return {
          allowed: false,
          remainingRequests: 0,
          resetAtMs: entry.expiresAt,
          retryAfterMs,
        };
      }

      return {
        allowed: true,
        remainingRequests: config.maxRequests - entry.count,
        resetAtMs: entry.expiresAt,
      };
    },

    async reset(type: RateLimitType, identifier: string): Promise<void> {
      const key = buildKey(type, identifier);
      globalStore.delete(key);
    },
  };
}

export { globalStore as _testStore };
