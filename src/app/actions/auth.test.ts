import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  peekRateLimit: vi.fn(),
  resetRateLimit: vi.fn(),
  formatRetryAfter: vi.fn(),
  toRetryAfterSeconds: (retryAfterMs: number | undefined): number =>
    retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0,
}));

import { headers } from 'next/headers';
import { auth, signIn } from '@/lib/auth';
import { loginAction, INITIAL_LOGIN_STATE } from './auth';

const TEST_EMAIL = 'lea@maison-givre.fr';
const TEST_PASSWORD = 'Secret123!aaaa';

function makeHeaders(map: Record<string, string> = {}) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  };
}

function makeFormData(email: string | null, password: string | null): FormData {
  const fd = new FormData();
  if (email !== null) {
    fd.set('email', email);
  }
  if (password !== null) {
    fd.set('password', password);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(headers).mockResolvedValue(
    makeHeaders({ 'x-forwarded-for': '1.2.3.4' }) as never
  );
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remainingRequests: 4,
    resetAtMs: Date.now() + 900_000,
  });
});

describe('[loginAction]', () => {
  it('should return RATE_LIMITED error when limiter blocks the request', async () => {
    checkRateLimit.mockResolvedValue({
      allowed: false,
      remainingRequests: 0,
      resetAtMs: Date.now() + 120_000,
      retryAfterMs: 120_000,
    });

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 120,
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('should return INVALID when zod validation fails (missing email)', async () => {
    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(null, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
    expect(signIn).not.toHaveBeenCalled();
  });

  it('should return INVALID when zod validation fails (bad email format)', async () => {
    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData('not-an-email', TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
  });

  it('should return INVALID when signIn throws (wrong credentials)', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('CredentialsSignin'));

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
  });

  it('should redirect SALARIE to /releves on successful login', async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: TEST_EMAIL, role: 'SALARIE', boutiqueIds: [] },
    } as never);

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'success', redirectTo: '/releves' });
  });

  it('should redirect RESPONSABLE to /releves on successful login', async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'u1',
        email: TEST_EMAIL,
        role: 'RESPONSABLE',
        boutiqueIds: ['b1'],
      },
    } as never);

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'success', redirectTo: '/releves' });
  });

  it('should redirect ADMIN to /admin on successful login', async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: TEST_EMAIL, role: 'ADMIN', boutiqueIds: [] },
    } as never);

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'success', redirectTo: '/admin' });
  });

  it('should return INVALID when session is unexpectedly empty after signIn (defensive)', async () => {
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
  });

  it('should re-throw NEXT_REDIRECT errors raised by signIn (let Next.js handle redirect)', async () => {
    const nextRedirect = new Error('NEXT_REDIRECT') as Error & {
      digest: string;
    };
    nextRedirect.digest = 'NEXT_REDIRECT;replace;/elsewhere;307;';
    vi.mocked(signIn).mockRejectedValue(nextRedirect);

    await expect(
      loginAction(INITIAL_LOGIN_STATE, makeFormData(TEST_EMAIL, TEST_PASSWORD))
    ).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/elsewhere;307;',
    });
  });

  it('should use the first IP from x-forwarded-for as the rate-limit key', async () => {
    vi.mocked(headers).mockResolvedValue(
      makeHeaders({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }) as never
    );
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: TEST_EMAIL, role: 'SALARIE', boutiqueIds: [] },
    } as never);

    await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(checkRateLimit).toHaveBeenCalledWith('LOGIN', '9.9.9.9');
  });

  it('should fallback to "unknown" IP when no proxy headers are present', async () => {
    vi.mocked(headers).mockResolvedValue(makeHeaders({}) as never);
    vi.mocked(signIn).mockResolvedValue(undefined as never);
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: TEST_EMAIL, role: 'SALARIE', boutiqueIds: [] },
    } as never);

    await loginAction(
      INITIAL_LOGIN_STATE,
      makeFormData(TEST_EMAIL, TEST_PASSWORD)
    );

    expect(checkRateLimit).toHaveBeenCalledWith('LOGIN', 'unknown');
  });

  it('should count failed attempts against the rate limit (signIn called)', async () => {
    vi.mocked(signIn).mockRejectedValue(new Error('CredentialsSignin'));

    await loginAction(INITIAL_LOGIN_STATE, makeFormData(TEST_EMAIL, 'wrong'));

    // Le rate-limiter est appele AVANT signIn -> la tentative compte.
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });
});
