import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInMemoryProvider, _testStore } from './inMemoryProvider';

const FIXED_NOW_MS = new Date('2026-01-15T10:00:00Z').getTime();

beforeEach(() => {
  _testStore.clear();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW_MS);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('[inMemoryProvider.checkAndRecord]', () => {
  it('should allow the first request and return remainingRequests=max-1', async () => {
    const provider = createInMemoryProvider();

    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    // LOGIN config = 5 requests / 15 min
    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(4);
    expect(result.resetAtMs).toBe(FIXED_NOW_MS + 15 * 60 * 1000);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it('should block the request once maxRequests is exceeded', async () => {
    const provider = createInMemoryProvider();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }

    const blocked = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(blocked.allowed).toBe(false);
    expect(blocked.remainingRequests).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      'Rate limit exceeded',
      expect.objectContaining({
        type: 'LOGIN',
        count: 6,
        maxRequests: 5,
      })
    );
  });

  it('should compute retryAfterMs based on the entry expiration', async () => {
    const provider = createInMemoryProvider();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }
    // Avance de 5 minutes : la fenetre expire dans 10 min.
    vi.setSystemTime(FIXED_NOW_MS + 5 * 60 * 1000);

    const blocked = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(10 * 60 * 1000);
  });

  it('should allow new requests after the window has elapsed', async () => {
    const provider = createInMemoryProvider();
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }
    // Window = 15 min. 16 min plus tard, la cle est expiree.
    vi.setSystemTime(FIXED_NOW_MS + 16 * 60 * 1000);

    const result = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(4);
  });

  it('should track separate counters per identifier', async () => {
    const provider = createInMemoryProvider();
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }

    const other = await provider.checkAndRecord('LOGIN', '5.6.7.8');

    expect(other.allowed).toBe(true);
    expect(other.remainingRequests).toBe(4);
  });

  it('should track separate counters per rate-limit type', async () => {
    const provider = createInMemoryProvider();
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }

    // Meme identifier mais type different : PASSWORD_RESET = 3 max independant.
    const reset = await provider.checkAndRecord('PASSWORD_RESET', '1.2.3.4');

    expect(reset.allowed).toBe(true);
    expect(reset.remainingRequests).toBe(2);
  });
});

describe('[inMemoryProvider.peek]', () => {
  it('should return allowed=true and full quota when key is absent', async () => {
    const provider = createInMemoryProvider();

    const result = await provider.peek('LOGIN', '1.2.3.4');

    expect(result.allowed).toBe(true);
    expect(result.remainingRequests).toBe(5);
    expect(result.resetAtMs).toBe(FIXED_NOW_MS + 15 * 60 * 1000);
  });

  it('should not increment the counter (peek is read-only)', async () => {
    const provider = createInMemoryProvider();
    await provider.checkAndRecord('LOGIN', '1.2.3.4');

    const first = await provider.peek('LOGIN', '1.2.3.4');
    const second = await provider.peek('LOGIN', '1.2.3.4');
    const afterCheck = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(first.remainingRequests).toBe(4);
    expect(second.remainingRequests).toBe(4);
    expect(afterCheck.remainingRequests).toBe(3);
  });

  it('should return allowed=false with retryAfterMs when quota is reached', async () => {
    const provider = createInMemoryProvider();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }

    const peek = await provider.peek('LOGIN', '1.2.3.4');

    expect(peek.allowed).toBe(false);
    expect(peek.remainingRequests).toBe(0);
    expect(peek.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('[inMemoryProvider.reset]', () => {
  it('should clear the counter for the given key', async () => {
    const provider = createInMemoryProvider();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 5; i += 1) {
      await provider.checkAndRecord('LOGIN', '1.2.3.4');
    }

    await provider.reset('LOGIN', '1.2.3.4');
    const afterReset = await provider.checkAndRecord('LOGIN', '1.2.3.4');

    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remainingRequests).toBe(4);
  });

  it('should not affect other identifiers', async () => {
    const provider = createInMemoryProvider();
    await provider.checkAndRecord('LOGIN', '1.2.3.4');
    await provider.checkAndRecord('LOGIN', '5.6.7.8');

    await provider.reset('LOGIN', '1.2.3.4');
    const other = await provider.peek('LOGIN', '5.6.7.8');

    expect(other.remainingRequests).toBe(4);
  });
});
