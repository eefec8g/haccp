import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

// `after()` defere l'execution post-response. En test, on l'execute
// immediatement pour pouvoir assert sur sendPasswordResetEmail.
vi.mock('next/server', () => ({
  after: vi.fn((cb: () => unknown | Promise<unknown>) => {
    void Promise.resolve(cb());
  }),
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

vi.mock('@/lib/services/auth.service', () => ({
  generatePasswordResetToken: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('@/lib/services/email.service', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import { headers } from 'next/headers';
import {
  generatePasswordResetToken,
  resetPassword,
} from '@/lib/services/auth.service';
import { sendPasswordResetEmail } from '@/lib/services/email.service';
import {
  forgotPasswordAction,
  resetPasswordAction,
  INITIAL_FORGOT_PASSWORD_STATE,
  INITIAL_RESET_PASSWORD_STATE,
} from './password-reset';

const TEST_EMAIL = 'lea@maison-givre.fr';
const VALID_TOKEN = 'a'.repeat(43);
const STRONG_PASSWORD = 'BrandNewPass1!aZ';
const ORIGINAL_APP_BASE_URL = process.env.APP_BASE_URL;

function makeHeaders(map: Record<string, string> = {}) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  };
}

function makeForgotFormData(email: string | null): FormData {
  const fd = new FormData();
  if (email !== null) {
    fd.set('email', email);
  }
  return fd;
}

function makeResetFormData(
  token: string | null,
  password: string | null,
  confirmPassword: string | null
): FormData {
  const fd = new FormData();
  if (token !== null) {
    fd.set('token', token);
  }
  if (password !== null) {
    fd.set('password', password);
  }
  if (confirmPassword !== null) {
    fd.set('confirmPassword', confirmPassword);
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
    remainingRequests: 2,
    resetAtMs: Date.now() + 3_600_000,
  });
  process.env.APP_BASE_URL = 'http://localhost:3000';
});

describe('[forgotPasswordAction]', () => {
  it('should return RATE_LIMITED with retryAfter when limiter blocks the request', async () => {
    checkRateLimit.mockResolvedValue({
      allowed: false,
      remainingRequests: 0,
      resetAtMs: Date.now() + 1_800_000,
      retryAfterMs: 1_800_000,
    });

    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData(TEST_EMAIL)
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 1800,
    });
    expect(generatePasswordResetToken).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when email is missing', async () => {
    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData(null)
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
    expect(generatePasswordResetToken).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when email format is invalid', async () => {
    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData('not-an-email')
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
  });

  it('should return success for unknown user without sending email (anti-enum)', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      data: { plainToken: null, expiresAt: null },
    });

    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData('ghost@example.com')
    );

    expect(result).toEqual({ status: 'success' });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should call sendPasswordResetEmail with the correct reset URL when user exists', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      data: { plainToken: VALID_TOKEN, expiresAt },
    });
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });

    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData(TEST_EMAIL)
    );

    expect(result).toEqual({ status: 'success' });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      resetUrl: `http://localhost:3000/reset-password/${VALID_TOKEN}`,
      expiresAt,
    });
  });

  it('should still return success when Resend fails (anti-enum / best-effort)', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      data: {
        plainToken: VALID_TOKEN,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      success: false,
      error: 'Resend down',
    });
    const noop = (): void => undefined;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    const result = await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData(TEST_EMAIL)
    );

    expect(result).toEqual({ status: 'success' });
    // Microtask flush pour que la callback `after()` execute le console.error.
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(
      '[forgot-password] email send failed',
      expect.objectContaining({ email: TEST_EMAIL, error: 'Resend down' })
    );
    errorSpy.mockRestore();
  });

  it('should use APP_BASE_URL env var to build the reset URL', async () => {
    process.env.APP_BASE_URL = 'https://haccp.maison-givre.fr';
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      data: { plainToken: VALID_TOKEN, expiresAt },
    });
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true });

    await forgotPasswordAction(
      INITIAL_FORGOT_PASSWORD_STATE,
      makeForgotFormData(TEST_EMAIL)
    );

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        resetUrl: `https://haccp.maison-givre.fr/reset-password/${VALID_TOKEN}`,
      })
    );
    process.env.APP_BASE_URL = ORIGINAL_APP_BASE_URL;
  });
});

describe('[resetPasswordAction]', () => {
  it('should return INVALID_OR_EXPIRED when token is too short (Zod token rule)', async () => {
    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData('short', STRONG_PASSWORD, STRONG_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID_OR_EXPIRED' });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when password does not match the strength regex', async () => {
    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, 'weak', 'weak')
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when confirmPassword differs from password', async () => {
    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, STRONG_PASSWORD, 'Different1!aZxx')
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('should return INVALID_OR_EXPIRED when service reports EXPIRED_TOKEN', async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      success: false,
      error: 'EXPIRED_TOKEN',
    });

    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, STRONG_PASSWORD, STRONG_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID_OR_EXPIRED' });
  });

  it('should return INVALID_OR_EXPIRED when service reports TOKEN_ALREADY_USED', async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      success: false,
      error: 'TOKEN_ALREADY_USED',
    });

    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, STRONG_PASSWORD, STRONG_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID_OR_EXPIRED' });
  });

  it('should return INTERNAL when service reports INTERNAL_ERROR', async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      success: false,
      error: 'INTERNAL_ERROR',
    });

    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, STRONG_PASSWORD, STRONG_PASSWORD)
    );

    expect(result).toEqual({ status: 'error', code: 'INTERNAL' });
  });

  it('should return success with redirectTo on happy path', async () => {
    vi.mocked(resetPassword).mockResolvedValue({
      success: true,
      data: { userId: 'u1' },
    });

    const result = await resetPasswordAction(
      INITIAL_RESET_PASSWORD_STATE,
      makeResetFormData(VALID_TOKEN, STRONG_PASSWORD, STRONG_PASSWORD)
    );

    expect(result).toEqual({
      status: 'success',
      redirectTo: '/login?reset=success',
    });
    expect(resetPassword).toHaveBeenCalledWith(VALID_TOKEN, STRONG_PASSWORD);
  });
});
