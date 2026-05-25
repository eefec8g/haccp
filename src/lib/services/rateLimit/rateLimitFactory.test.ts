import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { getRateLimitProvider, _resetProvider } from './rateLimitFactory';

beforeEach(() => {
  _resetProvider();
  vi.unstubAllEnvs();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('[getRateLimitProvider]', () => {
  it('should return an in-memory provider with a warning when env vars are missing', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const provider = getRateLimitProvider();
    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      'Rate limit: Redis not configured, using in-memory provider'
    );
  });

  it('should cache the provider across calls (singleton)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const first = getRateLimitProvider();
    const second = getRateLimitProvider();

    expect(second).toBe(first);
  });

  it('should build an Upstash-backed resilient provider when env vars are set', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const provider = getRateLimitProvider();

    // On verifie que toutes les methodes du port sont exposees
    // (preuve qu'on est passe par la branche resilient sans throw).
    expect(typeof provider.checkAndRecord).toBe('function');
    expect(typeof provider.peek).toBe('function');
    expect(typeof provider.reset).toBe('function');
    expect(getRateLimitProvider()).toBe(provider);
  });

  it('should expose peek and reset on the in-memory branch as well', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const provider = getRateLimitProvider();

    expect(typeof provider.peek).toBe('function');
    expect(typeof provider.reset).toBe('function');
    await expect(provider.reset('LOGIN', 'x')).resolves.toBeUndefined();
  });
});
