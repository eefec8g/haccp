import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    boutique: { findMany: vi.fn() },
    equipement: { findMany: vi.fn() },
    releve: { findMany: vi.fn() },
    alerte: { findMany: vi.fn() },
    signature: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  canExport: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { buildRegistreConsolide } from './export-consolide.service';
import type { RegistreConsolideViewer } from '@/types/export-consolide';

const RESPONSABLE: RegistreConsolideViewer = {
  id: 'user-resp',
  role: 'RESPONSABLE',
};
const ADMIN: RegistreConsolideViewer = { id: 'user-admin', role: 'ADMIN' };
const SALARIE: RegistreConsolideViewer = { id: 'user-sal', role: 'SALARIE' };

const FROZEN_TODAY = new Date('2026-03-15T10:00:00Z');

/**
 * Gel l'horloge a 2026-03-15 -- toutes les dates de test sont
 * deterministes (passe immediat).
 */
function freezeToday(): void {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_TODAY);
}

function setupEmptyDb(): void {
  vi.mocked(db.boutique.findMany).mockResolvedValue([] as never);
  vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
  vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
  vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
  vi.mocked(db.signature.findMany).mockResolvedValue([] as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  freezeToday();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('[export-consolide.service] permissions', () => {
  it('should return FORBIDDEN for a SALARIE', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(false);
    const result = await buildRegistreConsolide({
      viewer: SALARIE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.boutique.findMany).not.toHaveBeenCalled();
  });

  it('should NOT call canExport before period validation (defense order)', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    setupEmptyDb();
    await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(permissions.canExport).toHaveBeenCalledWith(RESPONSABLE);
  });
});

describe('[export-consolide.service] period validation', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
  });

  it('should return PERIODE_INVALID when dateEnd < dateStart', async () => {
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-09' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_INVALID' });
  });

  it('should return PERIODE_TOO_LARGE when range > 31 days', async () => {
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-02-11', dateEnd: '2026-03-15' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_TOO_LARGE' });
  });

  it('should return PERIODE_IN_FUTURE when dateEnd > today', async () => {
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-14', dateEnd: '2026-03-16' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_IN_FUTURE' });
  });

  it('should accept a 31-day window ending today', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    setupEmptyDb();
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-02-13', dateEnd: '2026-03-15' },
    });
    expect(result.success).toBe(true);
  });
});

describe('[export-consolide.service] scope', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    setupEmptyDb();
  });

  it('should return BOUTIQUE_NOT_FOUND when boutiqueId is outside viewer scope (anti-enum)', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-a',
      'b-b',
    ]);
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: {
        boutiqueId: 'b-out',
        dateStart: '2026-03-10',
        dateEnd: '2026-03-12',
      },
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    expect(db.boutique.findMany).not.toHaveBeenCalled();
  });

  it('should restrict scope to the requested boutique when in scope', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-a',
      'b-b',
    ]);
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: {
        boutiqueId: 'b-a',
        dateStart: '2026-03-10',
        dateEnd: '2026-03-12',
      },
    });
    expect(result.success).toBe(true);
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['b-a'] } } })
    );
  });

  it('should use the full viewer scope when boutiqueId is omitted (mode toutes mes boutiques)', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-a',
      'b-b',
    ]);
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['b-a', 'b-b'] } } })
    );
  });

  it('should return an empty consolide when viewer has no accessible boutique', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.boutiques).toEqual([]);
      expect(result.data.jours).toEqual([]);
      expect(result.data.stats.totalRelevesAttendus).toBe(0);
    }
    expect(db.boutique.findMany).not.toHaveBeenCalled();
  });
});

describe('[export-consolide.service] aggregation', () => {
  const BOUTIQUE = { id: 'b-1', nom: 'MG Paris 11', ville: 'Paris' };
  // Dates de debut anciennes (2020) -> tous les jours de test attendus.
  const EQUIPEMENT = {
    id: 'e-1',
    nom: 'CGL-01',
    boutiqueId: 'b-1',
    dateMiseEnService: new Date('2020-01-01T00:00:00.000Z'),
    boutique: {
      nom: 'MG Paris 11',
      dateOuverture: new Date('2020-01-01T00:00:00.000Z'),
    },
  };

  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should place each releve in the correct (day, equipement, creneau) cell', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([EQUIPEMENT] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      {
        date: new Date('2026-03-10T00:00:00.000Z'),
        creneau: 'MATIN',
        temperature: -20.5,
        alerteHorsSeuils: false,
        equipementId: 'e-1',
        boutiqueId: 'b-1',
        user: { name: 'Nina' },
      },
      {
        date: new Date('2026-03-11T00:00:00.000Z'),
        creneau: 'SOIR',
        temperature: -10,
        alerteHorsSeuils: true,
        equipementId: 'e-1',
        boutiqueId: 'b-1',
        user: { name: 'Leo' },
      },
    ] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.jours).toHaveLength(3);
    const [day1, day2, day3] = result.data.jours;
    expect(day1?.dateISO).toBe('2026-03-10');
    expect(day1?.equipements[0]?.releves.matin).toEqual({
      temperature: -20.5,
      alerte: false,
      salarieNom: 'Nina',
    });
    expect(day1?.equipements[0]?.releves.midi).toBeNull();
    expect(day1?.equipements[0]?.releves.soir).toBeNull();
    expect(day2?.equipements[0]?.releves.soir).toEqual({
      temperature: -10,
      alerte: true,
      salarieNom: 'Leo',
    });
    expect(day3?.equipements[0]?.releves.matin).toBeNull();
  });

  it('should compute tauxConformite as percent of attendu', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([EQUIPEMENT] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow('2026-03-10', 'MATIN'),
      makeReleveRow('2026-03-10', 'MIDI'),
      makeReleveRow('2026-03-10', 'SOIR'),
    ] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // 3 releves / (1 jour x 1 equipement x 3 creneaux) = 100%
      expect(result.data.stats.totalRelevesAttendus).toBe(3);
      expect(result.data.stats.totalRelevesSaisis).toBe(3);
      expect(result.data.stats.relevesManquants).toBe(0);
      expect(result.data.stats.tauxConformite).toBe(100);
    }
  });

  it('should compute partial tauxConformite when some releves missing', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([EQUIPEMENT] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow('2026-03-10', 'MATIN'),
    ] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalRelevesAttendus).toBe(3);
      expect(result.data.stats.totalRelevesSaisis).toBe(1);
      expect(result.data.stats.relevesManquants).toBe(2);
      expect(result.data.stats.tauxConformite).toBe(33);
    }
  });

  it('should bound totalRelevesAttendus by the equipement date de debut effective', async () => {
    // Equipement mis en service le 2026-03-11 : sur une periode de 3 jours
    // (10, 11, 12), seuls 2 jours sont attendus -> 2 x 3 creneaux = 6.
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        ...EQUIPEMENT,
        dateMiseEnService: new Date('2026-03-11T00:00:00.000Z'),
      },
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow('2026-03-11', 'MATIN'),
    ] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalRelevesAttendus).toBe(6);
      expect(result.data.stats.totalRelevesSaisis).toBe(1);
      expect(result.data.stats.relevesManquants).toBe(5);
      // 1 / 6 ~= 17%.
      expect(result.data.stats.tauxConformite).toBe(17);
    }
  });

  it('should count 0 attendu when the equipement is put in service after the period', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        ...EQUIPEMENT,
        dateMiseEnService: new Date('2026-04-01T00:00:00.000Z'),
      },
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalRelevesAttendus).toBe(0);
      expect(result.data.stats.relevesManquants).toBe(0);
      expect(result.data.stats.tauxConformite).toBe(0);
    }
  });

  it('should use the LATEST of boutique ouverture / equipement mise en service', async () => {
    // Boutique ouverte le 2026-03-12 (plus tardive) : 1 seul jour attendu.
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        ...EQUIPEMENT,
        dateMiseEnService: new Date('2026-03-10T00:00:00.000Z'),
        boutique: {
          nom: 'MG Paris 11',
          dateOuverture: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalRelevesAttendus).toBe(3);
    }
  });

  it('should compute tauxResolutionAlertes (OUVERTE = non traitee)', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([EQUIPEMENT] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([
      makeAlerteRow({ id: 'a1', status: 'RESOLUE' }),
      makeAlerteRow({ id: 'a2', status: 'IGNOREE' }),
      makeAlerteRow({ id: 'a3', status: 'OUVERTE' }),
    ] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalAlertes).toBe(3);
      expect(result.data.stats.alertesOuvertes).toBe(1);
      expect(result.data.stats.alertesTraitees).toBe(2);
      expect(result.data.stats.tauxResolutionAlertes).toBe(67);
    }
  });

  it('should include signatures as annexe with role snapshot', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([
      {
        id: 'sig-1',
        dateISO: '2026-03-10',
        signataireRoleSnapshot: 'RESPONSABLE',
        signedAt: new Date('2026-03-10T18:00:00Z'),
        signataire: { name: 'Jane' },
        boutique: { nom: 'MG Paris 11' },
      },
      {
        id: 'sig-2',
        dateISO: '2026-03-11',
        signataireRoleSnapshot: 'SALARIE',
        signedAt: new Date('2026-03-11T18:00:00Z'),
        signataire: { name: 'Lea' },
        boutique: { nom: 'MG Paris 11' },
      },
    ] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.signatures).toHaveLength(2);
      expect(result.data.signatures[0]).toMatchObject({
        id: 'sig-1',
        boutiqueNom: 'MG Paris 11',
        signataireNom: 'Jane',
        signataireRoleSnapshot: 'RESPONSABLE',
      });
      expect(result.data.stats.totalSignatures).toBe(2);
      expect(result.data.stats.joursAvecSignature).toBe(2);
    }
  });

  it('should support ADMIN viewer in multi-boutique mode', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      BOUTIQUE,
      { id: 'b-2', nom: 'MG Paris 17', ville: 'Paris' },
    ] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: ADMIN,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-12' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.boutiques).toHaveLength(2);
    }
  });

  it('should project alertes with releve context (boutique/equipement/salarie)', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([BOUTIQUE] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([EQUIPEMENT] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([
      {
        id: 'a-1',
        status: 'RESOLUE',
        commentaireResolution: 'Porte refermee',
        createdAt: new Date('2026-03-10T08:00:00Z'),
        resoluAt: new Date('2026-03-10T09:00:00Z'),
        resoluPar: { name: 'Jane' },
        releve: {
          date: new Date('2026-03-10T00:00:00Z'),
          creneau: 'MATIN',
          temperature: -5,
          equipement: { nom: 'CGL-01' },
          boutique: { nom: 'MG Paris 11' },
          user: { name: 'Nina' },
        },
      },
    ] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alertes).toHaveLength(1);
      expect(result.data.alertes[0]).toMatchObject({
        id: 'a-1',
        dateISO: '2026-03-10',
        equipementNom: 'CGL-01',
        boutiqueNom: 'MG Paris 11',
        salarieNom: 'Nina',
        statut: 'RESOLUE',
        motif: 'Porte refermee',
        traiteParNom: 'Jane',
      });
    }
  });
});

describe('[export-consolide.service] internal errors', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should map an unexpected DB error to INTERNAL (Result, not throw)', async () => {
    vi.mocked(db.boutique.findMany).mockRejectedValue(new Error('boom'));
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(result).toEqual({ success: false, error: 'INTERNAL' });
  });
});

describe('[export-consolide.service] accessibleBoutiqueIds injection (PERF-2)', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
  });

  it('should NOT call getAccessibleBoutiqueIds when accessibleBoutiqueIds is provided', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
      accessibleBoutiqueIds: ['b-injected'],
    });
    expect(result.success).toBe(true);
    expect(permissions.getAccessibleBoutiqueIds).not.toHaveBeenCalled();
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['b-injected'] } } })
    );
  });

  it('should fallback to getAccessibleBoutiqueIds when not provided (backward-compat)', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-fallback',
    ]);
    setupEmptyDb();
    await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(permissions.getAccessibleBoutiqueIds).toHaveBeenCalledTimes(1);
  });

  it('should enforce BOUTIQUE_NOT_FOUND against injected scope (anti-enum still applies)', async () => {
    const result = await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: {
        boutiqueId: 'b-out',
        dateStart: '2026-03-10',
        dateEnd: '2026-03-10',
      },
      accessibleBoutiqueIds: ['b-a', 'b-b'],
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });
});

describe('[export-consolide.service] DoS defense (SEC-4)', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should pass take: 5000 to db.alerte.findMany to bound result size', async () => {
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    vi.mocked(db.signature.findMany).mockResolvedValue([] as never);

    await buildRegistreConsolide({
      viewer: RESPONSABLE,
      query: { dateStart: '2026-03-10', dateEnd: '2026-03-10' },
    });
    expect(db.alerte.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5000 })
    );
  });
});

interface MakeReleveRowOverrides {
  readonly date?: string;
  readonly creneau?: 'MATIN' | 'MIDI' | 'SOIR';
  readonly alerteHorsSeuils?: boolean;
}

function makeReleveRow(
  date: string,
  creneau: 'MATIN' | 'MIDI' | 'SOIR',
  overrides: MakeReleveRowOverrides = {}
) {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    creneau: overrides.creneau ?? creneau,
    temperature: -20,
    alerteHorsSeuils: overrides.alerteHorsSeuils ?? false,
    equipementId: 'e-1',
    boutiqueId: 'b-1',
    user: { name: 'Nina' },
  };
}

interface MakeAlerteRowArgs {
  readonly id: string;
  readonly status: 'OUVERTE' | 'RESOLUE' | 'IGNOREE';
}

function makeAlerteRow({ id, status }: MakeAlerteRowArgs) {
  return {
    id,
    status,
    commentaireResolution: status === 'RESOLUE' ? 'OK' : null,
    createdAt: new Date('2026-03-10T08:00:00Z'),
    resoluAt: status === 'RESOLUE' ? new Date('2026-03-10T09:00:00Z') : null,
    resoluPar: status === 'RESOLUE' ? { name: 'Jane' } : null,
    releve: {
      date: new Date('2026-03-10T00:00:00Z'),
      creneau: 'MATIN' as const,
      temperature: -5,
      equipement: { nom: 'CGL-01' },
      boutique: { nom: 'MG Paris 11' },
      user: { name: 'Nina' },
    },
  };
}
