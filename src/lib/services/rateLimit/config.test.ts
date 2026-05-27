import { describe, it, expect } from 'vitest';
import { RATE_LIMITS, toUpstashDuration } from './config';

/**
 * Tests de conversion `windowMs -> Upstash Duration` et de la coherence
 * du tableau RATE_LIMITS expose. Documenter ici les arrondis (au superieur)
 * pour eviter une regression silencieuse (fenetre raccourcie).
 */
describe('[config.toUpstashDuration]', () => {
  it('should format 30s in seconds when below 1 minute', () => {
    expect(toUpstashDuration(30_000)).toBe('30 s');
  });

  it('should format 900_000 ms (15 min) as "15 m"', () => {
    expect(toUpstashDuration(900_000)).toBe('15 m');
  });

  it('should format 3_600_000 ms (1 h) as "1 h"', () => {
    expect(toUpstashDuration(3_600_000)).toBe('1 h');
  });

  it('should format 7_200_000 ms (2 h) as "2 h"', () => {
    expect(toUpstashDuration(7_200_000)).toBe('2 h');
  });

  it('should round seconds up so a 59_999 ms window becomes "1 m"', () => {
    // 59_999 ms -> ceil = 60 s -> bascule sur les minutes -> "1 m"
    expect(toUpstashDuration(59_999)).toBe('1 m');
  });

  it('should round 1 ms up to "1 s" so no window is ever shortened', () => {
    expect(toUpstashDuration(1)).toBe('1 s');
  });
});

describe('[config.RATE_LIMITS]', () => {
  it('should expose the canonical 4 rate-limit types with HACCP defaults', () => {
    expect(RATE_LIMITS.LOGIN).toEqual({ windowMs: 900_000, maxRequests: 5 });
    expect(RATE_LIMITS.PASSWORD_RESET).toEqual({
      windowMs: 3_600_000,
      maxRequests: 3,
    });
    expect(RATE_LIMITS.USER_INVITE).toEqual({
      windowMs: 3_600_000,
      maxRequests: 10,
    });
    expect(RATE_LIMITS.INVITATION_ACCEPT).toEqual({
      windowMs: 900_000,
      maxRequests: 5,
    });
  });

  it('should configure EXPORT_CSV to 5 requests per hour (audit DDPP budget)', () => {
    expect(RATE_LIMITS.EXPORT_CSV).toEqual({
      windowMs: 3_600_000,
      maxRequests: 5,
    });
  });

  it('should configure EXPORT_PDF to 2 requests per hour (pdfmake cost)', () => {
    expect(RATE_LIMITS.EXPORT_PDF).toEqual({
      windowMs: 3_600_000,
      maxRequests: 2,
    });
  });

  it('should configure PHOTO_UPLOAD to 20 requests per hour (Epic PHOTOS anti-spam + storage cost)', () => {
    expect(RATE_LIMITS.PHOTO_UPLOAD).toEqual({
      windowMs: 3_600_000,
      maxRequests: 20,
    });
  });

  it('should configure SIGNATURE_UPLOAD to 10 requests per hour (Epic SIGNATURE anti-spam DDPP)', () => {
    expect(RATE_LIMITS.SIGNATURE_UPLOAD).toEqual({
      windowMs: 3_600_000,
      maxRequests: 10,
    });
  });
});
