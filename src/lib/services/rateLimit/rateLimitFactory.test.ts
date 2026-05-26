import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RateLimitProvider, RateLimitResult } from './types';

/**
 * Tests du resolveur de provider rate-limit.
 *
 * On distingue deux scenarios :
 *   1. Selection branche (env vars presents/absents) -> `getRateLimitProvider`
 *      avec stub env. La branche Upstash est testee a part avec un mock
 *      complet de `createUpstashProvider` / `createInMemoryProvider`.
 *   2. Comportement du wrapper resilient (TTL retry / recovery) ->
 *      `_createResilientUpstashProvider` avec mock fin des dependances
 *      pour piloter les succes/echecs Upstash.
 */

const {
  upstashCheckAndRecord,
  upstashPeek,
  upstashReset,
  inMemoryCheckAndRecord,
  inMemoryPeek,
  inMemoryReset,
  createUpstashProviderMock,
  createInMemoryProviderMock,
} = vi.hoisted(() => {
  const upstashCheckAndRecord = vi.fn();
  const upstashPeek = vi.fn();
  const upstashReset = vi.fn();
  const inMemoryCheckAndRecord = vi.fn();
  const inMemoryPeek = vi.fn();
  const inMemoryReset = vi.fn();
  const createUpstashProviderMock = vi.fn();
  const createInMemoryProviderMock = vi.fn();
  return {
    upstashCheckAndRecord,
    upstashPeek,
    upstashReset,
    inMemoryCheckAndRecord,
    inMemoryPeek,
    inMemoryReset,
    createUpstashProviderMock,
    createInMemoryProviderMock,
  };
});

vi.mock('./upstashProvider', () => ({
  createUpstashProvider: createUpstashProviderMock,
}));

vi.mock('./inMemoryProvider', () => ({
  createInMemoryProvider: createInMemoryProviderMock,
}));

import {
  getRateLimitProvider,
  _resetProvider,
  _createResilientUpstashProvider,
  _UPSTASH_RETRY_INTERVAL_MS,
} from './rateLimitFactory';

const ALLOWED_RESULT: RateLimitResult = {
  allowed: true,
  remainingRequests: 4,
  resetAtMs: 0,
};

function buildUpstashStub(): RateLimitProvider {
  return {
    checkAndRecord: upstashCheckAndRecord,
    peek: upstashPeek,
    reset: upstashReset,
  };
}

function buildInMemoryStub(): RateLimitProvider {
  return {
    checkAndRecord: inMemoryCheckAndRecord,
    peek: inMemoryPeek,
    reset: inMemoryReset,
  };
}

beforeEach(() => {
  _resetProvider();
  vi.unstubAllEnvs();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

  upstashCheckAndRecord.mockReset();
  upstashPeek.mockReset();
  upstashReset.mockReset();
  inMemoryCheckAndRecord.mockReset();
  inMemoryPeek.mockReset();
  inMemoryReset.mockReset();
  createUpstashProviderMock.mockReset();
  createInMemoryProviderMock.mockReset();

  createUpstashProviderMock.mockImplementation(() => buildUpstashStub());
  createInMemoryProviderMock.mockImplementation(() => buildInMemoryStub());

  inMemoryCheckAndRecord.mockResolvedValue(ALLOWED_RESULT);
  inMemoryPeek.mockResolvedValue(ALLOWED_RESULT);
  inMemoryReset.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
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

describe('[createResilientUpstashProvider] checkAndRecord', () => {
  it('should fall back to in-memory when Upstash throws (allowed=true)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('NOPERM evalsha'));

    const provider = _createResilientUpstashProvider('url', 'token');
    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(inMemoryCheckAndRecord).toHaveBeenCalledWith('LOGIN', '1.2.3.4');
  });

  it('should skip Upstash on the second call once fallback is active (within TTL)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z').getTime());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('boom'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.checkAndRecord('LOGIN', '1.2.3.4');
    upstashCheckAndRecord.mockClear();

    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(upstashCheckAndRecord).not.toHaveBeenCalled();
    expect(inMemoryCheckAndRecord).toHaveBeenCalledTimes(2);
  });

  it('should retry Upstash after UPSTASH_RETRY_INTERVAL_MS elapses', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T10:00:00Z').getTime();
    vi.setSystemTime(start);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('boom'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    // TTL expired -> Upstash retried
    vi.setSystemTime(start + _UPSTASH_RETRY_INTERVAL_MS + 1);
    upstashCheckAndRecord.mockResolvedValueOnce(ALLOWED_RESULT);

    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(upstashCheckAndRecord).toHaveBeenCalledTimes(2);
    expect(result.allowed).toBe(true);
  });

  it('should clear the fallback and log a recovery warn when Upstash retry succeeds', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T10:00:00Z').getTime();
    vi.setSystemTime(start);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('boom'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    vi.setSystemTime(start + _UPSTASH_RETRY_INTERVAL_MS + 1);
    upstashCheckAndRecord.mockResolvedValueOnce(ALLOWED_RESULT);
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    // Apres recovery, on doit etre revenu sur Upstash : appel suivant
    // ne passe plus par le fallback.
    upstashCheckAndRecord.mockResolvedValueOnce(ALLOWED_RESULT);
    inMemoryCheckAndRecord.mockClear();
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(inMemoryCheckAndRecord).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Rate limit: switching back to Upstash'
    );
  });

  it('should re-activate fallback when Upstash retry fails again', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-15T10:00:00Z').getTime();
    vi.setSystemTime(start);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('first'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    vi.setSystemTime(start + _UPSTASH_RETRY_INTERVAL_MS + 1);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('second'));
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    // Doit etre encore en fallback : appel immediat -> direct in-memory.
    upstashCheckAndRecord.mockClear();
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(upstashCheckAndRecord).not.toHaveBeenCalled();
  });

  it('should log an error with op=checkAndRecord on each Upstash failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    upstashCheckAndRecord.mockRejectedValueOnce(new Error('NOPERM evalsha'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(errorSpy).toHaveBeenCalledWith(
      'Upstash rate-limit command failed',
      expect.objectContaining({
        op: 'checkAndRecord',
        cause: expect.stringContaining('NOPERM evalsha'),
      })
    );
  });
});

describe('[createResilientUpstashProvider] peek', () => {
  it('should fall back to in-memory peek when Upstash peek throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashPeek.mockRejectedValueOnce(new Error('down'));

    const provider = _createResilientUpstashProvider('url', 'token');
    const result = await provider.peek('LOGIN', '1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(inMemoryPeek).toHaveBeenCalledWith('LOGIN', '1.2.3.4');
  });

  it('should log an error with op=peek on Upstash failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    upstashPeek.mockRejectedValueOnce(new Error('peek down'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.peek('LOGIN', '1.2.3.4');

    expect(errorSpy).toHaveBeenCalledWith(
      'Upstash rate-limit command failed',
      expect.objectContaining({ op: 'peek' })
    );
  });
});

describe('[createResilientUpstashProvider] reset', () => {
  it('should fall back to in-memory reset when Upstash reset throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    upstashReset.mockRejectedValueOnce(new Error('down'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.reset('LOGIN', '1.2.3.4');

    expect(inMemoryReset).toHaveBeenCalledWith('LOGIN', '1.2.3.4');
  });

  it('should log an error with op=reset on Upstash failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    upstashReset.mockRejectedValueOnce(new Error('reset down'));

    const provider = _createResilientUpstashProvider('url', 'token');
    await provider.reset('LOGIN', '1.2.3.4');

    expect(errorSpy).toHaveBeenCalledWith(
      'Upstash rate-limit command failed',
      expect.objectContaining({ op: 'reset' })
    );
  });
});
