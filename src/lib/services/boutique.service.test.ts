import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    boutique: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
  createBoutique,
  disableBoutique,
  enableBoutique,
  getBoutiqueById,
  listBoutiques,
  updateBoutique,
} from './boutique.service';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'admin-1';

/**
 * Stub `$transaction` qui execute le callback en passant un `tx`
 * minimaliste expose pour les assertions sur logAudit. Le service ne
 * doit pas voir de difference entre tx et db pour les operations
 * mockees (toutes les writes Boutique passent par db.boutique.*).
 */
function arrangeTransaction() {
  const txStub = { boutique: db.boutique, auditLog: db.auditLog };
  vi.mocked(db.$transaction).mockImplementation(
    async (cb: unknown) =>
      await (cb as (tx: unknown) => Promise<unknown>)(txStub)
  );
  return txStub;
}

function makeBoutiqueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: VALID_UUID,
    nom: 'MG Paris 11',
    adresse: '12 rue de la Paix',
    ville: 'Paris',
    actif: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    _count: { equipements: 3 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[boutique.service]', () => {
  describe('listBoutiques', () => {
    it('should filter on actif=true by default and return paginated items', async () => {
      vi.mocked(db.boutique.findMany).mockResolvedValue([
        makeBoutiqueRow(),
      ] as never);
      vi.mocked(db.boutique.count).mockResolvedValue(1);

      const result = await listBoutiques({ query: { page: 1, pageSize: 25 } });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      const findManyArgs = vi.mocked(db.boutique.findMany).mock.calls[0]?.[0];
      expect(findManyArgs?.where).toEqual({ actif: true });
    });

    it('should include inactive boutiques when includeInactive=true', async () => {
      vi.mocked(db.boutique.findMany).mockResolvedValue([] as never);
      vi.mocked(db.boutique.count).mockResolvedValue(0);

      await listBoutiques({
        query: { page: 1, pageSize: 25 },
        includeInactive: true,
      });

      const findManyArgs = vi.mocked(db.boutique.findMany).mock.calls[0]?.[0];
      expect(findManyArgs?.where).toEqual({});
    });

    it('should compute skip from page and pageSize', async () => {
      vi.mocked(db.boutique.findMany).mockResolvedValue([] as never);
      vi.mocked(db.boutique.count).mockResolvedValue(0);

      await listBoutiques({ query: { page: 3, pageSize: 10 } });

      const findManyArgs = vi.mocked(db.boutique.findMany).mock.calls[0]?.[0];
      expect(findManyArgs?.skip).toBe(20);
      expect(findManyArgs?.take).toBe(10);
    });

    it('should expose equipementsCount projected from _count', async () => {
      vi.mocked(db.boutique.findMany).mockResolvedValue([
        makeBoutiqueRow({ _count: { equipements: 7 } }),
      ] as never);
      vi.mocked(db.boutique.count).mockResolvedValue(1);

      const result = await listBoutiques({ query: { page: 1, pageSize: 25 } });

      expect(result.items[0]?.equipementsCount).toBe(7);
    });
  });

  describe('getBoutiqueById', () => {
    it('should return NOT_FOUND when boutique does not exist', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(null);

      const result = await getBoutiqueById('missing');

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should return the boutique when found', async () => {
      const row = makeBoutiqueRow();
      vi.mocked(db.boutique.findUnique).mockResolvedValue(row as never);

      const result = await getBoutiqueById(VALID_UUID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(VALID_UUID);
      }
    });
  });

  describe('createBoutique', () => {
    it('should return DUPLICATE when an active boutique already has the same nom+ville', async () => {
      vi.mocked(db.boutique.findFirst).mockResolvedValue({ id: 'b1' } as never);

      const result = await createBoutique(
        {
          nom: 'MG Paris 11',
          ville: 'Paris',
        },
        ADMIN_ID
      );

      expect(result).toEqual({ success: false, error: 'DUPLICATE' });
      expect(db.boutique.create).not.toHaveBeenCalled();
    });

    it('should persist a new boutique and write a CREATE audit log when no duplicate', async () => {
      vi.mocked(db.boutique.findFirst).mockResolvedValue(null);
      vi.mocked(db.boutique.create).mockResolvedValue(
        makeBoutiqueRow() as never
      );
      arrangeTransaction();

      const result = await createBoutique(
        {
          nom: 'MG Paris 11',
          ville: 'Paris',
        },
        ADMIN_ID
      );

      expect(result.success).toBe(true);
      expect(db.boutique.create).toHaveBeenCalledTimes(1);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'BOUTIQUE',
          entityId: VALID_UUID,
          performedById: ADMIN_ID,
        })
      );
    });
  });

  describe('updateBoutique', () => {
    it('should return NOT_FOUND when boutique does not exist', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(null);

      const result = await updateBoutique(VALID_UUID, { nom: 'New' });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should update only the provided fields and not check duplicate when nom/ville unchanged', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(
        makeBoutiqueRow() as never
      );
      vi.mocked(db.boutique.update).mockResolvedValue(
        makeBoutiqueRow() as never
      );

      const result = await updateBoutique(VALID_UUID, {
        adresse: 'Nouvelle adresse',
      });

      expect(result.success).toBe(true);
      expect(db.boutique.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('disableBoutique / enableBoutique', () => {
    it('should return NOT_FOUND when trying to disable an unknown boutique', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(null);

      const result = await disableBoutique({
        id: VALID_UUID,
        performedById: ADMIN_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should set actif=false and log DISABLE with motif when disabling', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(
        makeBoutiqueRow() as never
      );
      vi.mocked(db.boutique.update).mockResolvedValue(
        makeBoutiqueRow({ actif: false }) as never
      );
      arrangeTransaction();

      const result = await disableBoutique({
        id: VALID_UUID,
        performedById: ADMIN_ID,
        motif: 'Fermeture definitive du site',
      });

      expect(result.success).toBe(true);
      const updateArgs = vi.mocked(db.boutique.update).mock.calls[0]?.[0];
      expect(updateArgs?.data).toEqual({ actif: false });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISABLE',
          entityType: 'BOUTIQUE',
          entityId: VALID_UUID,
          motif: 'Fermeture definitive du site',
          performedById: ADMIN_ID,
        })
      );
    });

    it('should set actif=true and log ENABLE when re-enabling a boutique', async () => {
      vi.mocked(db.boutique.findUnique).mockResolvedValue(
        makeBoutiqueRow({ actif: false }) as never
      );
      vi.mocked(db.boutique.update).mockResolvedValue(
        makeBoutiqueRow() as never
      );
      arrangeTransaction();

      const result = await enableBoutique({
        id: VALID_UUID,
        performedById: ADMIN_ID,
      });

      expect(result.success).toBe(true);
      const updateArgs = vi.mocked(db.boutique.update).mock.calls[0]?.[0];
      expect(updateArgs?.data).toEqual({ actif: true });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENABLE',
          entityType: 'BOUTIQUE',
          entityId: VALID_UUID,
          performedById: ADMIN_ID,
        })
      );
    });
  });
});
