import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(
    async () =>
      new Headers({
        'x-forwarded-for': '1.2.3.4',
        'user-agent': 'TestAgent/1.0',
      })
  ),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  toRetryAfterSeconds: (retryAfterMs: number | undefined): number =>
    retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0,
}));

vi.mock('@/lib/services/signature.service', () => ({
  uploadSignatureToRegistre: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { getClientIp } = vi.hoisted(() => ({
  getClientIp: vi.fn((_h: Headers) => '1.2.3.4'),
}));
vi.mock('@/lib/utils/request', () => ({ getClientIp }));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { uploadSignatureToRegistre } from '@/lib/services/signature.service';
import { signatureUploadAction } from './signature';
import { INITIAL_SIGNATURE_UPLOAD_STATE } from './signature.types';

const SALARIE_ID = 'sal-1';
const RESPONSABLE_ID = 'resp-1';
const ADMIN_ID = 'adm-1';
const BOUTIQUE_ID = '11111111-1111-4111-8111-111111111111';
const DATE_ISO = '2026-05-27';
const SIGNATURE_ID = '22222222-2222-4222-8222-222222222222';
const BLOB_URL = 'https://blob/signature.png';

function salarieSession() {
  return {
    user: {
      id: SALARIE_ID,
      email: 'lea@maison-givre.fr',
      role: 'SALARIE',
      name: 'Lea',
    },
  } as never;
}

function responsableSession() {
  return {
    user: {
      id: RESPONSABLE_ID,
      email: 'resp@maison-givre.fr',
      role: 'RESPONSABLE',
      name: 'Resp',
    },
  } as never;
}

function adminSession() {
  return {
    user: {
      id: ADMIN_ID,
      email: 'adm@maison-givre.fr',
      role: 'ADMIN',
      name: 'Adm',
    },
  } as never;
}

function makeFile(size = 50_000, type = 'image/png', name = 'sig.png'): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

function makeFormData(values: Record<string, string | File | undefined>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }
    fd.set(key, value);
  }
  return fd;
}

function rateOk() {
  return {
    allowed: true,
    remainingRequests: 9,
    resetAtMs: Date.now() + 60_000,
  };
}

function rateBlocked() {
  return {
    allowed: false,
    remainingRequests: 0,
    resetAtMs: Date.now() + 60_000,
    retryAfterMs: 60_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(rateOk());
  getClientIp.mockImplementation((_h: Headers) => '1.2.3.4');
});

describe('[signatureUploadAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      signatureUploadAction(
        INITIAL_SIGNATURE_UPLOAD_STATE,
        makeFormData({
          boutiqueId: BOUTIQUE_ID,
          dateISO: DATE_ISO,
          file: makeFile(),
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(uploadSignatureToRegistre).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when viewer is ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(uploadSignatureToRegistre).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED when limiter blocks the request', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    checkRateLimit.mockResolvedValue(rateBlocked());

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.retryAfterSeconds).toBe(60);
    }
    expect(checkRateLimit).toHaveBeenCalledWith(
      'SIGNATURE_UPLOAD',
      `user:${SALARIE_ID}`
    );
  });

  it('should return VALIDATION when boutiqueId is not a UUID', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: 'not-uuid',
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.boutiqueId).toBeDefined();
    }
  });

  it('should return VALIDATION when dateISO is malformed', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: '27/05/2026',
        file: makeFile(),
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.dateISO).toBeDefined();
    }
  });

  it('should return INVALID_FILE when no file is provided', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({ boutiqueId: BOUTIQUE_ID, dateISO: DATE_ISO })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('INVALID_FILE');
    }
  });

  it('should map TOO_LARGE service error to TOO_LARGE action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'TOO_LARGE',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'TOO_LARGE' });
  });

  it('should map BOUTIQUE_NOT_FOUND service error to BOUTIQUE_NOT_FOUND', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should map SIGNATURE_ALREADY_EXISTS service error', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'SIGNATURE_ALREADY_EXISTS',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({
      status: 'error',
      code: 'SIGNATURE_ALREADY_EXISTS',
    });
  });

  it('should map MAGIC_BYTES_FAIL service error', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'MAGIC_BYTES_FAIL',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'MAGIC_BYTES_FAIL' });
  });

  it('should map STORAGE_FAILURE service error', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'STORAGE_FAILURE',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'STORAGE_FAILURE' });
  });

  it('should map SIGNATURE_NOT_FOUND service error to INTERNAL (defensive)', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: false,
      error: 'SIGNATURE_NOT_FOUND',
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(result).toEqual({ status: 'error', code: 'INTERNAL' });
  });

  it('should forward ipAddress: null when getClientIp returns "unknown" (audit DDPP : pas de faux positif)', async () => {
    getClientIp.mockReturnValueOnce('unknown');
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: true,
      data: {
        id: SIGNATURE_ID,
        imageUrl: BLOB_URL,
        signedAt: new Date('2026-05-27T10:00:00Z'),
      },
    });

    await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    const call = vi.mocked(uploadSignatureToRegistre).mock.calls[0]?.[0];
    expect(call?.metadata.ipAddress).toBeNull();
  });

  it('should truncate a long user-agent to MAX_USER_AGENT_LENGTH (500) when forwarding metadata', async () => {
    const longUa = 'A'.repeat(1500);
    const { headers: headersFn } = await import('next/headers');
    vi.mocked(headersFn).mockResolvedValueOnce(
      new Headers({ 'x-forwarded-for': '1.2.3.4', 'user-agent': longUa })
    );
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: true,
      data: {
        id: SIGNATURE_ID,
        imageUrl: BLOB_URL,
        signedAt: new Date('2026-05-27T10:00:00Z'),
      },
    });

    await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    const call = vi.mocked(uploadSignatureToRegistre).mock.calls[0]?.[0];
    expect(call?.metadata.userAgent).toHaveLength(500);
    expect(call?.metadata.userAgent).toBe('A'.repeat(500));
  });

  it('should call the service with extracted metadata, revalidate and return success on happy path', async () => {
    const signedAt = new Date('2026-05-27T10:00:00Z');
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(uploadSignatureToRegistre).mockResolvedValue({
      success: true,
      data: { id: SIGNATURE_ID, imageUrl: BLOB_URL, signedAt },
    });

    const result = await signatureUploadAction(
      INITIAL_SIGNATURE_UPLOAD_STATE,
      makeFormData({
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        file: makeFile(),
      })
    );

    expect(uploadSignatureToRegistre).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        boutiqueId: BOUTIQUE_ID,
        dateISO: DATE_ISO,
        metadata: expect.objectContaining({
          ipAddress: '1.2.3.4',
          userAgent: 'TestAgent/1.0',
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith(
      `/boutiques/${BOUTIQUE_ID}/registre/${DATE_ISO}`
    );
    expect(result).toEqual({
      status: 'success',
      signatureId: SIGNATURE_ID,
      imageUrl: BLOB_URL,
      signedAt: signedAt.toISOString(),
    });
  });
});
