import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPostLoginRoute } from './authRedirect';

const originalFetch = globalThis.fetch;

function mockFetchOnce(response: Partial<Response>): void {
  globalThis.fetch = vi.fn().mockResolvedValue(response as Response);
}

function mockFetchReject(error: Error): void {
  globalThis.fetch = vi.fn().mockRejectedValue(error);
}

describe('[utils/authRedirect] fetchPostLoginRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return redirectTo when the API responds 200 with a string payload', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ redirectTo: '/releves' }),
    });

    await expect(fetchPostLoginRoute()).resolves.toBe('/releves');
  });

  it('should fallback to /login when the response is not ok', async () => {
    mockFetchOnce({ ok: false, json: async () => ({}) });
    await expect(fetchPostLoginRoute()).resolves.toBe('/login');
  });

  it('should fallback to /login when the payload is missing redirectTo', async () => {
    mockFetchOnce({ ok: true, json: async () => ({}) });
    await expect(fetchPostLoginRoute()).resolves.toBe('/login');
  });

  it('should fallback to /login when fetch rejects (network error)', async () => {
    mockFetchReject(new Error('network down'));
    await expect(fetchPostLoginRoute()).resolves.toBe('/login');
  });

  it('should fallback to /login when redirectTo is not a string', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ redirectTo: 42 }),
    });
    await expect(fetchPostLoginRoute()).resolves.toBe('/login');
  });
});
