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
  corrigerPropreReleveDuJour: vi.fn(),
}));

vi.mock('@/lib/utils/dispatch-alerte-email', () => ({
  dispatchAlerteEmail: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { corrigerPropreReleveDuJour } from '@/lib/services/releve.service';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import { tourneeCorrigeAction } from './tournee-correction';
import { INITIAL_TOURNEE_CORRECTION_STATE } from './tournee-correction.types';

const SALARIE_ID = '11111111-1111-4111-8111-111111111111';
const EQUIPEMENT_ID = '22222222-2222-4222-8222-222222222222';
const RELEVE_ID = '33333333-3333-4333-8333-333333333333';
const NEW_RELEVE_ID = '44444444-4444-4444-8444-444444444444';
const ANNUL_ID = '55555555-5555-4555-8555-555555555555';
const ALERTE_ID = '66666666-6666-4666-8666-666666666666';

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
    releveId: RELEVE_ID,
    equipementId: EQUIPEMENT_ID,
    creneau: 'MATIN',
    temperature: '-22',
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

const CREATED_AT = new Date('2026-05-27T06:50:00.000Z');

describe('[tourneeCorrigeAction]', () => {
  it('should return success without redirect on a valid correction (no alerte)', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: ANNUL_ID,
        releveId: NEW_RELEVE_ID,
        alerteCreated: false,
        alerteId: null,
        createdAt: CREATED_AT,
      },
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData()
    );

    expect(state).toEqual({
      status: 'success',
      equipementId: EQUIPEMENT_ID,
      releve: {
        id: NEW_RELEVE_ID,
        temperature: -22,
        alerteHorsSeuils: false,
        saisiAt: CREATED_AT.toISOString(),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/releves');
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should dispatch the alerte email when the corrected value is hors seuils', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: true,
      data: {
        annulationReleveId: ANNUL_ID,
        releveId: NEW_RELEVE_ID,
        alerteCreated: true,
        alerteId: ALERTE_ID,
        createdAt: CREATED_AT,
      },
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData({ temperature: '-5', commentaire: 'porte ouverte 5min' })
    );

    expect(state.status).toBe('success');
    expect(dispatchAlerteEmail).toHaveBeenCalledWith(ALERTE_ID);
  });

  it('should return RATE_LIMITED before touching the service', async () => {
    checkRateLimit.mockResolvedValueOnce(rateBlocked());

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData()
    );

    expect(state).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    });
    expect(corrigerPropreReleveDuJour).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when the releveId is not a uuid', async () => {
    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData({ releveId: 'not-a-uuid' })
    );

    expect(state.status).toBe('error');
    if (state.status !== 'error') {
      return;
    }
    expect(state.code).toBe('VALIDATION');
    expect(corrigerPropreReleveDuJour).not.toHaveBeenCalled();
  });

  it('should map FORBIDDEN service error (not the author) to FORBIDDEN', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData()
    );

    expect(state).toEqual({ status: 'error', code: 'FORBIDDEN' });
  });

  it('should map NOT_TODAY service error to NOT_TODAY', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: false,
      error: 'NOT_TODAY',
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData()
    );

    expect(state).toEqual({ status: 'error', code: 'NOT_TODAY' });
  });

  it('should map TOURNEE_DEJA_SIGNEE service error to TOURNEE_DEJA_SIGNEE', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: false,
      error: 'TOURNEE_DEJA_SIGNEE',
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData()
    );

    expect(state).toEqual({ status: 'error', code: 'TOURNEE_DEJA_SIGNEE' });
  });

  it('should map COMMENTAIRE_REQUIRED service error to COMMENTAIRE_REQUIRED', async () => {
    vi.mocked(corrigerPropreReleveDuJour).mockResolvedValue({
      success: false,
      error: 'COMMENTAIRE_REQUIRED',
    });

    const state = await tourneeCorrigeAction(
      INITIAL_TOURNEE_CORRECTION_STATE,
      validFormData({ temperature: '-5' })
    );

    expect(state).toEqual({ status: 'error', code: 'COMMENTAIRE_REQUIRED' });
  });
});
