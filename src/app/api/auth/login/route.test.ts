import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { peekRateLimit } = vi.hoisted(() => ({
  peekRateLimit: vi.fn(),
}));

vi.mock('@/lib/services/rateLimit', () => ({
  peekRateLimit,
  formatRetryAfterEnhanced: (ms: number): string =>
    `${Math.ceil(ms / 1000)} secondes`,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from './route';
import { logger } from '@/lib/logger';

const VALID_EMAIL = 'lea@maison-givre.fr';
const VALID_PASSWORD = 'Secret123!aaaa';

interface BuildRequestOptions {
  readonly body?: unknown;
  readonly ip?: string;
  readonly throwOnJson?: boolean;
}

function buildRequest({
  body = { email: VALID_EMAIL, password: VALID_PASSWORD },
  ip = '1.2.3.4',
  throwOnJson = false,
}: BuildRequestOptions = {}): NextRequest {
  return {
    headers: {
      get: (key: string): string | null => {
        if (key.toLowerCase() === 'x-forwarded-for') {
          return ip;
        }
        return null;
      },
    },
    json: throwOnJson
      ? () => Promise.reject(new Error('invalid json'))
      : () => Promise.resolve(body),
  } as unknown as NextRequest;
}

function mockRateLimit(allowed: boolean, retryAfterMs?: number): void {
  peekRateLimit.mockResolvedValue({
    allowed,
    remainingRequests: allowed ? 4 : 0,
    resetAtMs: Date.now() + 900_000,
    retryAfterMs,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit(true);
});

describe('[POST /api/auth/login]', () => {
  it('should return 200 { success: true } when validation passes and rate-limit allows', async () => {
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(peekRateLimit).toHaveBeenCalledTimes(2);
    expect(peekRateLimit).toHaveBeenNthCalledWith(1, 'LOGIN', '1.2.3.4');
    expect(peekRateLimit).toHaveBeenNthCalledWith(
      2,
      'LOGIN',
      `email:${VALID_EMAIL}`
    );
  });

  it('should return 400 / VALIDATION_ERROR when email is invalid', async () => {
    const response = await POST(
      buildRequest({
        body: { email: 'not-an-email', password: VALID_PASSWORD },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(peekRateLimit).not.toHaveBeenCalled();
  });

  it('should return 400 / VALIDATION_ERROR when password is empty', async () => {
    const response = await POST(
      buildRequest({ body: { email: VALID_EMAIL, password: '' } })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VALIDATION_ERROR');
  });

  it('should return 429 with Retry-After header when IP rate-limit blocks', async () => {
    mockRateLimit(false, 30_000);

    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error).toContain('Reessayez dans');
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('should return 429 when only the email rate-limit is blocked', async () => {
    peekRateLimit
      .mockResolvedValueOnce({
        allowed: true,
        remainingRequests: 4,
        resetAtMs: Date.now() + 900_000,
      })
      .mockResolvedValueOnce({
        allowed: false,
        remainingRequests: 0,
        resetAtMs: Date.now() + 60_000,
        retryAfterMs: 60_000,
      });

    const response = await POST(buildRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('should return 500 / INTERNAL_ERROR and log when an exception is thrown', async () => {
    const response = await POST(buildRequest({ throwOnJson: true }));

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('INTERNAL_ERROR');
    expect(logger.error).toHaveBeenCalledWith(
      'Login rate limit check error',
      expect.objectContaining({ error: 'invalid json' })
    );
  });

  it('should normalize the email to lower-case when keying the rate-limit', async () => {
    await POST(
      buildRequest({
        body: { email: 'LEA@Maison-Givre.FR', password: VALID_PASSWORD },
      })
    );
    expect(peekRateLimit).toHaveBeenNthCalledWith(
      2,
      'LOGIN',
      `email:${VALID_EMAIL}`
    );
  });
});
