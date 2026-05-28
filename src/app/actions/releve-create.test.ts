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

vi.mock('next/server', () => ({
  after: vi.fn((cb: () => Promise<void> | void) => {
    void Promise.resolve().then(() => cb());
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

vi.mock('@/lib/services/releve.service', () => ({
  createReleve: vi.fn(),
}));

vi.mock('@/lib/utils/dispatch-alerte-email', () => ({
  dispatchAlerteEmail: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createReleve } from '@/lib/services/releve.service';
import { dispatchAlerteEmail } from '@/lib/utils/dispatch-alerte-email';
import { createReleveAction } from './releve-create';
import { INITIAL_RELEVE_CREATE_STATE } from './releve-create.types';

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

function successResult(opts: {
  alerteCreated: boolean;
  alerteId: string | null;
}) {
  return {
    success: true as const,
    data: {
      releveId: RELEVE_ID,
      alerteCreated: opts.alerteCreated,
      alerteId: opts.alerteId,
      createdAt: new Date('2026-05-27T06:42:00.000Z'),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue(rateOk());
});

describe('[createReleveAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      createReleveAction(INITIAL_RELEVE_CREATE_STATE, validFormData())
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(redirect).toHaveBeenCalledWith('/login');
    expect(createReleve).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED with retryAfterSeconds when limiter blocks', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    checkRateLimit.mockResolvedValue(rateBlocked());

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData()
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    });
    expect(checkRateLimit).toHaveBeenCalledWith(
      'RELEVE_CREATE',
      `user:${SALARIE_ID}`
    );
    expect(createReleve).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when temperature is missing', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData({ temperature: '' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.temperature).toBeDefined();
    }
    expect(createReleve).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when creneau is invalid', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData({ creneau: 'NUIT' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.creneau).toBeDefined();
    }
    expect(createReleve).not.toHaveBeenCalled();
  });

  it('should map EQUIPEMENT_NOT_FOUND service error to its action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'EQUIPEMENT_NOT_FOUND',
    });

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'EQUIPEMENT_NOT_FOUND' });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should map BOUTIQUE_FORBIDDEN service error to its action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_FORBIDDEN',
    });

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'BOUTIQUE_FORBIDDEN' });
  });

  it('should map EQUIPEMENT_INACTIVE service error to its action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'EQUIPEMENT_INACTIVE',
    });

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'EQUIPEMENT_INACTIVE' });
  });

  it('should map ALREADY_EXISTS service error to its action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'ALREADY_EXISTS',
    });

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'ALREADY_EXISTS' });
  });

  it('should map COMMENTAIRE_REQUIRED service error to its action code', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue({
      success: false,
      error: 'COMMENTAIRE_REQUIRED',
    });

    const result = await createReleveAction(
      INITIAL_RELEVE_CREATE_STATE,
      validFormData({ temperature: '-10' })
    );

    expect(result).toEqual({ status: 'error', code: 'COMMENTAIRE_REQUIRED' });
  });

  it('should call createReleve with viewer + parsed input + ip, revalidate and redirect on success without alerte', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue(
      successResult({ alerteCreated: false, alerteId: null })
    );

    await expect(
      createReleveAction(INITIAL_RELEVE_CREATE_STATE, validFormData())
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(createReleve).toHaveBeenCalledWith({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      input: {
        equipementId: EQUIPEMENT_ID,
        creneau: 'MATIN',
        temperature: -20,
        commentaire: undefined,
        ip: '9.9.9.9',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });

  it('should dispatch alerte email when alerteCreated and alerteId present', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue(
      successResult({ alerteCreated: true, alerteId: ALERTE_ID })
    );

    await expect(
      createReleveAction(
        INITIAL_RELEVE_CREATE_STATE,
        validFormData({ temperature: '-10', commentaire: 'Porte ouverte' })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(dispatchAlerteEmail).toHaveBeenCalledWith(ALERTE_ID);
    expect(dispatchAlerteEmail).toHaveBeenCalledTimes(1);
  });

  it('should NOT dispatch alerte email when alerteCreated is false', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());
    vi.mocked(createReleve).mockResolvedValue(
      successResult({ alerteCreated: false, alerteId: null })
    );

    await expect(
      createReleveAction(INITIAL_RELEVE_CREATE_STATE, validFormData())
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    await Promise.resolve();

    expect(dispatchAlerteEmail).not.toHaveBeenCalled();
  });
});
