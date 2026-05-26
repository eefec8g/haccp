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

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '1.2.3.4' })),
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

vi.mock('@/lib/services/releve.service', () => ({
  annulerReleve: vi.fn(),
}));

vi.mock('@/lib/utils/dispatch-alerte-email', () => ({
  dispatchAlerteEmail: vi.fn(),
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
import { annulerReleve } from '@/lib/services/releve.service';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import { annulerReleveAction } from './releve-correction';
import { INITIAL_RELEVE_CORRECTION_STATE } from './releve-correction.types';

const RESPONSABLE_ID = 'resp-1';
const ADMIN_ID = 'admin-1';
const RELEVE_ID = '11111111-1111-4111-8111-111111111111';
const VALID_MOTIF = 'Erreur de saisie, vraie valeur -22 degC';

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

function adminSession() {
  return {
    user: {
      id: ADMIN_ID,
      email: 'admin@maison-givre.fr',
      role: 'ADMIN',
      name: 'Admin Ref',
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
    remainingRequests: 9,
    resetAtMs: Date.now() + 3_600_000,
  };
}

function rateBlocked() {
  return {
    allowed: false,
    remainingRequests: 0,
    resetAtMs: Date.now() + 42_000,
    retryAfterMs: 42_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(rateOk());
});

describe('[annulerReleveAction]', () => {
  it('should redirect /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      annulerReleveAction(
        INITIAL_RELEVE_CORRECTION_STATE,
        makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(annulerReleve).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(annulerReleve).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED with retryAfterSeconds when limiter blocks', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    checkRateLimit.mockResolvedValue(rateBlocked());

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'RELEVE_ANNULATION',
      `user:${RESPONSABLE_ID}`
    );
    expect(annulerReleve).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when motif is too short', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: 'court' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.motif).toBeDefined();
    }
    expect(annulerReleve).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when replacementTemperature is not a number', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({
        releveId: RELEVE_ID,
        motif: VALID_MOTIF,
        replacementTemperature: 'not-a-number',
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.replacementTemperature).toBeDefined();
    }
    expect(annulerReleve).not.toHaveBeenCalled();
  });

  it('should map service NOT_FOUND to NOT_FOUND code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({ status: 'error', code: 'NOT_FOUND' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should map service FORBIDDEN to FORBIDDEN code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
  });

  it('should map service ALREADY_CANCELLED to ALREADY_CANCELLED code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: false,
      error: 'ALREADY_CANCELLED',
    });

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({ status: 'error', code: 'ALREADY_CANCELLED' });
  });

  it('should map other service errors to INTERNAL code', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: false,
      error: 'INTERNAL_ERROR',
    });

    const result = await annulerReleveAction(
      INITIAL_RELEVE_CORRECTION_STATE,
      makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
    );

    expect(result).toEqual({ status: 'error', code: 'INTERNAL' });
  });

  it('should revalidate paths and redirect on success without replacement', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: 'ann-1',
        replacementReleveId: null,
        replacementAlerteId: null,
      },
    });

    await expect(
      annulerReleveAction(
        INITIAL_RELEVE_CORRECTION_STATE,
        makeFormData({ releveId: RELEVE_ID, motif: VALID_MOTIF })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(annulerReleve).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: expect.objectContaining({
          releveId: RELEVE_ID,
          motif: VALID_MOTIF,
        }),
        ip: '1.2.3.4',
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/releves');
    expect(revalidatePath).toHaveBeenCalledWith('/releves/historique');
    expect(redirect).toHaveBeenCalledWith('/releves/historique');
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should forward replacement to the service when fields are provided', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: 'ann-1',
        replacementReleveId: 'rep-1',
        replacementAlerteId: null,
      },
    });

    await expect(
      annulerReleveAction(
        INITIAL_RELEVE_CORRECTION_STATE,
        makeFormData({
          releveId: RELEVE_ID,
          motif: VALID_MOTIF,
          replacementTemperature: '-22.5',
          replacementCommentaire: 'Capteur recalibre',
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(annulerReleve).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { id: ADMIN_ID, role: 'ADMIN' },
        input: expect.objectContaining({
          releveId: RELEVE_ID,
          motif: VALID_MOTIF,
          replacement: {
            temperature: -22.5,
            commentaire: 'Capteur recalibre',
          },
        }),
      })
    );
    // Replacement dans les seuils (replacementAlerteId null) : pas de dispatch.
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should dispatch alerte email when replacement is hors seuils (M-1)', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: 'ann-1',
        replacementReleveId: 'rep-1',
        replacementAlerteId: 'alerte-replacement',
      },
    });

    await expect(
      annulerReleveAction(
        INITIAL_RELEVE_CORRECTION_STATE,
        makeFormData({
          releveId: RELEVE_ID,
          motif: VALID_MOTIF,
          replacementTemperature: '-10',
          replacementCommentaire: 'Vraie valeur hors seuils documentee',
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(dispatchAlerteEmail).toHaveBeenCalledWith('alerte-replacement');
    expect(dispatchAlerteEmail).toHaveBeenCalledTimes(1);
  });

  it('should NOT dispatch alerte email when there is no replacementAlerteId', async () => {
    vi.mocked(auth).mockResolvedValue(responsableSession());
    vi.mocked(annulerReleve).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: 'ann-1',
        replacementReleveId: 'rep-1',
        replacementAlerteId: null,
      },
    });

    await expect(
      annulerReleveAction(
        INITIAL_RELEVE_CORRECTION_STATE,
        makeFormData({
          releveId: RELEVE_ID,
          motif: VALID_MOTIF,
          replacementTemperature: '-22',
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });
});
