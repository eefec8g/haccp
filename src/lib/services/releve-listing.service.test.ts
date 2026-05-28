import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    equipement: { findMany: vi.fn(), findFirst: vi.fn() },
    releve: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  canExport: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { listRelevesForListing } from './releve-listing.service';
import { HARD_LIMIT_RELEVES } from '@/lib/constants/releve-listing';
import type { SessionUser } from '@/lib/permissions';
import type { ReleveListingQuery } from '@/types/releve-listing';

const RESPONSABLE: SessionUser = { id: 'u-resp', role: 'RESPONSABLE' };
const ADMIN: SessionUser = { id: 'u-admin', role: 'ADMIN' };
const SALARIE: SessionUser = { id: 'u-sal', role: 'SALARIE' };

const FROZEN_TODAY = new Date('2026-05-15T10:00:00Z');

const BASE_QUERY: ReleveListingQuery = {
  dateStart: '2026-05-10',
  dateEnd: '2026-05-12',
  page: 1,
  pageSize: 50,
};

function setupEmptyDb(): void {
  vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
  vi.mocked(db.equipement.findFirst).mockResolvedValue(null as never);
  vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
}

interface MakeEquipementArgs {
  readonly id: string;
  readonly boutiqueId: string;
  readonly nom?: string;
  readonly boutiqueNom?: string;
  readonly dateMiseEnServiceISO?: string;
  readonly dateOuvertureISO?: string;
}

/**
 * Par defaut les dates de debut sont anciennes (2020) pour que tous les
 * jours de test soient ATTENDUS. Les cas dedies "pas encore en service"
 * passent une date posterieure via les overrides.
 */
function makeEquipement(args: MakeEquipementArgs) {
  return {
    id: args.id,
    nom: args.nom ?? `EQ-${args.id}`,
    boutiqueId: args.boutiqueId,
    dateMiseEnService: new Date(
      `${args.dateMiseEnServiceISO ?? '2020-01-01'}T00:00:00.000Z`
    ),
    boutique: {
      nom: args.boutiqueNom ?? `Boutique ${args.boutiqueId}`,
      dateOuverture: new Date(
        `${args.dateOuvertureISO ?? '2020-01-01'}T00:00:00.000Z`
      ),
    },
  };
}

interface MakeReleveArgs {
  readonly id: string;
  readonly dateISO: string;
  readonly creneau: 'MATIN' | 'MIDI' | 'SOIR';
  readonly equipementId: string;
  readonly boutiqueId: string;
  readonly temperature?: number;
  readonly alerte?: boolean;
  readonly annuleParId?: string | null;
  readonly motifAnnulation?: string | null;
  readonly userName?: string;
  readonly equipementNom?: string;
  readonly boutiqueNom?: string;
  readonly annuleMotif?: string | null;
  readonly createdAtMs?: number;
}

function makeReleve(args: MakeReleveArgs) {
  return {
    id: args.id,
    date: new Date(`${args.dateISO}T00:00:00.000Z`),
    creneau: args.creneau,
    temperature: args.temperature ?? -20,
    alerteHorsSeuils: args.alerte ?? false,
    annuleParId: args.annuleParId ?? null,
    motifAnnulation: args.motifAnnulation ?? null,
    createdAt: new Date(
      args.createdAtMs ?? Date.parse(`${args.dateISO}T08:00:00.000Z`)
    ),
    equipementId: args.equipementId,
    boutiqueId: args.boutiqueId,
    equipement: { nom: args.equipementNom ?? `EQ-${args.equipementId}` },
    boutique: { nom: args.boutiqueNom ?? `Boutique ${args.boutiqueId}` },
    user: { name: args.userName ?? 'Salarie' },
    annule: args.annuleMotif ? { motifAnnulation: args.annuleMotif } : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('[releve-listing.service] permissions', () => {
  it('should return FORBIDDEN for a SALARIE viewer', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(false);
    const result = await listRelevesForListing({
      viewer: SALARIE,
      query: BASE_QUERY,
    });
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.equipement.findMany).not.toHaveBeenCalled();
    expect(db.releve.findMany).not.toHaveBeenCalled();
  });

  it('should allow RESPONSABLE and ADMIN', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    setupEmptyDb();
    const respResult = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: BASE_QUERY,
    });
    const adminResult = await listRelevesForListing({
      viewer: ADMIN,
      query: BASE_QUERY,
    });
    expect(respResult.success).toBe(true);
    expect(adminResult.success).toBe(true);
  });
});

describe('[releve-listing.service] periode validation', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
  });

  it('should return PERIODE_INVALID when dateEnd < dateStart', async () => {
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-12', dateEnd: '2026-05-10' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_INVALID' });
  });

  it('should return PERIODE_TOO_LARGE when range > 92 days', async () => {
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-01-01', dateEnd: '2026-05-15' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_TOO_LARGE' });
  });

  it('should return PERIODE_IN_FUTURE when dateEnd > today', async () => {
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-14', dateEnd: '2026-05-20' },
    });
    expect(result).toEqual({ success: false, error: 'PERIODE_IN_FUTURE' });
  });
});

describe('[releve-listing.service] scope multi-tenant', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    setupEmptyDb();
  });

  it('should return BOUTIQUE_NOT_FOUND when boutiqueId outside scope (anti-enum)', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
    ]);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, boutiqueId: 'b-outside' },
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });

  it('should return EQUIPEMENT_NOT_FOUND when equipementId outside scope (anti-enum)', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
    vi.mocked(db.equipement.findFirst).mockResolvedValue(null as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, equipementId: 'eq-outside' },
    });
    expect(result).toEqual({ success: false, error: 'EQUIPEMENT_NOT_FOUND' });
  });

  it('should restrict to single boutique when boutiqueId in scope', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
    ]);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, boutiqueId: 'b-1' },
    });
    expect(result.success).toBe(true);
    expect(db.equipement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ boutiqueId: { in: ['b-1'] } }),
      })
    );
  });

  it('should use full viewer scope when boutiqueId is omitted', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
    ]);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: BASE_QUERY,
    });
    expect(result.success).toBe(true);
    expect(db.equipement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ boutiqueId: { in: ['b-1', 'b-2'] } }),
      })
    );
  });

  it('should return an empty result when viewer has no accessible boutique', async () => {
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: BASE_QUERY,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([]);
      expect(result.data.total).toBe(0);
      expect(result.data.stats.totalSaisis).toBe(0);
    }
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });
});

describe('[releve-listing.service] aggregation', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
      'b-3',
    ]);
  });

  it('should produce 3 MANQUANT items per day x equipement when no releve', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 1 day x 1 equipement x 3 creneaux = 3 MANQUANT
    expect(result.data.total).toBe(3);
    expect(result.data.stats.totalManquants).toBe(3);
    expect(result.data.items.every((i) => i.statut === 'MANQUANT')).toBe(true);
  });

  it('should classify a hors-seuils releve as ALERTE', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-1',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        alerte: true,
        temperature: -10,
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.stats.totalAlertes).toBe(1);
    expect(result.data.stats.totalSaisis).toBe(0);
    expect(result.data.stats.totalManquants).toBe(2);
  });

  it('should emit an extra ANNULE item next to its active replacement', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-original',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        annuleParId: 'r-cancel',
        annuleMotif: 'Erreur de saisie',
        temperature: -8,
      }),
      makeReleve({
        id: 'r-replacement',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        temperature: -22,
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.stats.totalSaisis).toBe(1);
    expect(result.data.stats.totalAnnules).toBe(1);
    expect(result.data.stats.totalManquants).toBe(2);
    const annule = result.data.items.find((i) => i.statut === 'ANNULE');
    expect(annule?.motifAnnulation).toBe('Erreur de saisie');
  });

  it('should NOT emit MANQUANT for days before the equipement date de debut effective', async () => {
    // Mise en service le 2026-05-11 : le 2026-05-10 n'est PAS attendu.
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({
        id: 'eq-1',
        boutiqueId: 'b-1',
        dateMiseEnServiceISO: '2026-05-11',
      }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-10', dateEnd: '2026-05-12' },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 2 jours attendus (11, 12) x 1 eq x 3 creneaux = 6 (le 10 exclu).
    expect(result.data.stats.totalManquants).toBe(6);
    expect(result.data.items.every((i) => i.dateISO !== '2026-05-10')).toBe(
      true
    );
  });

  it('should bound the date de debut effective to the LATEST of boutique/equipement', async () => {
    // Boutique ouverte le 2026-05-12 (plus tardive) -> seul le 12 attendu.
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({
        id: 'eq-1',
        boutiqueId: 'b-1',
        dateMiseEnServiceISO: '2026-05-10',
        dateOuvertureISO: '2026-05-12',
      }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-10', dateEnd: '2026-05-12' },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 1 jour attendu (12) x 1 eq x 3 creneaux = 3.
    expect(result.data.stats.totalManquants).toBe(3);
    expect(result.data.items.every((i) => i.dateISO === '2026-05-12')).toBe(
      true
    );
  });

  it('should still project an ANNULE releve recorded before the date de debut effective', async () => {
    // Un annule existant le 2026-05-10 (avant mise en service) reste une
    // donnee reelle a tracer, meme si le jour n'est pas "attendu".
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({
        id: 'eq-1',
        boutiqueId: 'b-1',
        dateMiseEnServiceISO: '2026-05-11',
      }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-old',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        annuleParId: 'r-cancel',
        annuleMotif: 'Test materiel avant ouverture',
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-10', dateEnd: '2026-05-10' },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // Aucun MANQUANT (jour non attendu) mais l'annule est projete.
    expect(result.data.stats.totalManquants).toBe(0);
    expect(result.data.stats.totalAnnules).toBe(1);
  });

  it('should load equipement date de debut fields in the equipement select', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    await listRelevesForListing({
      viewer: RESPONSABLE,
      query: { ...BASE_QUERY, dateStart: '2026-05-10', dateEnd: '2026-05-10' },
    });
    const call = vi.mocked(db.equipement.findMany).mock.calls[0]?.[0];
    expect(call?.select).toMatchObject({
      dateMiseEnService: true,
      boutique: { select: { nom: true, dateOuverture: true } },
    });
  });

  it('should mix multiple boutiques and equipements deterministically', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1', nom: 'A' }),
      makeEquipement({ id: 'eq-2', boutiqueId: 'b-1', nom: 'B' }),
      makeEquipement({ id: 'eq-3', boutiqueId: 'b-2', nom: 'C' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-1',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
      }),
      makeReleve({
        id: 'r-2',
        dateISO: '2026-05-10',
        creneau: 'MIDI',
        equipementId: 'eq-2',
        boutiqueId: 'b-1',
        alerte: true,
      }),
      makeReleve({
        id: 'r-3',
        dateISO: '2026-05-11',
        creneau: 'SOIR',
        equipementId: 'eq-3',
        boutiqueId: 'b-2',
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: BASE_QUERY,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 3 days x 3 equipements x 3 creneaux = 27 cells
    expect(result.data.total).toBe(27);
    expect(result.data.stats.totalSaisis).toBe(2);
    expect(result.data.stats.totalAlertes).toBe(1);
    expect(result.data.stats.totalManquants).toBe(24);
  });
});

describe('[releve-listing.service] filters', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b-1',
      'b-2',
    ]);
  });

  it('should filter by creneau (MIDI only emits 1 item per cell)', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-12',
        creneau: 'MIDI',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // 3 days x 1 equipement x 1 creneau = 3 items, all MANQUANT MIDI
    expect(result.data.total).toBe(3);
    expect(result.data.items.every((i) => i.creneau === 'MIDI')).toBe(true);
  });

  it('should filter by statut SAISI (exclude others)', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-saisi',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
      }),
      makeReleve({
        id: 'r-alerte',
        dateISO: '2026-05-10',
        creneau: 'MIDI',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        alerte: true,
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
        statut: 'SAISI',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.total).toBe(1);
    expect(result.data.items[0]?.statut).toBe('SAISI');
    expect(result.data.stats).toEqual({
      totalSaisis: 1,
      totalAlertes: 0,
      totalManquants: 0,
      totalAnnules: 0,
    });
  });

  it('should filter by statut ANNULE only', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleve({
        id: 'r-cancelled',
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
        annuleParId: 'r-cancel',
        annuleMotif: 'typo',
      }),
    ] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
        statut: 'ANNULE',
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.total).toBe(1);
    expect(result.data.items[0]?.statut).toBe('ANNULE');
  });
});

describe('[releve-listing.service] pagination', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should paginate page=2 pageSize=10 on 25 items', async () => {
    // 25 items via 9 days x 1 eq x 3 creneaux = 27 manquants, slice 10..19
    const days = Array.from(
      { length: 9 },
      (_, i) => `2026-05-${String(7 + i).padStart(2, '0')}`
    );
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: days[0] ?? '2026-05-07',
        dateEnd: days[days.length - 1] ?? '2026-05-15',
        page: 2,
        pageSize: 10,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.total).toBe(27);
    expect(result.data.items.length).toBe(10);
    expect(result.data.page).toBe(2);
    expect(result.data.totalPages).toBe(3);
  });

  it('should return empty items when page exceeds totalPages', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
        page: 10,
        pageSize: 10,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.items).toEqual([]);
    expect(result.data.total).toBe(3);
  });
});

describe('[releve-listing.service] hard limit', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should apply take=HARD_LIMIT_RELEVES+1 on the releve findMany query', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    await listRelevesForListing({ viewer: RESPONSABLE, query: BASE_QUERY });
    expect(db.releve.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: HARD_LIMIT_RELEVES + 1 })
    );
  });

  it('should return TOO_MANY_RESULTS when releve count exceeds HARD_LIMIT_RELEVES', async () => {
    // Mock HARD_LIMIT_RELEVES + 1 releves to simulate the overflow signal.
    // Equipement set must be non-empty so we actually reach loadListingData.
    const overflow = HARD_LIMIT_RELEVES + 1;
    const releves = Array.from({ length: overflow }, (_, i) =>
      makeReleve({
        id: `r-${i}`,
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
      })
    );
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue(releves as never);

    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
      },
    });
    expect(result).toEqual({ success: false, error: 'TOO_MANY_RESULTS' });
  });

  it('should still succeed when releve count equals HARD_LIMIT_RELEVES (boundary)', async () => {
    const releves = Array.from({ length: HARD_LIMIT_RELEVES }, (_, i) =>
      makeReleve({
        id: `r-${i}`,
        dateISO: '2026-05-10',
        creneau: 'MATIN',
        equipementId: 'eq-1',
        boutiqueId: 'b-1',
      })
    );
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-1', boutiqueId: 'b-1' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue(releves as never);

    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-10',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('[releve-listing.service] sorting', () => {
  beforeEach(() => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b-1']);
  });

  it('should sort items by dateISO desc, creneau asc, equipement asc', async () => {
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      makeEquipement({ id: 'eq-a', boutiqueId: 'b-1', nom: 'AAA' }),
      makeEquipement({ id: 'eq-b', boutiqueId: 'b-1', nom: 'BBB' }),
    ] as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
    const result = await listRelevesForListing({
      viewer: RESPONSABLE,
      query: {
        ...BASE_QUERY,
        dateStart: '2026-05-10',
        dateEnd: '2026-05-11',
        page: 1,
        pageSize: 100,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    // First item must be the latest date + earliest creneau + earliest equipement nom
    expect(result.data.items[0]?.dateISO).toBe('2026-05-11');
    expect(result.data.items[0]?.creneau).toBe('MATIN');
    expect(result.data.items[0]?.equipementNom).toBe('AAA');
  });
});
