import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    alerte: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { db } from '@/lib/prisma';
import { buildAlerteEmailContext, createAlerte } from './alerte.service';

const RELEVE_ID = '11111111-1111-4111-8111-111111111111';
const ALERTE_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[alerte.service]', () => {
  describe('createAlerte', () => {
    it('should create an alerte via db.alerte.create when no tx is provided', async () => {
      vi.mocked(db.alerte.create).mockResolvedValue({ id: ALERTE_ID } as never);

      const result = await createAlerte({ releveId: RELEVE_ID });

      expect(result.id).toBe(ALERTE_ID);
      expect(db.alerte.create).toHaveBeenCalledTimes(1);
      const args = vi.mocked(db.alerte.create).mock.calls[0]?.[0];
      expect(args?.data).toMatchObject({
        releveId: RELEVE_ID,
        status: 'OUVERTE',
      });
    });

    it('should use the provided transactional client when tx is set', async () => {
      const txCreate = vi.fn().mockResolvedValue({ id: ALERTE_ID });
      const tx = { alerte: { create: txCreate } } as never;

      const result = await createAlerte({ releveId: RELEVE_ID, tx });

      expect(result.id).toBe(ALERTE_ID);
      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(db.alerte.create).not.toHaveBeenCalled();
    });

    it('should propagate transaction errors (rollback semantics)', async () => {
      const txCreate = vi.fn().mockRejectedValue(new Error('FK_VIOLATION'));
      const tx = { alerte: { create: txCreate } } as never;

      await expect(createAlerte({ releveId: RELEVE_ID, tx })).rejects.toThrow(
        /FK_VIOLATION/
      );
    });
  });

  describe('buildAlerteEmailContext', () => {
    function makeAlerteRow() {
      return {
        id: ALERTE_ID,
        releve: {
          date: new Date('2026-05-26T00:00:00.000Z'),
          creneau: 'MIDI',
          temperature: -10,
          commentaire: 'porte ouverte',
          equipement: { nom: 'CGL-01', seuilMin: -25, seuilMax: -18 },
          boutique: {
            id: 'b1',
            nom: 'MG Paris 11',
            responsables: [
              { user: { email: 'r1@maison-givre.fr', actif: true } },
              { user: { email: 'r2@maison-givre.fr', actif: false } },
            ],
          },
        },
      };
    }

    it('should return NOT_FOUND when the alerte does not exist', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(null);

      const result = await buildAlerteEmailContext('missing');

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should project only active recipients (skip inactive users)', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(
        makeAlerteRow() as never
      );

      const result = await buildAlerteEmailContext(ALERTE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipients).toEqual(['r1@maison-givre.fr']);
        expect(result.data.equipementNom).toBe('CGL-01');
        expect(result.data.boutiqueNom).toBe('MG Paris 11');
        expect(result.data.temperature).toBe(-10);
        expect(result.data.seuilMin).toBe(-25);
        expect(result.data.seuilMax).toBe(-18);
      }
    });
  });
});
