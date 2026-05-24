import { describe, it, expect } from 'vitest';
import { buildRateLimitMessage } from './rate-limit-message';

describe('[buildRateLimitMessage]', () => {
  it('should return a generic message when retryAfterSeconds is 0 or negative', () => {
    expect(buildRateLimitMessage(0)).toBe(
      'Trop de tentatives. Veuillez patienter quelques minutes.'
    );
    expect(buildRateLimitMessage(-5)).toBe(
      'Trop de tentatives. Veuillez patienter quelques minutes.'
    );
  });

  it('should format delay in seconds when less than 60s (singular)', () => {
    expect(buildRateLimitMessage(1)).toBe(
      'Trop de tentatives. Reessayez dans 1 seconde.'
    );
  });

  it('should format delay in seconds when less than 60s (plural)', () => {
    expect(buildRateLimitMessage(30)).toBe(
      'Trop de tentatives. Reessayez dans 30 secondes.'
    );
  });

  it('should format delay as "1 minute" (singular) for exactly 60s', () => {
    expect(buildRateLimitMessage(60)).toBe(
      'Trop de tentatives. Reessayez dans 1 minute.'
    );
  });

  it('should round up to the next minute and pluralize correctly', () => {
    expect(buildRateLimitMessage(120)).toBe(
      'Trop de tentatives. Reessayez dans 2 minutes.'
    );
    expect(buildRateLimitMessage(125)).toBe(
      'Trop de tentatives. Reessayez dans 3 minutes.'
    );
    expect(buildRateLimitMessage(1800)).toBe(
      'Trop de tentatives. Reessayez dans 30 minutes.'
    );
  });
});
