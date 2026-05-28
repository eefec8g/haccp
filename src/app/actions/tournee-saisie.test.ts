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
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '9.9.9.9' })),
}));

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  toRetryAfterSeconds: (retryAfterMs: number | undefined): number =>
    retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 0,
}));

vi.mock('@/lib/services/releve.service', () => ({
  createReleve: vi.fn(),
}));

vi.mock('@/lib/utils/dispatch-alerte-email', () => ({
  dispatchAlerteEmail: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createReleve } from '@/lib/services/releve.service';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import { tourneeSaisieAction } from './tournee-saisie';
import { INITIAL_TOURNEE_SAISIE_STATE } from './tournee-saisie.types';

const SALARIE_ID = '11111111-1111-4111-8111-111111111111';
const EQUIPEMENT_ID = '22222222-2222-4222-8222-222222222222';
const ALERTE_ID = '33333333-3333-4333-8333-333333333333';
const RELEVE_ID = '44444444-4444-4444-8444-444444444444';

function salarieSession() {
  return {
    user: {
      id: SALARIE_ID,
      email: 'lea@maison-givre.fr',
      role: 'SALARIE',
      name: 'Lea',
      boutiqueIds: ['b1'],
    },
  } as never;
}

function makeFormData(values: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      fd.set(key, value);
    }
  }
  return fd;
}

function validFormData(
  overrides: Partial<Record<string, string>> = {}
): FormData {
  return makeFormData({
    equipementId: EQUIPEMENT_ID,
    creneau: 'MATIN',
    temperature: '-20',
    ...overrides,
  });
}

function rateOk() {
  return {
    allowed: true,
    remainingRequests: 59,
    resetAtMs: Date.now() + 300_000,
  };
}

function rateBlocked() {
  return {
    allowed: false,
    remainingRequests: 0,
    resetAtMs: Date.now() + 30_000,
    retryAfterMs: 30_000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(salarieSession());
  checkRateLimit.mockResolvedValue(rateOk());
});

const CREATED_AT = new Date('2026-05-27T06:42:00.000Z');

describe('[tourneeSaisieAction]', () => {
  it('should return success without redirect on valid input (no alerte)', async () => {
    vi.mocked(createReleve).mockResolvedValue({
      success: true,
      data: {
        releveId: RELEVE_ID,
        alerteCreated: false,
        alerteId: null,
        createdAt: CREATED_AT,
      },
    });

    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      validFormData()
    );

    expect(state).toEqual({
      status: 'success',
      equipementId: EQUIPEMENT_ID,
      releve: {
        id: RELEVE_ID,
        temperature: -20,
        alerteHorsSeuils: false,
        saisiAt: CREATED_AT.toISOString(),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/releves');
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should dispatch alerte email when alerteCreated is true', async () => {
    vi.mocked(createReleve).mockResolvedValue({
      success: true,
      data: {
        releveId: RELEVE_ID,
        alerteCreated: true,
        alerteId: ALERTE_ID,
        createdAt: CREATED_AT,
      },
    });

    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      validFormData({ temperature: '-5', commentaire: 'porte ouverte 5min' })
    );

    expect(state.status).toBe('success');
    expect(dispatchAlerteEmail).toHaveBeenCalledWith(ALERTE_ID);
  });

  it('should return RATE_LIMITED error when the rate limiter rejects', async () => {
    checkRateLimit.mockResolvedValueOnce(rateBlocked());

    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      validFormData()
    );

    expect(state).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    });
    expect(createReleve).not.toHaveBeenCalled();
  });

  it('should return VALIDATION error when temperature is missing', async () => {
    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      makeFormData({
        equipementId: EQUIPEMENT_ID,
        creneau: 'MATIN',
      })
    );

    expect(state.status).toBe('error');
    if (state.status !== 'error') {
      return;
    }
    expect(state.code).toBe('VALIDATION');
  });

  it('should map service error EQUIPEMENT_NOT_FOUND to action error code', async () => {
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'EQUIPEMENT_NOT_FOUND',
    });

    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      validFormData()
    );

    expect(state).toEqual({
      status: 'error',
      code: 'EQUIPEMENT_NOT_FOUND',
    });
  });

  it('should map service error COMMENTAIRE_REQUIRED to action error code', async () => {
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'COMMENTAIRE_REQUIRED',
    });

    const state = await tourneeSaisieAction(
      INITIAL_TOURNEE_SAISIE_STATE,
      validFormData({ temperature: '-5' })
    );

    expect(state).toEqual({
      status: 'error',
      code: 'COMMENTAIRE_REQUIRED',
    });
  });
});
