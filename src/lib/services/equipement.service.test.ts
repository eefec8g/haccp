import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    equipement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    boutique: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  logAudit: vi.fn(),
}));

import { db } from '@/lib/prisma';
import { logAudit } from '@/lib/services/audit-log.service';
import {
  createEquipement,
  disableEquipement,
  enableEquipement,
  getEquipementById,
  listEquipements,
  updateEquipement,
} from './equipement.service';

const EQUIPEMENT_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = 'admin-1';

function arrangeTransaction() {
  const txStub = {
    equipement: db.equipement,
    boutique: db.boutique,
    auditLog: db.auditLog,
  };
  vi.mocked(db.$transaction).mockImplementation(
    async (cb: unknown) =>
      await (cb as (tx: unknown) => Promise<unknown>)(txStub)
  );
}

function makeEquipementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EQUIPEMENT_ID,
    nom: 'CGL-01',
    type: 'CONGELATEUR',
    seuilMin: -25,
    seuilMax: -18,
    actif: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    boutiqueId: BOUTIQUE_ID,
    boutique: { nom: 'MG Paris 11' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[equipement.service]', () => {
  describe('listEquipements', () => {
    it('should filter on actif=true by default', async () => {
      vi.mocked(db.equipement.findMany).mockResolvedValue([
        makeEquipementRow(),
      ] as never);
      vi.mocked(db.equipement.count).mockResolvedValue(1);

      await listEquipements({ query: { page: 1, pageSize: 25 } });

      const args = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
      expect(args?.where).toMatchObject({ actif: true });
    });

    it('should filter by boutiqueId when provided', async () => {
      vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
      vi.mocked(db.equipement.count).mockResolvedValue(0);

      await listEquipements({
        query: { page: 1, pageSize: 25 },
        boutiqueId: BOUTIQUE_ID,
      });

      const args = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
      expect(args?.where).toMatchObject({ boutiqueId: BOUTIQUE_ID });
    });

    it('should project boutiqueNom from the included relation', async () => {
      vi.mocked(db.equipement.findMany).mockResolvedValue([
        makeEquipementRow({ boutique: { nom: 'MG Lyon 3' } }),
      ] as never);
      vi.mocked(db.equipement.count).mockResolvedValue(1);

      const result = await listEquipements({
        query: { page: 1, pageSize: 25 },
      });

      expect(result.items[0]?.boutiqueNom).toBe('MG Lyon 3');
    });
  });

  describe('getEquipementById', () => {
    it('should return NOT_FOUND when equipement does not exist', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(null);

      const result = await getEquipementById('missing');

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should return the equipement when found', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        makeEquipementRow() as never
      );

      const result = await getEquipementById(EQUIPEMENT_ID);

      expect(result.success).toBe(true);
    });
  });

  describe('createEquipement', () => {
    function baseInput(overrides: Record<string, unknown> = {}) {
      return {
        nom: 'CGL-01',
        type: 'CONGELATEUR' as const,
        boutiqueId: BOUTIQUE_ID,
        seuilMin: -25,
        seuilMax: -18,
        ...overrides,
      };
    }

    it('should refuse when seuilMin >= seuilMax (defense in depth)', async () => {
      const result = await createEquipement(
        baseInput({ seuilMin: -10, seuilMax: -18 }),
        ADMIN_ID
      );

      expect(result).toEqual({ success: false, error: 'INVALID' });
      expect(db.boutique.findUnique).not.toHaveBeenCalled();
    });

    it('should return BOUTIQUE_NOT_FOUND when the target boutique is inactive', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue({
        actif: false,
      } as never);

      const result = await createEquipement(baseInput(), ADMIN_ID);

      expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    });

    it('should return BOUTIQUE_NOT_FOUND when the target boutique does not exist', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(null);

      const result = await createEquipement(baseInput(), ADMIN_ID);

      expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    });

    it('should return DUPLICATE when an active equipement with same nom exists in the boutique', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue({
        actif: true,
      } as never);
      vi.mocked(db.equipement.findFirst).mockResolvedValue({
        id: 'other',
      } as never);

      const result = await createEquipement(baseInput(), ADMIN_ID);

      expect(result).toEqual({ success: false, error: 'DUPLICATE' });
      expect(db.equipement.create).not.toHaveBeenCalled();
    });

    it('should persist a new equipement and log CREATE when all checks pass', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue({
        actif: true,
      } as never);
      vi.mocked(db.equipement.findFirst).mockResolvedValue(null);
      vi.mocked(db.equipement.create).mockResolvedValue(
        makeEquipementRow() as never
      );
      arrangeTransaction();

      const result = await createEquipement(baseInput(), ADMIN_ID);

      expect(result.success).toBe(true);
      const args = vi.mocked(db.equipement.create).mock.calls[0]?.[0];
      expect(args?.data).toMatchObject({
        nom: 'CGL-01',
        type: 'CONGELATEUR',
        boutiqueId: BOUTIQUE_ID,
        seuilMin: -25,
        seuilMax: -18,
      });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'EQUIPEMENT',
          performedById: ADMIN_ID,
        })
      );
    });
  });

  describe('updateEquipement', () => {
    it('should return NOT_FOUND when equipement does not exist', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(null);

      const result = await updateEquipement(EQUIPEMENT_ID, { nom: 'New' });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should reject seuils inversion when applied via partial update', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        makeEquipementRow() as never
      );

      const result = await updateEquipement(EQUIPEMENT_ID, { seuilMin: -10 });

      expect(result).toEqual({ success: false, error: 'INVALID' });
    });
  });

  describe('disableEquipement / enableEquipement', () => {
    it('should return NOT_FOUND when disabling a missing equipement', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(null);

      const result = await disableEquipement({
        id: EQUIPEMENT_ID,
        performedById: ADMIN_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should set actif=false/true and log DISABLE/ENABLE accordingly', async () => {
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        makeEquipementRow() as never
      );
      vi.mocked(db.equipement.update).mockResolvedValue(
        makeEquipementRow() as never
      );
      arrangeTransaction();

      const disable = await disableEquipement({
        id: EQUIPEMENT_ID,
        performedById: ADMIN_ID,
        motif: 'Defaut materiel',
      });
      const enable = await enableEquipement({
        id: EQUIPEMENT_ID,
        performedById: ADMIN_ID,
      });

      expect(disable.success).toBe(true);
      expect(enable.success).toBe(true);
      const calls = vi.mocked(db.equipement.update).mock.calls;
      expect(calls[0]?.[0]?.data).toEqual({ actif: false });
      expect(calls[1]?.[0]?.data).toEqual({ actif: true });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISABLE',
          entityType: 'EQUIPEMENT',
          motif: 'Defaut materiel',
          performedById: ADMIN_ID,
        })
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENABLE',
          entityType: 'EQUIPEMENT',
          performedById: ADMIN_ID,
        })
      );
    });
  });
});
