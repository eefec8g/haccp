import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { db } from '@/lib/prisma';
import { getEntityHistory, listAuditLogs, logAudit } from './audit-log.service';

const ADMIN_ID = 'admin-1';
const ENTITY_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeAuditRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'audit-1',
    action: 'DISABLE',
    entityType: 'BOUTIQUE',
    entityId: ENTITY_ID,
    entityLabel: 'MG Paris 11',
    motif: 'Fermeture',
    performedById: ADMIN_ID,
    createdAt: new Date('2026-05-01T08:00:00Z'),
    performedBy: { email: 'admin@maison-givre.fr', name: 'Alice' },
    ...overrides,
  };
}

describe('[audit-log.service]', () => {
  describe('logAudit', () => {
    it('should write via db.auditLog.create when no transaction is provided', async () => {
      vi.mocked(db.auditLog.create).mockResolvedValue({} as never);

      await logAudit({
        action: 'DISABLE',
        entityType: 'BOUTIQUE',
        entityId: ENTITY_ID,
        entityLabel: 'MG Paris 11',
        motif: 'Fermeture',
        performedById: ADMIN_ID,
      });

      expect(db.auditLog.create).toHaveBeenCalledTimes(1);
      const args = vi.mocked(db.auditLog.create).mock.calls[0]?.[0];
      expect(args?.data).toMatchObject({
        action: 'DISABLE',
        entityType: 'BOUTIQUE',
        entityId: ENTITY_ID,
        entityLabel: 'MG Paris 11',
        motif: 'Fermeture',
        performedById: ADMIN_ID,
      });
    });

    it('should write via the transaction client when tx is provided', async () => {
      const txCreate = vi.fn().mockResolvedValue({});
      const tx = { auditLog: { create: txCreate } } as never;

      await logAudit({
        action: 'CREATE',
        entityType: 'EQUIPEMENT',
        entityId: ENTITY_ID,
        performedById: ADMIN_ID,
        tx,
      });

      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it('should propagate errors when running in a transaction (rollback semantics)', async () => {
      const txCreate = vi.fn().mockRejectedValue(new Error('DB DOWN'));
      const tx = { auditLog: { create: txCreate } } as never;

      await expect(
        logAudit({
          action: 'DISABLE',
          entityType: 'USER',
          entityId: ENTITY_ID,
          performedById: ADMIN_ID,
          tx,
        })
      ).rejects.toThrow(/DB DOWN/);
    });

    it('should swallow errors when running outside a transaction (best-effort)', async () => {
      vi.mocked(db.auditLog.create).mockRejectedValue(new Error('DB DOWN'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* silence audit log error output for the test */
      });

      await expect(
        logAudit({
          action: 'DISABLE',
          entityType: 'USER',
          entityId: ENTITY_ID,
          performedById: ADMIN_ID,
        })
      ).resolves.toBeUndefined();
      expect(errSpy).toHaveBeenCalled();

      errSpy.mockRestore();
    });

    it('should default missing optional fields to null in data', async () => {
      vi.mocked(db.auditLog.create).mockResolvedValue({} as never);

      await logAudit({
        action: 'ENABLE',
        entityType: 'BOUTIQUE',
        entityId: ENTITY_ID,
        performedById: ADMIN_ID,
      });

      const args = vi.mocked(db.auditLog.create).mock.calls[0]?.[0];
      expect((args?.data as { entityLabel: unknown }).entityLabel).toBeNull();
      expect((args?.data as { motif: unknown }).motif).toBeNull();
    });
  });

  describe('listAuditLogs', () => {
    it('should paginate ordered by createdAt desc', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        makeAuditRow(),
      ] as never);
      vi.mocked(db.auditLog.count).mockResolvedValue(1);

      const result = await listAuditLogs({
        query: { page: 1, pageSize: 25 },
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      const args = vi.mocked(db.auditLog.findMany).mock.calls[0]?.[0];
      expect(args?.orderBy).toEqual({ createdAt: 'desc' });
      expect(args?.take).toBe(25);
      expect(args?.skip).toBe(0);
    });

    it('should filter by entityType when provided', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue([] as never);
      vi.mocked(db.auditLog.count).mockResolvedValue(0);

      await listAuditLogs({
        query: { page: 2, pageSize: 10 },
        entityType: 'USER',
      });

      const args = vi.mocked(db.auditLog.findMany).mock.calls[0]?.[0];
      expect(args?.where).toMatchObject({ entityType: 'USER' });
      expect(args?.skip).toBe(10);
    });

    it('should project performedBy email and name in the list items', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        makeAuditRow({
          performedBy: { email: 'a@example.com', name: 'Alice' },
        }),
      ] as never);
      vi.mocked(db.auditLog.count).mockResolvedValue(1);

      const result = await listAuditLogs({
        query: { page: 1, pageSize: 25 },
      });

      expect(result.items[0]?.performedByEmail).toBe('a@example.com');
      expect(result.items[0]?.performedByName).toBe('Alice');
    });
  });

  describe('getEntityHistory', () => {
    it('should return entries ordered by createdAt desc capped to 100', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        makeAuditRow(),
      ] as never);

      const history = await getEntityHistory('BOUTIQUE', ENTITY_ID);

      expect(history).toHaveLength(1);
      const args = vi.mocked(db.auditLog.findMany).mock.calls[0]?.[0];
      expect(args?.where).toEqual({
        entityType: 'BOUTIQUE',
        entityId: ENTITY_ID,
      });
      expect(args?.orderBy).toEqual({ createdAt: 'desc' });
      expect(args?.take).toBe(100);
    });
  });
});
