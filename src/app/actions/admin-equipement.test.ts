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

vi.mock('@/lib/services/equipement.service', () => ({
  createEquipement: vi.fn(),
  updateEquipement: vi.fn(),
  disableEquipement: vi.fn(),
  enableEquipement: vi.fn(),
  getEquipementById: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createEquipement,
  disableEquipement,
  enableEquipement,
  getEquipementById,
  updateEquipement,
} from '@/lib/services/equipement.service';
import {
  createEquipementAction,
  disableEquipementAction,
  enableEquipementAction,
  INITIAL_EQUIPEMENT_ACTION_STATE,
  updateEquipementAction,
} from './admin-equipement';

const EQUIPEMENT_UUID = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_UUID = '11111111-1111-4111-8111-111111111111';

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

function validCreatePayload(overrides: Record<string, string> = {}) {
  return {
    nom: 'Congelateur 1',
    type: 'CONGELATEUR',
    boutiqueId: BOUTIQUE_UUID,
    seuilMin: '-25',
    seuilMax: '-18',
    ...overrides,
  };
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

describe('[createEquipementAction]', () => {
  it('should return FORBIDDEN when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload())
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(createEquipement).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload())
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(createEquipement).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when seuilMin is missing (decision #4: seuils obligatoires)', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload({ seuilMin: '' }))
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.seuilMin).toBeDefined();
    }
    expect(createEquipement).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when seuilMax is missing', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload({ seuilMax: '' }))
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.seuilMax).toBeDefined();
    }
  });

  it('should return VALIDATION when seuilMin >= seuilMax', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload({ seuilMin: '-10', seuilMax: '-20' }))
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.seuilMax).toBeDefined();
    }
  });

  it('should return VALIDATION when nom is empty', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload({ nom: '' }))
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.nom).toBeDefined();
    }
  });

  it('should return VALIDATION when boutiqueId is not a uuid', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload({ boutiqueId: 'not-a-uuid' }))
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.boutiqueId).toBeDefined();
    }
  });

  it('should map a BOUTIQUE_NOT_FOUND service error to a BOUTIQUE_NOT_FOUND action code', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(createEquipement).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload())
    );

    expect(result).toEqual({ status: 'error', code: 'BOUTIQUE_NOT_FOUND' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('should map a DUPLICATE service error to a DUPLICATE action code', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(createEquipement).mockResolvedValue({
      success: false,
      error: 'DUPLICATE',
    });

    const result = await createEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData(validCreatePayload())
    );

    expect(result).toEqual({ status: 'error', code: 'DUPLICATE' });
  });

  it('should call the service, revalidate the path and redirect on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(createEquipement).mockResolvedValue({
      success: true,
      data: {
        id: EQUIPEMENT_UUID,
        nom: 'Congelateur 1',
        type: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
        actif: true,
        boutiqueId: BOUTIQUE_UUID,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    });

    await expect(
      createEquipementAction(
        INITIAL_EQUIPEMENT_ACTION_STATE,
        makeFormData(validCreatePayload())
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(createEquipement).toHaveBeenCalledWith(
      {
        nom: 'Congelateur 1',
        type: 'CONGELATEUR',
        boutiqueId: BOUTIQUE_UUID,
        seuilMin: -25,
        seuilMax: -18,
      },
      'admin-1'
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/equipements');
    expect(redirect).toHaveBeenCalledWith(
      `/admin/equipements/${EQUIPEMENT_UUID}`
    );
  });
});

describe('[updateEquipementAction]', () => {
  it('should return FORBIDDEN when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await updateEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData({ id: EQUIPEMENT_UUID, nom: 'Congelateur 2' })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(updateEquipement).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when id is missing', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await updateEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData({ nom: 'Congelateur 2' })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.id).toBeDefined();
    }
  });

  it('should return NOT_FOUND when the equipement does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(getEquipementById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    const result = await updateEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData({ id: EQUIPEMENT_UUID, nom: 'Congelateur 2' })
    );

    expect(result).toEqual({ status: 'error', code: 'NOT_FOUND' });
    expect(updateEquipement).not.toHaveBeenCalled();
  });

  it('should update the equipement and revalidate both paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(getEquipementById).mockResolvedValue({
      success: true,
      data: { id: EQUIPEMENT_UUID } as never,
    });
    vi.mocked(updateEquipement).mockResolvedValue({
      success: true,
      data: { id: EQUIPEMENT_UUID } as never,
    });

    const result = await updateEquipementAction(
      INITIAL_EQUIPEMENT_ACTION_STATE,
      makeFormData({
        id: EQUIPEMENT_UUID,
        nom: 'Congelateur 2',
        seuilMin: '-25',
        seuilMax: '-18',
      })
    );

    expect(result).toEqual({ status: 'success' });
    expect(updateEquipement).toHaveBeenCalledWith(EQUIPEMENT_UUID, {
      nom: 'Congelateur 2',
      type: undefined,
      boutiqueId: undefined,
      seuilMin: -25,
      seuilMax: -18,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/equipements');
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/equipements/${EQUIPEMENT_UUID}`
    );
  });
});

describe('[disableEquipementAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(
      disableEquipementAction(EQUIPEMENT_UUID)
    ).rejects.toBeDefined();
    expect(disableEquipement).not.toHaveBeenCalled();
  });

  it('should throw when the equipement does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableEquipement).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(disableEquipementAction(EQUIPEMENT_UUID)).rejects.toThrow(
      /introuvable/i
    );
  });

  it('should disable the equipement and revalidate both paths', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableEquipement).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await disableEquipementAction(EQUIPEMENT_UUID, 'Defaut materiel');

    expect(disableEquipement).toHaveBeenCalledWith({
      id: EQUIPEMENT_UUID,
      performedById: 'admin-1',
      motif: 'Defaut materiel',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/equipements');
    expect(revalidatePath).toHaveBeenCalledWith(
      `/admin/equipements/${EQUIPEMENT_UUID}`
    );
  });
});

describe('[enableEquipementAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(enableEquipementAction(EQUIPEMENT_UUID)).rejects.toBeDefined();
    expect(enableEquipement).not.toHaveBeenCalled();
  });

  it('should enable the equipement and revalidate paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableEquipement).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await enableEquipementAction(EQUIPEMENT_UUID);

    expect(enableEquipement).toHaveBeenCalledWith({
      id: EQUIPEMENT_UUID,
      performedById: 'admin-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/equipements');
  });

  it('should throw when the equipement is not found', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableEquipement).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(enableEquipementAction(EQUIPEMENT_UUID)).rejects.toThrow(
      /introuvable/i
    );
  });
});
