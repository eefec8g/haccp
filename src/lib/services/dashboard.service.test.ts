import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    equipement: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    releve: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    alerte: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
    boutique: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/permissions', () => ({
  canManageAlertes: vi.fn(),
  canManageParc: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

import { db } from '@/lib/prisma';
import {
  canManageAlertes,
  canManageParc,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  buildAlertesTrend,
  computeAdminKpis,
  computeResponsableKpis,
  listMissingReleves,
  loadEquipementsTodayBoard,
} from './dashboard.service';

const BOUTIQUE_ID = 'b-1';
const OTHER_BOUTIQUE_ID = 'b-2';
const TODAY_ISO = '2026-05-26';

function responsableUser(): SessionUser {
  return { id: 'resp-1', role: 'RESPONSABLE' };
}

function adminUser(): SessionUser {
  return { id: 'admin-1', role: 'ADMIN' };
}

function salarieUser(): SessionUser {
  return { id: 'sal-1', role: 'SALARIE' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[dashboard.service] computeResponsableKpis', () => {
  it('should return FORBIDDEN when the viewer is a SALARIE', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);

    const result = await computeResponsableKpis({
      viewer: salarieUser(),
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(getAccessibleBoutiqueIds).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when boutiqueId filter is out of scope', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([OTHER_BOUTIQUE_ID]);

    const result = await computeResponsableKpis({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should return zeroed KPIs when the viewer has no accessible boutiques', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

    const result = await computeResponsableKpis({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        tauxConformiteJour: 0,
        alertesOuvertesCount: 0,
        relevesManquantsJourCount: 0,
        boutiquesCount: 0,
      });
    }
    expect(db.equipement.count).not.toHaveBeenCalled();
  });

  it('should compute taux=100 when all releves are recorded for the day', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    // 4 equipements actifs * 3 creneaux = 12 attendus, 12 releves jour
    vi.mocked(db.equipement.count).mockResolvedValue(4);
    vi.mocked(db.releve.count).mockResolvedValue(12);
    vi.mocked(db.alerte.count).mockResolvedValue(2);

    const result = await computeResponsableKpis({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tauxConformiteJour).toBe(100);
      expect(result.data.relevesManquantsJourCount).toBe(0);
      expect(result.data.alertesOuvertesCount).toBe(2);
      expect(result.data.boutiquesCount).toBe(1);
    }
  });

  it('should compute taux and missing properly for partial coverage', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
      BOUTIQUE_ID,
      OTHER_BOUTIQUE_ID,
    ]);
    // 2 equipements * 3 = 6 attendus, 4 releves -> 67%, 2 manquants
    vi.mocked(db.equipement.count).mockResolvedValue(2);
    vi.mocked(db.releve.count).mockResolvedValue(4);
    vi.mocked(db.alerte.count).mockResolvedValue(0);

    const result = await computeResponsableKpis({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tauxConformiteJour).toBe(67);
      expect(result.data.relevesManquantsJourCount).toBe(2);
      expect(result.data.boutiquesCount).toBe(2);
    }
  });
});

describe('[dashboard.service] computeAdminKpis', () => {
  it('should return FORBIDDEN when the viewer is a RESPONSABLE', async () => {
    vi.mocked(canManageParc).mockReturnValue(false);

    const result = await computeAdminKpis({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.user.count).not.toHaveBeenCalled();
  });

  it('should aggregate user/boutique/equipement counts and 7d alerts', async () => {
    vi.mocked(canManageParc).mockReturnValue(true);
    vi.mocked(db.user.count).mockResolvedValue(15);
    vi.mocked(db.boutique.count).mockResolvedValue(3);
    vi.mocked(db.equipement.count).mockResolvedValue(10);
    // db.releve.count est appele 1 fois pour jour + 0 ailleurs ici
    vi.mocked(db.releve.count).mockResolvedValue(20);
    // db.alerte.count est appele 2 fois (ouvertes puis resolues)
    vi.mocked(db.alerte.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(7);

    const result = await computeAdminKpis({
      viewer: adminUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.utilisateursActifs).toBe(15);
      expect(result.data.boutiquesActives).toBe(3);
      expect(result.data.equipementsActifs).toBe(10);
      expect(result.data.alertes7jOuvertes).toBe(4);
      expect(result.data.alertes7jResolues).toBe(7);
      // 10 * 3 = 30 attendus, 20 releves -> 67%
      expect(result.data.tauxConformiteGlobal).toBe(67);
    }
  });

  it('should return 0 conformite when there is no active equipement', async () => {
    vi.mocked(canManageParc).mockReturnValue(true);
    vi.mocked(db.user.count).mockResolvedValue(0);
    vi.mocked(db.boutique.count).mockResolvedValue(0);
    vi.mocked(db.equipement.count).mockResolvedValue(0);
    vi.mocked(db.releve.count).mockResolvedValue(0);
    vi.mocked(db.alerte.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await computeAdminKpis({
      viewer: adminUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tauxConformiteGlobal).toBe(0);
    }
  });
});

describe('[dashboard.service] listMissingReleves', () => {
  it('should return FORBIDDEN for SALARIE viewer', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);

    const result = await listMissingReleves({
      viewer: salarieUser(),
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should return empty list when the viewer has no boutiques', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

    const result = await listMissingReleves({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: true, data: [] });
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });

  it('should compute missing creneaux per equipement and skip the complete ones', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        id: 'eq-1',
        nom: 'Congelateur A',
        boutiqueId: BOUTIQUE_ID,
        boutique: { nom: 'MG Paris 11' },
      },
      {
        id: 'eq-2',
        nom: 'Congelateur B',
        boutiqueId: BOUTIQUE_ID,
        boutique: { nom: 'MG Paris 11' },
      },
    ] as never);
    // eq-1 a MATIN seulement, eq-2 a tous les creneaux
    vi.mocked(db.releve.findMany).mockResolvedValue([
      { equipementId: 'eq-1', creneau: 'MATIN' },
      { equipementId: 'eq-2', creneau: 'MATIN' },
      { equipementId: 'eq-2', creneau: 'MIDI' },
      { equipementId: 'eq-2', creneau: 'SOIR' },
    ] as never);

    const result = await listMissingReleves({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.equipementId).toBe('eq-1');
      expect(result.data[0]?.creneauxManquants).toEqual(['MIDI', 'SOIR']);
    }
  });

  it('should cap the result at DASHBOARD_MISSING_RELEVE_LIMIT entries', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    const TOTAL_EQUIPEMENTS = 25;
    const equipements = Array.from({ length: TOTAL_EQUIPEMENTS }, (_, i) => ({
      id: `eq-${i + 1}`,
      nom: `Congelateur ${i + 1}`,
      boutiqueId: BOUTIQUE_ID,
      boutique: { nom: 'MG Paris 11' },
    }));
    vi.mocked(db.equipement.findMany).mockResolvedValue(equipements as never);
    // Aucun releve : tous les equipements ont 3 creneaux manquants
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);

    const result = await listMissingReleves({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(20);
    }
  });
});

describe('[dashboard.service] buildAlertesTrend', () => {
  // Fenetre 7j calculee depuis `new Date()` cote service : on fige le
  // temps pour rendre les buckets de date deterministes (sinon le test
  // devient rouge des que le calendrier depasse les dates hardcodees).
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return FORBIDDEN for SALARIE viewer', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(false);

    const result = await buildAlertesTrend({ viewer: salarieUser() });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should return FORBIDDEN when boutiqueId is out of scope', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([OTHER_BOUTIQUE_ID]);

    const result = await buildAlertesTrend({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.alerte.findMany).not.toHaveBeenCalled();
  });

  it('should return 7 chronological points when no boutique is accessible', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

    const result = await buildAlertesTrend({ viewer: responsableUser() });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(7);
      const dates = result.data.map((point) => point.dateISO);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
      expect(result.data.every((point) => point.value === 0)).toBe(true);
    }
    expect(db.alerte.findMany).not.toHaveBeenCalled();
  });

  it('should bucket alerts by day across the 7-day window', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    // Deux alertes le meme jour, une autre jour different
    vi.mocked(db.alerte.findMany).mockResolvedValue([
      { createdAt: new Date('2026-05-26T10:00:00.000Z') },
      { createdAt: new Date('2026-05-26T15:30:00.000Z') },
      { createdAt: new Date('2026-05-24T08:00:00.000Z') },
    ] as never);

    const result = await buildAlertesTrend({ viewer: responsableUser() });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(7);
      const totalValue = result.data.reduce(
        (acc, point) => acc + point.value,
        0
      );
      expect(totalValue).toBe(3);
    }
  });

  it('should narrow the query to a single boutique when boutiqueId is provided', async () => {
    vi.mocked(canManageAlertes).mockReturnValue(true);
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
      BOUTIQUE_ID,
      OTHER_BOUTIQUE_ID,
    ]);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);

    const result = await buildAlertesTrend({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
    });

    expect(result.success).toBe(true);
    expect(db.alerte.findMany).toHaveBeenCalledTimes(1);
    const findManyCall = vi.mocked(db.alerte.findMany).mock.calls[0]?.[0];
    expect(findManyCall?.where).toMatchObject({
      releve: { boutiqueId: { in: [BOUTIQUE_ID] } },
    });
  });
});

describe('[dashboard.service] loadEquipementsTodayBoard', () => {
  function equipementDbRow(
    overrides: Partial<{
      id: string;
      nom: string;
      seuilMin: number;
      seuilMax: number;
      boutiqueId: string;
      boutiqueNom: string;
    }> = {}
  ) {
    return {
      id: overrides.id ?? 'eq-1',
      nom: overrides.nom ?? 'Congelateur A',
      seuilMin: overrides.seuilMin ?? -25,
      seuilMax: overrides.seuilMax ?? -18,
      boutiqueId: overrides.boutiqueId ?? BOUTIQUE_ID,
      boutique: { nom: overrides.boutiqueNom ?? 'MG Paris 11' },
    };
  }

  it('should return an empty board when the viewer has no accessible boutiques', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

    const result = await loadEquipementsTodayBoard({
      viewer: salarieUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateISO).toBe(TODAY_ISO);
      expect(result.data.rows).toEqual([]);
    }
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when boutiqueId filter is out of scope', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([OTHER_BOUTIQUE_ID]);

    const result = await loadEquipementsTodayBoard({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: TODAY_ISO,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });

  it('should be accessible to a SALARIE on his own boutique', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      equipementDbRow({ id: 'eq-1', nom: 'Congelateur A' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);

    const result = await loadEquipementsTodayBoard({
      viewer: salarieUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.cells.MATIN.statut).toBe('MANQUANT');
    }
  });

  it('should build SAISI / ALERTE / MANQUANT cells from active releves', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      equipementDbRow({ id: 'eq-1', nom: 'Congelateur A' }),
      equipementDbRow({ id: 'eq-2', nom: 'Congelateur B' }),
    ] as never);
    const matinCreatedAt = new Date('2026-05-26T06:42:00.000Z');
    const midiCreatedAt = new Date('2026-05-26T11:05:00.000Z');
    const soirCreatedAt = new Date('2026-05-26T17:30:00.000Z');
    vi.mocked(db.releve.findMany).mockResolvedValue([
      {
        id: 'r-1',
        equipementId: 'eq-1',
        creneau: 'MATIN',
        temperature: -20,
        alerteHorsSeuils: false,
        createdAt: matinCreatedAt,
      },
      {
        id: 'r-2',
        equipementId: 'eq-1',
        creneau: 'MIDI',
        temperature: -10,
        alerteHorsSeuils: true,
        createdAt: midiCreatedAt,
      },
      {
        id: 'r-3',
        equipementId: 'eq-2',
        creneau: 'SOIR',
        temperature: -19,
        alerteHorsSeuils: false,
        createdAt: soirCreatedAt,
      },
    ] as never);

    const result = await loadEquipementsTodayBoard({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.rows).toHaveLength(2);
    const eq1 = result.data.rows[0];
    expect(eq1?.cells.MATIN).toEqual({
      statut: 'SAISI',
      temperature: -20,
      releveId: 'r-1',
      creneau: 'MATIN',
      saisiAt: matinCreatedAt,
    });
    expect(eq1?.cells.MIDI.statut).toBe('ALERTE');
    expect(eq1?.cells.MIDI.releveId).toBe('r-2');
    expect(eq1?.cells.MIDI.saisiAt).toEqual(midiCreatedAt);
    expect(eq1?.cells.SOIR.statut).toBe('MANQUANT');
    expect(eq1?.cells.SOIR.temperature).toBeNull();
    expect(eq1?.cells.SOIR.releveId).toBeNull();
    expect(eq1?.cells.SOIR.saisiAt).toBeNull();
    const eq2 = result.data.rows[1];
    expect(eq2?.cells.MATIN.statut).toBe('MANQUANT');
    expect(eq2?.cells.MATIN.saisiAt).toBeNull();
    expect(eq2?.cells.MIDI.statut).toBe('MANQUANT');
    expect(eq2?.cells.SOIR.statut).toBe('SAISI');
    expect(eq2?.cells.SOIR.saisiAt).toEqual(soirCreatedAt);
  });

  it('should narrow the equipement query to a single boutique when boutiqueId is provided', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
      BOUTIQUE_ID,
      OTHER_BOUTIQUE_ID,
    ]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);

    await loadEquipementsTodayBoard({
      viewer: responsableUser(),
      boutiqueId: BOUTIQUE_ID,
      dateISO: TODAY_ISO,
    });

    const findManyCall = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
    expect(findManyCall?.where).toMatchObject({
      actif: true,
      boutiqueId: { in: [BOUTIQUE_ID] },
    });
  });

  it('should only count active equipements (where actif=true)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);

    await loadEquipementsTodayBoard({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    const findManyCall = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
    expect(findManyCall?.where).toMatchObject({ actif: true });
  });

  it('should exclude annule releves (annuleParId IS NULL)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);

    await loadEquipementsTodayBoard({
      viewer: responsableUser(),
      dateISO: TODAY_ISO,
    });

    const findManyCall = vi.mocked(db.releve.findMany).mock.calls[0]?.[0];
    expect(findManyCall?.where).toMatchObject({ annuleParId: null });
  });
});
