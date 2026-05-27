import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests du provider Upstash en mockant `@upstash/redis` et
 * `@upstash/ratelimit`. On capture les options passees a `new Ratelimit`
 * pour verifier le prefix (`haccp:rl:<type>`), puis on shunte chaque
 * methode (`limit`, `getRemaining`, `resetUsedTokens`) pour piloter le
 * retour et valider la conversion `success/remaining/reset` -> notre
 * `RateLimitResult` canonique.
 */

interface CapturedRatelimitOptions {
  readonly prefix?: string;
  readonly analytics?: boolean;
  readonly limiter?: unknown;
  readonly redis?: unknown;
}

const {
  capturedOptions,
  limitMock,
  getRemainingMock,
  resetUsedTokensMock,
  FakeRatelimit,
  FakeRedis,
} = vi.hoisted(() => {
  const capturedOptions: CapturedRatelimitOptions[] = [];
  const limitMock = vi.fn();
  const getRemainingMock = vi.fn();
  const resetUsedTokensMock = vi.fn();

  class FakeRatelimit {
    static slidingWindow(
      maxRequests: number,
      duration: string
    ): {
      readonly kind: 'slidingWindow';
      readonly maxRequests: number;
      readonly duration: string;
    } {
      return { kind: 'slidingWindow', maxRequests, duration };
    }
    constructor(options: CapturedRatelimitOptions) {
      capturedOptions.push(options);
    }
    limit = limitMock;
    getRemaining = getRemainingMock;
    resetUsedTokens = resetUsedTokensMock;
  }

  class FakeRedis {
    constructor(public readonly config: { url: string; token: string }) {}
  }

  return {
    capturedOptions,
    limitMock,
    getRemainingMock,
    resetUsedTokensMock,
    FakeRatelimit,
    FakeRedis,
  };
});

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: FakeRatelimit,
}));

vi.mock('@upstash/redis', () => ({
  Redis: FakeRedis,
}));

import { createUpstashProvider } from './upstashProvider';

beforeEach(() => {
  capturedOptions.length = 0;
  limitMock.mockReset();
  getRemainingMock.mockReset();
  resetUsedTokensMock.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T10:00:00Z').getTime());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('[upstashProvider]', () => {
  it('should create one limiter per type with the haccp:rl:<type> prefix and analytics disabled', () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    createUpstashProvider('https://example.upstash.io', 'fake-token');

    const prefixes = capturedOptions.map((o) => o.prefix);
    expect(prefixes).toEqual([
      'haccp:rl:LOGIN',
      'haccp:rl:PASSWORD_RESET',
      'haccp:rl:USER_INVITE',
      'haccp:rl:INVITATION_ACCEPT',
      'haccp:rl:RELEVE_CREATE',
      'haccp:rl:RELEVE_ANNULATION',
      'haccp:rl:ALERTE_RESOLVE',
      'haccp:rl:EXPORT_CSV',
      'haccp:rl:EXPORT_PDF',
    ]);
    expect(capturedOptions.every((o) => o.analytics === false)).toBe(true);
  });

  it('checkAndRecord should return allowed=true and forward remaining/reset on success', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    const resetAtMs = Date.now() + 60_000;
    limitMock.mockResolvedValueOnce({
      success: true,
      remaining: 4,
      reset: resetAtMs,
    });

    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(result).toEqual({
      allowed: true,
      remainingRequests: 4,
      resetAtMs,
    });
    expect(limitMock).toHaveBeenCalledWith('1.2.3.4');
  });

  it('checkAndRecord should return allowed=false with retryAfterMs when limit is reached', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    const resetAtMs = Date.now() + 120_000;
    limitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: resetAtMs,
    });

    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(result).toEqual({
      allowed: false,
      remainingRequests: 0,
      resetAtMs,
      retryAfterMs: 120_000,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({ type: 'LOGIN' })
    );
  });

  it('peek should return allowed=true and remaining when getRemaining > 0', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    const resetAtMs = Date.now() + 30_000;
    getRemainingMock.mockResolvedValueOnce({ remaining: 3, reset: resetAtMs });

    const result = await provider.peek('LOGIN', '1.2.3.4');

    expect(result).toEqual({
      allowed: true,
      remainingRequests: 3,
      resetAtMs,
    });
    expect(getRemainingMock).toHaveBeenCalledWith('1.2.3.4');
  });

  it('peek should return allowed=false with retryAfterMs when remaining is 0', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    const resetAtMs = Date.now() + 60_000;
    getRemainingMock.mockResolvedValueOnce({ remaining: 0, reset: resetAtMs });

    const result = await provider.peek('LOGIN', '1.2.3.4');

    expect(result).toEqual({
      allowed: false,
      remainingRequests: 0,
      resetAtMs,
      retryAfterMs: 60_000,
    });
  });

  it('peek should fall back to now + windowMs when reset is 0 (no entry yet)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    getRemainingMock.mockResolvedValueOnce({ remaining: 5, reset: 0 });

    const result = await provider.peek('LOGIN', '1.2.3.4');

    // LOGIN windowMs = 900_000 (15 min)
    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(5);
    expect(result.resetAtMs).toBe(Date.now() + 900_000);
  });

  it('reset should delegate to limiter.resetUsedTokens', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = createUpstashProvider('https://example.upstash.io', 'tok');
    resetUsedTokensMock.mockResolvedValueOnce(undefined);

    await provider.reset('LOGIN', '1.2.3.4');

    expect(resetUsedTokensMock).toHaveBeenCalledWith('1.2.3.4');
  });
});
