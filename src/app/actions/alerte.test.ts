import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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

vi.mock('@/lib/services/alerte.service', () => ({
  resolveAlerte: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolveAlerte } from '@/lib/services/alerte.service';
import { resolveAlerteAction } from './alerte';
import { INITIAL_ALERTE_RESOLVE_STATE } from './alerte.types';

const RESPONSABLE_ID = 'resp-1';
const ALERTE_ID = '11111111-1111-4111-8111-111111111111';
const VALID_COMMENT = 'Porte refermee, suivi 1h, conforme.';

function responsableSession() {
  return {
    user: {
      id: RESPONSABLE_ID,
      email: 'resp@maison-givre.fr',
      role: 'RESPONSABLE',
      name: 'Resp Lyon',
    },
  } as never;
}

function salarieSession() {
  return {
    user: {
      id: 'sal-1',
      email: 'lea@maison-givre.fr',
      role: 'SALARIE',
      name: 'Lea',
    },
  } as never;
}

function makeFormData(values: Record<string, string | undefined>): FormData {
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
    remainingRequests: 29,
    resetAtMs: Date.now() + 60_000,
  };
}

function rateBlocked() {
  return {
    allowed: false,
    remainingRequests: 0,
    resetAtMs: Date.now() + 60_000,
    retryAfterMs: 30_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(rateOk());
});

describe('[resolveAlerteAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      resolveAlerteAction(
        INITIAL_ALERTE_RESOLVE_STATE,
        makeFormData({
          alerteId: ALERTE_ID,
          commentaireResolution: VALID_COMMENT,
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(resolveAlerte).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: ALERTE_ID,
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(resolveAlerte).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED when the limiter blocks the request', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    checkRateLimit.mockResolvedValue(rateBlocked());

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: ALERTE_ID,
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('RATE_LIMITED');
      expect(result.retryAfterSeconds).toBe(30);
    }
    expect(checkRateLimit).toHaveBeenCalledWith(
      'ALERTE_RESOLVE',
      `user:${RESPONSABLE_ID}`
    );
    expect(resolveAlerte).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when alerteId is missing or not a UUID', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: 'not-uuid',
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.alerteId).toBeDefined();
    }
    expect(resolveAlerte).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when commentaireResolution is too short', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({ alerteId: ALERTE_ID, commentaireResolution: 'ok' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.commentaireResolution).toBeDefined();
    }
    expect(resolveAlerte).not.toHaveBeenCalled();
  });

  it('should map a NOT_FOUND service error to a NOT_FOUND action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(resolveAlerte).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: ALERTE_ID,
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'NOT_FOUND' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should map a ALREADY_RESOLVED service error to a ALREADY_RESOLVED action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(resolveAlerte).mockResolvedValue({
      success: false,
      error: 'ALREADY_RESOLVED',
    });

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: ALERTE_ID,
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'ALREADY_RESOLVED' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should map a FORBIDDEN service error to a FORBIDDEN action code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(resolveAlerte).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    const result = await resolveAlerteAction(
      INITIAL_ALERTE_RESOLVE_STATE,
      makeFormData({
        alerteId: ALERTE_ID,
        commentaireResolution: VALID_COMMENT,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
  });

  it('should call the service, revalidate /alertes and redirect on success', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(resolveAlerte).mockResolvedValue({
      success: true,
      data: { id: ALERTE_ID },
    });

    await expect(
      resolveAlerteAction(
        INITIAL_ALERTE_RESOLVE_STATE,
        makeFormData({
          alerteId: ALERTE_ID,
          commentaireResolution: VALID_COMMENT,
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(resolveAlerte).toHaveBeenCalledWith({
      viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
      alerteId: ALERTE_ID,
      commentaireResolution: VALID_COMMENT,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/alertes');
    expect(redirect).toHaveBeenCalledWith('/alertes');
  });
});
