import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    boutique: { findUnique: vi.fn() },
    equipement: { findMany: vi.fn() },
    releve: { findMany: vi.fn() },
    signature: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils/dates', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils/dates')>(
      '@/lib/utils/dates'
    );
  return { ...actual, todayParisISO: vi.fn(() => '2026-05-27') };
});

import { db } from '@/lib/prisma';
import { getAccessibleBoutiqueIds } from '@/lib/permissions';
import { loadTourneeStatus } from './tournee.service';

const BOUTIQUE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BOUTIQUE_ID = '22222222-2222-4222-8222-222222222222';
const EQUIPEMENT_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EQUIPEMENT_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RELEVE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SIGNATURE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SALARIE_ID = 'sal-1';
const RESPONSABLE_ID = 'resp-1';

const BOUTIQUE_ROW = { id: BOUTIQUE_ID, nom: 'MG Paris 11', actif: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.boutique.findUnique).mockResolvedValue(BOUTIQUE_ROW as never);
  vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
  vi.mocked(db.releve.findMany).mockResolvedValue([] as never);
  vi.mocked(db.signature.findUnique).mockResolvedValue(null as never);
});

describe('[tournee.service] loadTourneeStatus', () => {
  it('should build status with equipements and releves for a SALARIE on his unique boutique', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        id: EQUIPEMENT_A_ID,
        nom: 'Congelateur A',
        seuilMin: -25,
        seuilMax: -18,
      },
      {
        id: EQUIPEMENT_B_ID,
        nom: 'Vitrine B',
        seuilMin: 2,
        seuilMax: 6,
      },
    ] as never);
    const createdAt = new Date('2026-05-27T06:42:00.000Z');
    vi.mocked(db.releve.findMany).mockResolvedValue([
      {
        id: RELEVE_ID,
        equipementId: EQUIPEMENT_A_ID,
        temperature: -20,
        alerteHorsSeuils: false,
        createdAt,
      },
    ] as never);

    const result = await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'MATIN',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.boutiqueId).toBe(BOUTIQUE_ID);
    expect(result.data.boutiqueNom).toBe('MG Paris 11');
    expect(result.data.equipements).toHaveLength(2);
    expect(result.data.releves[EQUIPEMENT_A_ID]).toEqual({
      id: RELEVE_ID,
      temperature: -20,
      alerteHorsSeuils: false,
      saisiAt: createdAt,
    });
    expect(result.data.releves[EQUIPEMENT_B_ID]).toBeNull();
    expect(result.data.signature).toBeNull();
  });

  it('should expose the signature of the day when one exists', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    const signedAt = new Date('2026-05-27T08:30:00Z');
    vi.mocked(db.signature.findUnique).mockResolvedValue({
      id: SIGNATURE_ID,
      signedAt,
      signataireRoleSnapshot: 'SALARIE',
      signataire: { name: 'Alice Dupont' },
    } as never);

    const result = await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'MATIN',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.signature).toEqual({
      id: SIGNATURE_ID,
      signedAt,
      signataireNom: 'Alice Dupont',
      signataireRoleSnapshot: 'SALARIE',
    });
  });

  it('should accept a boutiqueId in scope for a RESPONSABLE with multiple boutiques', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
      BOUTIQUE_ID,
      OTHER_BOUTIQUE_ID,
    ]);

    const result = await loadTourneeStatus({
      viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
      creneau: 'MIDI',
      boutiqueId: BOUTIQUE_ID,
    });

    expect(result.success).toBe(true);
    expect(db.boutique.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOUTIQUE_ID },
      })
    );
  });

  it('should return FORBIDDEN when boutiqueId is out of the viewer scope', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    const result = await loadTourneeStatus({
      viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
      creneau: 'MATIN',
      boutiqueId: OTHER_BOUTIQUE_ID,
    });

    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
    expect(db.boutique.findUnique).not.toHaveBeenCalled();
  });

  it('should return BOUTIQUE_NOT_FOUND when the viewer has no accessible boutique', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([]);

    const result = await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'MATIN',
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should return BOUTIQUE_NOT_FOUND when a RESPONSABLE has multiple boutiques and none selected', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([
      BOUTIQUE_ID,
      OTHER_BOUTIQUE_ID,
    ]);

    const result = await loadTourneeStatus({
      viewer: { id: RESPONSABLE_ID, role: 'RESPONSABLE' },
      creneau: 'MATIN',
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should return BOUTIQUE_NOT_FOUND when the resolved boutique is inactive', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.boutique.findUnique).mockResolvedValue({
      id: BOUTIQUE_ID,
      nom: 'MG Paris 11',
      actif: false,
    } as never);

    const result = await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'MATIN',
    });

    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should only include releves matching the requested creneau (delegated to Prisma where clause)', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);

    await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'SOIR',
      dateISO: '2026-05-27',
    });

    expect(db.releve.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creneau: 'SOIR',
          annuleParId: null,
          boutiqueId: BOUTIQUE_ID,
        }),
      })
    );
  });

  it('should return INTERNAL on unexpected DB failure and log it', async () => {
    vi.mocked(getAccessibleBoutiqueIds).mockResolvedValue([BOUTIQUE_ID]);
    vi.mocked(db.equipement.findMany).mockRejectedValue(new Error('DB down'));

    const result = await loadTourneeStatus({
      viewer: { id: SALARIE_ID, role: 'SALARIE' },
      creneau: 'MATIN',
    });

    expect(result).toEqual({ success: false, error: 'INTERNAL' });
  });
});
