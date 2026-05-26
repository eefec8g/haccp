import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  db: {
    boutique: { findMany: vi.fn() },
    boutiqueUser: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    equipement: { findMany: vi.fn(), findUnique: vi.fn() },
    releve: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    alerte: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { db } from '@/lib/prisma';
import {
  annulerReleve,
  createReleve,
  getReleveById,
  getSaisieContext,
  listRecentsBySalarie,
  listTournee,
} from './releve.service';

const SALARIE_ID = 'salarie-1';
const RESPONSABLE_ID = 'responsable-1';
const ADMIN_ID = 'admin-1';
const BOUTIQUE_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_BOUTIQUE_ID = '00000000-0000-4000-8000-0000000000ff';
const EQUIPEMENT_ID = '11111111-1111-4111-8111-111111111111';
const RELEVE_ID = '22222222-2222-4222-8222-222222222222';
const NEW_RELEVE_ID = '33333333-3333-4333-8333-333333333333';
const NEW_ANNUL_ID = '44444444-4444-4444-8444-444444444444';
const NEW_REPLACEMENT_ID = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSalarieBoutique(boutiqueId: string | null) {
  vi.mocked(db.user.findUnique).mockResolvedValue({
    boutiqueSalarieId: boutiqueId,
  } as never);
}

function mockEquipement(
  overrides: Partial<{
    id: string;
    actif: boolean;
    boutiqueId: string;
    seuilMin: number;
    seuilMax: number;
    nom: string;
    type: string;
    boutique: { id: string; nom: string };
    releves: readonly unknown[];
  }> = {}
) {
  return {
    id: EQUIPEMENT_ID,
    nom: 'CGL-01',
    type: 'CONGELATEUR',
    seuilMin: -25,
    seuilMax: -18,
    actif: true,
    boutiqueId: BOUTIQUE_ID,
    boutique: { id: BOUTIQUE_ID, nom: 'MG Paris 11' },
    releves: [],
    ...overrides,
  };
}

describe('[releve.service]', () => {
  describe('listTournee', () => {
    it('should return an empty array when the salarie has no boutique', async () => {
      mockSalarieBoutique(null);

      const result = await listTournee({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
      });

      expect(result).toEqual([]);
      expect(db.equipement.findMany).not.toHaveBeenCalled();
    });

    it('should compose 3 creneaux per equipement, ordered MATIN/MIDI/SOIR', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findMany).mockResolvedValue([
        mockEquipement({
          releves: [
            {
              id: 'r-matin',
              creneau: 'MATIN',
              temperature: -20,
              alerteHorsSeuils: false,
            },
          ],
        }),
      ] as never);

      const result = await listTournee({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
      });

      expect(result).toHaveLength(1);
      const creneaux = result[0]?.creneaux ?? [];
      expect(creneaux.map((c) => c.creneau)).toEqual(['MATIN', 'MIDI', 'SOIR']);
      expect(creneaux[0]?.status).toBe('DONE');
      expect(creneaux[0]?.releveId).toBe('r-matin');
      expect(creneaux[1]?.status).toBe('MISSING');
      expect(creneaux[2]?.status).toBe('MISSING');
    });

    it('should mark a creneau ALERTE when alerteHorsSeuils=true', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findMany).mockResolvedValue([
        mockEquipement({
          releves: [
            {
              id: 'r-midi',
              creneau: 'MIDI',
              temperature: -10,
              alerteHorsSeuils: true,
            },
          ],
        }),
      ] as never);

      const result = await listTournee({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
      });

      const midi = result[0]?.creneaux[1];
      expect(midi?.status).toBe('ALERTE');
      expect(midi?.alerte).toBe(true);
    });

    it('should ignore the boutiqueId filter when not in the viewer scope', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);

      await listTournee({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        boutiqueId: OTHER_BOUTIQUE_ID,
      });

      const args = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
      const where = args?.where as { boutiqueId: { in: string[] } };
      expect(where.boutiqueId.in).toEqual([BOUTIQUE_ID]);
    });

    it('should return [] for SALARIE when dateISO is older than 7 days (RG-LECT-001)', async () => {
      const result = await listTournee({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        dateISO: '2020-01-01',
      });

      expect(result).toEqual([]);
      // Bail-out anticipe : on n'a meme pas requete les boutiques.
      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(db.equipement.findMany).not.toHaveBeenCalled();
    });

    it('should NOT restrict RESPONSABLE on an ancient dateISO (audit access)', async () => {
      vi.mocked(db.boutiqueUser.findMany).mockResolvedValue([
        { boutiqueId: BOUTIQUE_ID },
      ] as never);
      vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);

      await listTournee({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        dateISO: '2020-01-01',
      });

      expect(db.equipement.findMany).toHaveBeenCalledTimes(1);
    });

    it('should NOT restrict ADMIN on an ancient dateISO (audit access)', async () => {
      vi.mocked(db.boutique.findMany).mockResolvedValue([
        { id: BOUTIQUE_ID },
      ] as never);
      vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);

      await listTournee({
        viewer: { id: ADMIN_ID, role: 'ADMIN' },
        dateISO: '2020-01-01',
      });

      expect(db.equipement.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSaisieContext', () => {
    it('should return EQUIPEMENT_NOT_FOUND when equipement is missing', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue(null);

      const result = await getSaisieContext({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        equipementId: EQUIPEMENT_ID,
        creneau: 'MATIN',
      });

      expect(result).toEqual({
        success: false,
        error: 'EQUIPEMENT_NOT_FOUND',
      });
    });

    it('should return BOUTIQUE_FORBIDDEN when boutique is out of viewer scope', async () => {
      mockSalarieBoutique(OTHER_BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        mockEquipement() as never
      );

      const result = await getSaisieContext({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        equipementId: EQUIPEMENT_ID,
        creneau: 'MATIN',
      });

      expect(result).toEqual({ success: false, error: 'BOUTIQUE_FORBIDDEN' });
    });

    it('should return ALREADY_EXISTS when a releve is already active for the slot', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        mockEquipement({ releves: [{ id: 'existing' }] }) as never
      );

      const result = await getSaisieContext({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        equipementId: EQUIPEMENT_ID,
        creneau: 'MATIN',
      });

      expect(result).toEqual({ success: false, error: 'ALREADY_EXISTS' });
    });

    it('should return the saisie context for a valid request', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue(
        mockEquipement() as never
      );

      const result = await getSaisieContext({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        equipementId: EQUIPEMENT_ID,
        creneau: 'MIDI',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.equipement.boutiqueNom).toBe('MG Paris 11');
        expect(result.data.creneau).toBe('MIDI');
        expect(result.data.dateISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('createReleve', () => {
    function setupValidEquipement() {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue({
        id: EQUIPEMENT_ID,
        actif: true,
        boutiqueId: BOUTIQUE_ID,
        seuilMin: -25,
        seuilMax: -18,
      } as never);
    }

    it('should require a long-enough commentaire when hors seuils', async () => {
      setupValidEquipement();

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MIDI',
          temperature: -10,
          commentaire: 'ok',
          ip: '127.0.0.1',
        },
      });

      expect(result).toEqual({ success: false, error: 'COMMENTAIRE_REQUIRED' });
    });

    it('should create a clean releve (in seuils) without alerte', async () => {
      setupValidEquipement();
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              create: vi.fn().mockResolvedValue({ id: NEW_RELEVE_ID }),
            },
            alerte: { create: vi.fn() },
          })
      );

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MATIN',
          temperature: -20,
          ip: '127.0.0.1',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.releveId).toBe(NEW_RELEVE_ID);
        expect(result.data.alerteCreated).toBe(false);
        expect(result.data.alerteId).toBeNull();
      }
    });

    it('should create an alerte when hors seuils with a valid commentaire', async () => {
      setupValidEquipement();
      const alerteCreate = vi.fn().mockResolvedValue({ id: 'alerte-1' });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              create: vi.fn().mockResolvedValue({ id: NEW_RELEVE_ID }),
            },
            alerte: { create: alerteCreate },
          })
      );

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MIDI',
          temperature: -10,
          commentaire: 'Porte ouverte trop longtemps lors de la livraison',
          ip: '127.0.0.1',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alerteCreated).toBe(true);
        expect(result.data.alerteId).toBe('alerte-1');
      }
      expect(alerteCreate).toHaveBeenCalledTimes(1);
    });

    it('should map P2002 to ALREADY_EXISTS (partial unique index)', async () => {
      setupValidEquipement();
      vi.mocked(db.$transaction).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        })
      );

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MATIN',
          temperature: -20,
          ip: null,
        },
      });

      expect(result).toEqual({ success: false, error: 'ALREADY_EXISTS' });
    });

    it('should reject when boutique is out of viewer scope', async () => {
      mockSalarieBoutique(OTHER_BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue({
        id: EQUIPEMENT_ID,
        actif: true,
        boutiqueId: BOUTIQUE_ID,
        seuilMin: -25,
        seuilMax: -18,
      } as never);

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MATIN',
          temperature: -20,
          ip: null,
        },
      });

      expect(result).toEqual({ success: false, error: 'BOUTIQUE_FORBIDDEN' });
    });

    it('should reject when equipement is inactive', async () => {
      mockSalarieBoutique(BOUTIQUE_ID);
      vi.mocked(db.equipement.findUnique).mockResolvedValue({
        id: EQUIPEMENT_ID,
        actif: false,
        boutiqueId: BOUTIQUE_ID,
        seuilMin: -25,
        seuilMax: -18,
      } as never);

      const result = await createReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: {
          equipementId: EQUIPEMENT_ID,
          creneau: 'MATIN',
          temperature: -20,
          ip: null,
        },
      });

      expect(result).toEqual({ success: false, error: 'EQUIPEMENT_INACTIVE' });
    });
  });

  describe('listRecentsBySalarie', () => {
    it('should paginate releves filtered by userId and the 7-day window', async () => {
      vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
      vi.mocked(db.releve.count).mockResolvedValue(0);

      const result = await listRecentsBySalarie({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        query: { page: 1, pageSize: 20 },
      });

      expect(result.total).toBe(0);
      const args = vi.mocked(db.releve.findMany).mock.calls[0]?.[0];
      const where = args?.where as { userId: string; date: unknown };
      expect(where.userId).toBe(SALARIE_ID);
      expect(where.date).toBeDefined();
    });

    it('should hide the salarie email from the listing (own listing)', async () => {
      vi.mocked(db.releve.findMany).mockResolvedValue([
        {
          id: 'r1',
          date: new Date('2026-05-26T00:00:00.000Z'),
          creneau: 'MATIN',
          temperature: -20,
          alerteHorsSeuils: false,
          commentaire: null,
          motifAnnulation: null,
          createdAt: new Date(),
          equipementId: EQUIPEMENT_ID,
          equipement: { nom: 'CGL-01', type: 'CONGELATEUR' },
          boutiqueId: BOUTIQUE_ID,
          boutique: { nom: 'MG Paris 11' },
          user: { email: 'me@x.fr', name: 'Me' },
          annule: null,
        },
      ] as never);
      vi.mocked(db.releve.count).mockResolvedValue(1);

      const result = await listRecentsBySalarie({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        query: { page: 1, pageSize: 20 },
      });

      expect(result.items[0]?.salarieEmail).toBeNull();
      expect(result.items[0]?.salarieName).toBeNull();
    });
  });

  describe('getReleveById', () => {
    it('should return NOT_FOUND when releve does not exist', async () => {
      vi.mocked(db.releve.findUnique).mockResolvedValue(null);

      const result = await getReleveById({
        viewer: { id: ADMIN_ID, role: 'ADMIN' },
        releveId: 'missing',
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should expose motifAnnulation from the annule relation on a cancelled original (N-2)', async () => {
      vi.mocked(db.releve.findUnique).mockResolvedValue({
        id: RELEVE_ID,
        date: new Date(),
        creneau: 'MATIN',
        temperature: -20,
        alerteHorsSeuils: false,
        commentaire: null,
        motifAnnulation: null,
        createdAt: new Date(),
        equipementId: EQUIPEMENT_ID,
        equipement: { nom: 'CGL-01', type: 'CONGELATEUR' },
        boutiqueId: BOUTIQUE_ID,
        boutique: { nom: 'MG Paris 11' },
        user: { email: 'a@x.fr', name: 'A' },
        userId: ADMIN_ID,
        annule: {
          id: NEW_ANNUL_ID,
          motifAnnulation: 'Erreur de saisie verifiee',
        },
      } as never);
      vi.mocked(db.boutique.findMany).mockResolvedValue([
        { id: BOUTIQUE_ID },
      ] as never);

      const result = await getReleveById({
        viewer: { id: ADMIN_ID, role: 'ADMIN' },
        releveId: RELEVE_ID,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.annule).toBe(true);
        expect(result.data.annuleParReleveId).toBe(NEW_ANNUL_ID);
        expect(result.data.motifAnnulation).toBe('Erreur de saisie verifiee');
      }
    });

    it('should return FORBIDDEN when viewer is not author and boutique not accessible', async () => {
      vi.mocked(db.releve.findUnique).mockResolvedValue({
        id: RELEVE_ID,
        date: new Date(),
        creneau: 'MATIN',
        temperature: -20,
        alerteHorsSeuils: false,
        commentaire: null,
        motifAnnulation: null,
        createdAt: new Date(),
        equipementId: EQUIPEMENT_ID,
        equipement: { nom: 'CGL-01', type: 'CONGELATEUR' },
        boutiqueId: OTHER_BOUTIQUE_ID,
        boutique: { nom: 'MG Lyon' },
        user: { email: 'a@x.fr', name: 'A' },
        userId: 'other-user',
        annule: null,
      } as never);
      mockSalarieBoutique(BOUTIQUE_ID);

      const result = await getReleveById({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        releveId: RELEVE_ID,
      });

      expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    });
  });

  describe('annulerReleve', () => {
    function setupResponsableScope() {
      vi.mocked(db.boutiqueUser.findMany).mockResolvedValue([
        { boutiqueId: BOUTIQUE_ID },
      ] as never);
    }

    it('should reject when viewer role is SALARIE', async () => {
      const result = await annulerReleve({
        viewer: { id: SALARIE_ID, role: 'SALARIE' },
        input: { releveId: RELEVE_ID, motif: 'Tentative interdite ici' },
        ip: null,
      });

      expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('should mark NOT_FOUND when releve is missing', async () => {
      setupResponsableScope();
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn(),
              update: vi.fn(),
            },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: { releveId: RELEVE_ID, motif: 'Releve inexistant' },
        ip: null,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should reject ALREADY_CANCELLED when annuleParId is set', async () => {
      setupResponsableScope();
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue({
                id: RELEVE_ID,
                date: new Date(),
                creneau: 'MATIN',
                temperature: -20,
                alerteHorsSeuils: false,
                equipementId: EQUIPEMENT_ID,
                boutiqueId: BOUTIQUE_ID,
                annuleParId: 'existing-annul',
              }),
              create: vi.fn(),
              update: vi.fn(),
            },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: { releveId: RELEVE_ID, motif: 'Deja annule reverif' },
        ip: null,
      });

      expect(result).toEqual({ success: false, error: 'ALREADY_CANCELLED' });
    });

    it('should create the annulation releve and chain annuleParId', async () => {
      setupResponsableScope();
      const create = vi.fn().mockResolvedValueOnce({ id: NEW_ANNUL_ID });
      const update = vi.fn().mockResolvedValue({});
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue({
                id: RELEVE_ID,
                date: new Date('2026-05-26T00:00:00.000Z'),
                creneau: 'MATIN',
                temperature: -20,
                alerteHorsSeuils: false,
                equipementId: EQUIPEMENT_ID,
                boutiqueId: BOUTIQUE_ID,
                annuleParId: null,
              }),
              create,
              update,
            },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: { releveId: RELEVE_ID, motif: 'Erreur saisie verifiee' },
        ip: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.annulationReleveId).toBe(NEW_ANNUL_ID);
        expect(result.data.replacementReleveId).toBeNull();
        expect(result.data.replacementAlerteId).toBeNull();
      }
      expect(create).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith({
        where: { id: RELEVE_ID },
        data: { annuleParId: NEW_ANNUL_ID },
      });

      // N-1 : signature coherente avec la valeur stockee (commentaire null
      // sur la ligne d'annulation, le motif est en motifAnnulation).
      const annulationCreate = create.mock.calls[0]?.[0];
      expect(annulationCreate?.data?.commentaire).toBeNull();
      expect(annulationCreate?.data?.motifAnnulation).toBe(
        'Erreur saisie verifiee'
      );
      expect(annulationCreate?.data?.signature).toEqual(expect.any(String));
    });

    it('should also create a replacement releve when provided', async () => {
      setupResponsableScope();
      const create = vi
        .fn()
        .mockResolvedValueOnce({ id: NEW_ANNUL_ID })
        .mockResolvedValueOnce({ id: NEW_REPLACEMENT_ID });
      const update = vi.fn().mockResolvedValue({});
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue({
                id: RELEVE_ID,
                date: new Date('2026-05-26T00:00:00.000Z'),
                creneau: 'MATIN',
                temperature: -20,
                alerteHorsSeuils: false,
                equipementId: EQUIPEMENT_ID,
                boutiqueId: BOUTIQUE_ID,
                annuleParId: null,
                equipement: { seuilMin: -25, seuilMax: -18 },
              }),
              create,
              update,
            },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: {
          releveId: RELEVE_ID,
          motif: 'Erreur saisie remplacement',
          replacement: { temperature: -22 },
        },
        ip: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.replacementReleveId).toBe(NEW_REPLACEMENT_ID);
        // Replacement dans les seuils : pas d'alerte, pas d'email a dispatch.
        expect(result.data.replacementAlerteId).toBeNull();
      }
      expect(create).toHaveBeenCalledTimes(2);
    });

    it('should create an Alerte when replacement is hors seuils with a commentaire', async () => {
      setupResponsableScope();
      const create = vi
        .fn()
        .mockResolvedValueOnce({ id: NEW_ANNUL_ID })
        .mockResolvedValueOnce({ id: NEW_REPLACEMENT_ID });
      const update = vi.fn().mockResolvedValue({});
      const alerteCreate = vi.fn().mockResolvedValue({ id: 'alerte-new' });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue({
                id: RELEVE_ID,
                date: new Date('2026-05-26T00:00:00.000Z'),
                creneau: 'MATIN',
                temperature: -20,
                alerteHorsSeuils: false,
                equipementId: EQUIPEMENT_ID,
                boutiqueId: BOUTIQUE_ID,
                annuleParId: null,
                equipement: { seuilMin: -25, seuilMax: -18 },
              }),
              create,
              update,
            },
            alerte: { create: alerteCreate },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: {
          releveId: RELEVE_ID,
          motif: 'Vraie valeur ré-évaluée',
          replacement: {
            temperature: -10,
            commentaire: 'Releve replacement hors seuils documenté',
          },
        },
        ip: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.replacementReleveId).toBe(NEW_REPLACEMENT_ID);
        // M-1 : l'alerte creee est exposee pour dispatch email post-commit.
        expect(result.data.replacementAlerteId).toBe('alerte-new');
      }
      // 2 creates releve (annulation + replacement) + 1 alerte
      expect(create).toHaveBeenCalledTimes(2);
      expect(alerteCreate).toHaveBeenCalledTimes(1);
      // Le replacement doit etre flagge alerteHorsSeuils=true
      const replacementCall = create.mock.calls[1]?.[0];
      expect(replacementCall?.data?.alerteHorsSeuils).toBe(true);
    });

    it('should return COMMENTAIRE_REQUIRED when replacement is hors seuils without commentaire', async () => {
      setupResponsableScope();
      const create = vi.fn();
      const update = vi.fn();
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            releve: {
              findUnique: vi.fn().mockResolvedValue({
                id: RELEVE_ID,
                date: new Date('2026-05-26T00:00:00.000Z'),
                creneau: 'MATIN',
                temperature: -20,
                alerteHorsSeuils: false,
                equipementId: EQUIPEMENT_ID,
                boutiqueId: BOUTIQUE_ID,
                annuleParId: null,
                equipement: { seuilMin: -25, seuilMax: -18 },
              }),
              create,
              update,
            },
          })
      );

      const result = await annulerReleve({
        viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
        input: {
          releveId: RELEVE_ID,
          motif: 'Erreur saisie remplacement à risque',
          replacement: { temperature: -10 },
        },
        ip: null,
      });

      expect(result).toEqual({
        success: false,
        error: 'COMMENTAIRE_REQUIRED',
      });
      // L'integrite HACCP : on n'a rien insere
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });
});
