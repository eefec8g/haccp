import { describe, it, expect } from 'vitest';
import {
  formatRetryAfterEnhanced,
  formatRetryAfter,
  getRateLimitHeaders,
  toRetryAfterSeconds,
  checkRateLimit,
  checkRateLimitEnhanced,
  recordRequest,
  recordFailedAttempt,
  resetRateLimit,
  resetRateLimitEnhanced,
  RateLimitConfig,
} from './index';
import { RATE_LIMITS } from './config';
import type { RateLimitResult } from './types';

/**
 * Tests de l'API publique du module rate-limit : on documente ici le
 * contrat consomme par les call sites (Server Actions, futurs middlewares)
 * pour eviter les regressions silencieuses (changement de format de
 * headers, perte d'un alias, mauvais arrondi du Retry-After...).
 */
describe('[index.getRateLimitHeaders]', () => {
  const RESET_AT_MS = 1_700_000_000_000;

  it('should include X-RateLimit-Remaining and X-RateLimit-Reset (seconds)', () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingRequests: 3,
      resetAtMs: RESET_AT_MS,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Remaining']).toBe('3');
    expect(headers['X-RateLimit-Reset']).toBe(
      String(Math.ceil(RESET_AT_MS / 1000))
    );
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('should include Retry-After (seconds, rounded up) when retryAfterMs is set', () => {
    const result: RateLimitResult = {
      allowed: false,
      remainingRequests: 0,
      resetAtMs: RESET_AT_MS,
      retryAfterMs: 1500,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['Retry-After']).toBe('2');
  });
});

describe('[index.formatRetryAfterEnhanced]', () => {
  it('should format 1000 ms as "1 seconde" (singular)', () => {
    expect(formatRetryAfterEnhanced(1000)).toBe('1 seconde');
  });

  it('should format 45_000 ms as "45 secondes" (plural)', () => {
    expect(formatRetryAfterEnhanced(45_000)).toBe('45 secondes');
  });

  it('should format 60_000 ms as "1 minute" (singular)', () => {
    expect(formatRetryAfterEnhanced(60_000)).toBe('1 minute');
  });

  it('should format 900_000 ms (15 min) as "15 minutes" (plural)', () => {
    expect(formatRetryAfterEnhanced(900_000)).toBe('15 minutes');
  });
});

describe('[index.toRetryAfterSeconds]', () => {
  it('should return 0 when retryAfterMs is undefined', () => {
    expect(toRetryAfterSeconds(undefined)).toBe(0);
  });

  it('should return 0 when retryAfterMs is 0', () => {
    expect(toRetryAfterSeconds(0)).toBe(0);
  });

  it('should round up 1500 ms to 2 seconds', () => {
    expect(toRetryAfterSeconds(1500)).toBe(2);
  });

  it('should keep an exact 1000 ms as 1 second (no extra rounding)', () => {
    expect(toRetryAfterSeconds(1000)).toBe(1);
  });
});

describe('[index] public API aliases', () => {
  it('should expose checkRateLimit as the same reference as checkRateLimitEnhanced', () => {
    expect(checkRateLimit).toBe(checkRateLimitEnhanced);
  });

  it('should expose recordFailedAttempt as the same reference as recordRequest', () => {
    expect(recordFailedAttempt).toBe(recordRequest);
  });

  it('should expose resetRateLimit as the same reference as resetRateLimitEnhanced', () => {
    expect(resetRateLimit).toBe(resetRateLimitEnhanced);
  });

  it('should expose formatRetryAfter as the same reference as formatRetryAfterEnhanced', () => {
    expect(formatRetryAfter).toBe(formatRetryAfterEnhanced);
  });

  it('should re-export RateLimitConfig as the same reference as RATE_LIMITS', () => {
    expect(RateLimitConfig).toBe(RATE_LIMITS);
  });
});
