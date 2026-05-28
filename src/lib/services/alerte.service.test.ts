import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    alerte: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  getAccessibleBoutiqueIds: vi.fn(),
  canManageAlertes: vi.fn(),
}));

import { db } from '@/lib/prisma';
import {
  canManageAlertes,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  buildAlerteEmailContext,
  createAlerte,
  getAlerteById,
  listAlertesOuvertes,
  resolveAlerte,
} from './alerte.service';

const RELEVE_ID = '11111111-1111-4111-8111-111111111111';
const ALERTE_ID = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_ID = 'b-1';
const OTHER_BOUTIQUE_ID = 'b-2';

const PAGINATION = { page: 1, pageSize: 20 } as const;

function responsableUser(): SessionUser {
  return { id: 'resp-1', role: 'RESPONSABLE' };
}

function adminUser(): SessionUser {
  return { id: 'admin-1', role: 'ADMIN' };
}

function salarieUser(): SessionUser {
  return { id: 'sal-1', role: 'SALARIE' };
}

function makeAlerteListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ALERTE_ID,
    status: 'OUVERTE',
    createdAt: new Date('2026-05-26T08:00:00.000Z'),
    releve: {
      id: RELEVE_ID,
      date: new Date('2026-05-26T00:00:00.000Z'),
      creneau: 'MATIN',
      temperature: -10,
      commentaire: 'porte ouverte',
      boutiqueId: BOUTIQUE_ID,
      equipement: {
        nom: 'CGL-01',
        type: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
      },
      boutique: { nom: 'MG Paris 11' },
    },
    ...overrides,
  };
}

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
            id: BOUTIQUE_ID,
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

  describe('listAlertesOuvertes', () => {
    it('should scope a SALARIE to his own boutique (lecture seule)', async () => {
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
      vi.mocked(db.alerte.findMany).mockResolvedValue([
        makeAlerteListRow(),
      ] as never);
      vi.mocked(db.alerte.count).mockResolvedValue(1);

      const result = await listAlertesOuvertes({
        viewer: salarieUser(),
        pagination: PAGINATION,
      });

      // Pas de bail-out role : le scope est porte par getAccessibleBoutiqueIds.
      expect(getAccessibleBoutiqueIds).toHaveBeenCalledWith(salarieUser());
      const findManyCall = vi.mocked(db.alerte.findMany).mock.calls[0]?.[0];
      expect(findManyCall?.where).toMatchObject({
        status: 'OUVERTE',
        releve: { boutiqueId: { in: [BOUTIQUE_ID] } },
      });
      expect(result.total).toBe(1);
      // canManageAlertes n'intervient plus dans la lecture de la liste.
      expect(canManageAlertes).not.toHaveBeenCalled();
    });

    it('should return an empty page when the viewer has no accessible boutiques', async () => {
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

      const result = await listAlertesOuvertes({
        viewer: responsableUser(),
        pagination: PAGINATION,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(db.alerte.findMany).not.toHaveBeenCalled();
    });

    it('should scope the query to accessible boutiques for a RESPONSABLE', async () => {
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
      vi.mocked(db.alerte.findMany).mockResolvedValue([
        makeAlerteListRow(),
      ] as never);
      vi.mocked(db.alerte.count).mockResolvedValue(1);

      const result = await listAlertesOuvertes({
        viewer: responsableUser(),
        pagination: PAGINATION,
      });

      const findManyCall = vi.mocked(db.alerte.findMany).mock.calls[0]?.[0];
      expect(findManyCall?.where).toMatchObject({
        status: 'OUVERTE',
        releve: { boutiqueId: { in: [BOUTIQUE_ID] } },
      });
      expect(result.total).toBe(1);
      expect(result.items[0]?.releve.boutiqueId).toBe(BOUTIQUE_ID);
      expect(result.items[0]?.releve.dateISO).toBe('2026-05-26');
    });

    it('should compute pagination skip/take from the pagination query', async () => {
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
      vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
      vi.mocked(db.alerte.count).mockResolvedValue(45);

      const result = await listAlertesOuvertes({
        viewer: responsableUser(),
        pagination: { page: 3, pageSize: 10 },
      });

      const findManyCall = vi.mocked(db.alerte.findMany).mock.calls[0]?.[0];
      expect(findManyCall?.skip).toBe(20);
      expect(findManyCall?.take).toBe(10);
      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(3);
    });

    it('should use the full active boutiques list for an ADMIN viewer', async () => {
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
        BOUTIQUE_ID,
        OTHER_BOUTIQUE_ID,
      ]);
      vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
      vi.mocked(db.alerte.count).mockResolvedValue(0);

      await listAlertesOuvertes({
        viewer: adminUser(),
        pagination: PAGINATION,
      });

      const findManyCall = vi.mocked(db.alerte.findMany).mock.calls[0]?.[0];
      expect(findManyCall?.where).toMatchObject({
        status: 'OUVERTE',
        releve: { boutiqueId: { in: [BOUTIQUE_ID, OTHER_BOUTIQUE_ID] } },
      });
    });
  });

  describe('getAlerteById', () => {
    it('should let a SALARIE read an alerte of his own boutique (lecture seule)', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(
        makeAlerteListRow() as never
      );
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

      const result = await getAlerteById({
        viewer: salarieUser(),
        alerteId: ALERTE_ID,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(ALERTE_ID);
        expect(result.data.releve.boutiqueId).toBe(BOUTIQUE_ID);
      }
      // La lecture ne depend plus du droit de gestion.
      expect(canManageAlertes).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND for a SALARIE on an alerte out of his boutique (anti-enum)', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(
        makeAlerteListRow() as never
      );
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
        OTHER_BOUTIQUE_ID,
      ]);

      const result = await getAlerteById({
        viewer: salarieUser(),
        alerteId: ALERTE_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should return NOT_FOUND when the alerte does not exist', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(null);

      const result = await getAlerteById({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
      expect(getAccessibleBoutiqueIds).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when the boutique is not accessible (anti-enum)', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(
        makeAlerteListRow() as never
      );
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
        OTHER_BOUTIQUE_ID,
      ]);

      const result = await getAlerteById({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should return the mapped alerte when the boutique is accessible', async () => {
      vi.mocked(db.alerte.findUnique).mockResolvedValue(
        makeAlerteListRow() as never
      );
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

      const result = await getAlerteById({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(ALERTE_ID);
        expect(result.data.releve.equipementNom).toBe('CGL-01');
        expect(result.data.releve.boutiqueId).toBe(BOUTIQUE_ID);
        expect(result.data.releve.dateISO).toBe('2026-05-26');
      }
    });
  });

  describe('resolveAlerte', () => {
    it('should return FORBIDDEN when the viewer cannot manage alertes (SALARIE)', async () => {
      vi.mocked(canManageAlertes).mockReturnValue(false);

      const result = await resolveAlerte({
        viewer: salarieUser(),
        alerteId: ALERTE_ID,
        commentaireResolution: 'porte refermee, ok',
      });

      expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
      expect(db.alerte.findUnique).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when the alerte does not exist', async () => {
      vi.mocked(canManageAlertes).mockReturnValue(true);
      vi.mocked(db.alerte.findUnique).mockResolvedValue(null);

      const result = await resolveAlerte({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
        commentaireResolution: 'porte refermee, ok',
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
      expect(db.alerte.update).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND when the boutique is not accessible (anti-enum)', async () => {
      vi.mocked(canManageAlertes).mockReturnValue(true);
      vi.mocked(db.alerte.findUnique).mockResolvedValue({
        id: ALERTE_ID,
        status: 'OUVERTE',
        releve: { boutiqueId: BOUTIQUE_ID },
      } as never);
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
        OTHER_BOUTIQUE_ID,
      ]);

      const result = await resolveAlerte({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
        commentaireResolution: 'porte refermee, ok',
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
      expect(db.alerte.update).not.toHaveBeenCalled();
    });

    it('should return ALREADY_RESOLVED when the alerte is not OUVERTE', async () => {
      vi.mocked(canManageAlertes).mockReturnValue(true);
      vi.mocked(db.alerte.findUnique).mockResolvedValue({
        id: ALERTE_ID,
        status: 'RESOLUE',
        releve: { boutiqueId: BOUTIQUE_ID },
      } as never);
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

      const result = await resolveAlerte({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
        commentaireResolution: 'porte refermee, ok',
      });

      expect(result).toEqual({ success: false, error: 'ALREADY_RESOLVED' });
      expect(db.alerte.update).not.toHaveBeenCalled();
    });

    it('should update the alerte directly (no $transaction) on success', async () => {
      vi.mocked(canManageAlertes).mockReturnValue(true);
      vi.mocked(db.alerte.findUnique).mockResolvedValue({
        id: ALERTE_ID,
        status: 'OUVERTE',
        releve: { boutiqueId: BOUTIQUE_ID },
      } as never);
      vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
      vi.mocked(db.alerte.update).mockResolvedValue({ id: ALERTE_ID } as never);

      const result = await resolveAlerte({
        viewer: responsableUser(),
        alerteId: ALERTE_ID,
        commentaireResolution: 'cause identifiee, action corrective appliquee',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(ALERTE_ID);
      }
      // Pas de $transaction (mono-update, atomique par defaut).
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.alerte.update).toHaveBeenCalledTimes(1);
      const updateArgs = vi.mocked(db.alerte.update).mock.calls[0]?.[0];
      expect(updateArgs?.where).toEqual({ id: ALERTE_ID });
      expect(updateArgs?.data).toMatchObject({
        status: 'RESOLUE',
        resoluParId: 'resp-1',
        commentaireResolution: 'cause identifiee, action corrective appliquee',
      });
      expect(updateArgs?.data?.resoluAt).toBeInstanceOf(Date);
    });
  });
});
