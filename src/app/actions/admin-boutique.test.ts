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

vi.mock('@/lib/services/boutique.service', () => ({
  createBoutique: vi.fn(),
  updateBoutique: vi.fn(),
  disableBoutique: vi.fn(),
  enableBoutique: vi.fn(),
  getBoutiqueById: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createBoutique,
  disableBoutique,
  enableBoutique,
  getBoutiqueById,
  updateBoutique,
} from '@/lib/services/boutique.service';
import {
  createBoutiqueAction,
  disableBoutiqueAction,
  enableBoutiqueAction,
  updateBoutiqueAction,
} from './admin-boutique';
import { INITIAL_BOUTIQUE_ACTION_STATE } from './admin-boutique.types';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const DATE_OUVERTURE_ISO = '2026-01-01';
const DATE_OUVERTURE = new Date(`${DATE_OUVERTURE_ISO}T00:00:00.000Z`);

function adminSession() {
  return {
    user: { id: 'admin-1', email: 'admin@maison-givre.fr', role: 'ADMIN' },
  } as never;
}

function salarieSession() {
  return {
    user: { id: 'sal-1', email: 'lea@maison-givre.fr', role: 'SALARIE' },
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[createBoutiqueAction]', () => {
  it('should return FORBIDDEN when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await createBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ nom: 'MG Paris' })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(createBoutique).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await createBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ nom: 'MG Paris' })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(createBoutique).not.toHaveBeenCalled();
  });

  it('should return VALIDATION with fieldErrors when nom is too short', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ nom: 'M' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.nom).toBeDefined();
    }
    expect(createBoutique).not.toHaveBeenCalled();
  });

  it('should return DUPLICATE when the service detects a name collision', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(createBoutique).mockResolvedValue({
      success: false,
      error: 'DUPLICATE',
    });

    const result = await createBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({
        nom: 'MG Paris 11',
        ville: 'Paris',
        dateOuverture: DATE_OUVERTURE_ISO,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'DUPLICATE' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should call the service, revalidate the path and redirect on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(createBoutique).mockResolvedValue({
      success: true,
      data: {
        id: VALID_UUID,
        nom: 'MG Paris 11',
        adresse: null,
        ville: 'Paris',
        actif: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    });

    await expect(
      createBoutiqueAction(
        INITIAL_BOUTIQUE_ACTION_STATE,
        makeFormData({
          nom: 'MG Paris 11',
          ville: 'Paris',
          dateOuverture: DATE_OUVERTURE_ISO,
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(createBoutique).toHaveBeenCalledWith(
      {
        nom: 'MG Paris 11',
        adresse: undefined,
        ville: 'Paris',
        dateOuverture: DATE_OUVERTURE,
      },
      'admin-1'
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/boutiques');
    expect(redirect).toHaveBeenCalledWith('/admin/boutiques');
  });
});

describe('[updateBoutiqueAction]', () => {
  it('should return FORBIDDEN when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await updateBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ id: VALID_UUID, nom: 'MG Paris' })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(updateBoutique).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when id is missing', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await updateBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ nom: 'MG Paris 11' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.id).toBeDefined();
    }
  });

  it('should return NOT_FOUND when the boutique does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(getBoutiqueById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    const result = await updateBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ id: VALID_UUID, nom: 'MG Paris 11' })
    );

    expect(result).toEqual({ status: 'error', code: 'NOT_FOUND' });
    expect(updateBoutique).not.toHaveBeenCalled();
  });

  it('should update the boutique and revalidate both paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(getBoutiqueById).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID } as never,
    });
    vi.mocked(updateBoutique).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID } as never,
    });

    const result = await updateBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ id: VALID_UUID, nom: 'MG Paris 12', ville: 'Paris' })
    );

    expect(result).toEqual({ status: 'success' });
    expect(updateBoutique).toHaveBeenCalledWith(VALID_UUID, {
      nom: 'MG Paris 12',
      adresse: undefined,
      ville: 'Paris',
      dateOuverture: undefined,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/boutiques');
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/boutiques/${VALID_UUID}`
    );
  });

  it('should map a DUPLICATE service error to a DUPLICATE action code', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(getBoutiqueById).mockResolvedValue({
      success: true,
      data: { id: VALID_UUID } as never,
    });
    vi.mocked(updateBoutique).mockResolvedValue({
      success: false,
      error: 'DUPLICATE',
    });

    const result = await updateBoutiqueAction(
      INITIAL_BOUTIQUE_ACTION_STATE,
      makeFormData({ id: VALID_UUID, nom: 'MG Paris 12', ville: 'Paris' })
    );

    expect(result).toEqual({ status: 'error', code: 'DUPLICATE' });
  });
});

describe('[disableBoutiqueAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(disableBoutiqueAction(VALID_UUID)).rejects.toBeDefined();
    expect(disableBoutique).not.toHaveBeenCalled();
  });

  it('should throw when the boutique does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableBoutique).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(disableBoutiqueAction(VALID_UUID)).rejects.toThrow(
      /introuvable/i
    );
  });

  it('should disable the boutique and revalidate both paths', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableBoutique).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await disableBoutiqueAction(VALID_UUID, '  Fermeture site  ');

    expect(disableBoutique).toHaveBeenCalledWith({
      id: VALID_UUID,
      performedById: 'admin-1',
      motif: 'Fermeture site',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/boutiques');
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/boutiques/${VALID_UUID}`
    );
  });

  it('should pass motif=undefined when omitted', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableBoutique).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await disableBoutiqueAction(VALID_UUID);

    expect(disableBoutique).toHaveBeenCalledWith({
      id: VALID_UUID,
      performedById: 'admin-1',
      motif: undefined,
    });
  });
});

describe('[enableBoutiqueAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(enableBoutiqueAction(VALID_UUID)).rejects.toBeDefined();
    expect(enableBoutique).not.toHaveBeenCalled();
  });

  it('should enable the boutique and revalidate paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableBoutique).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await enableBoutiqueAction(VALID_UUID);

    expect(enableBoutique).toHaveBeenCalledWith({
      id: VALID_UUID,
      performedById: 'admin-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/boutiques');
  });

  it('should throw when the boutique is not found', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableBoutique).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(enableBoutiqueAction(VALID_UUID)).rejects.toThrow(
      /introuvable/i
    );
  });
});
