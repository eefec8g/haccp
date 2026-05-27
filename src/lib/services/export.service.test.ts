import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    releve: { findMany: vi.fn() },
    boutique: { findUnique: vi.fn() },
    equipement: { findMany: vi.fn(), findFirst: vi.fn() },
    alerte: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  canExport: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  logAudit: vi.fn(),
}));

import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { logAudit } from '@/lib/services/audit-log.service';
import {
  buildRegistreJournalier,
  listForExportCsv,
  logExportSuccess,
} from './export.service';

const VIEWER = { id: 'user-1', role: 'RESPONSABLE' as const };
const ADMIN_VIEWER = { id: 'admin-1', role: 'ADMIN' as const };
const SALARIE_VIEWER = { id: 'sal-1', role: 'SALARIE' as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[export.service] listForExportCsv', () => {
  it('should return FORBIDDEN for a salarie', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(false);
    const result = await listForExportCsv({
      viewer: SALARIE_VIEWER,
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should return empty array when viewer has no accessible boutiques', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(result).toEqual({ success: true, data: [] });
    expect(db.releve.findMany).not.toHaveBeenCalled();
  });

  it('should return BOUTIQUE_NOT_FOUND when filter targets a boutique out of scope (anti-enum)', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b1',
      'b2',
    ]);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        boutiqueId: 'b-out-of-scope',
      },
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should return RANGE_TOO_LARGE when query yields > MAX_EXPORT_ROWS', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    const tooMany = Array.from({ length: 10_001 }, () => makeReleveRow());
    vi.mocked(db.releve.findMany).mockResolvedValue(tooMany as never);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(result).toEqual({ success: false, error: 'RANGE_TOO_LARGE' });
  });

  it('should project rows into ExportCsvRow on happy path', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow({
        equipement: { nom: 'CGL-01', seuilMin: -25, seuilMax: -18 },
        boutique: { nom: 'MG Paris 11' },
        user: { name: 'Nina' },
        temperature: -20.5,
        creneau: 'MATIN',
        commentaire: null,
        signature: 'sha:abc',
        alerteHorsSeuils: false,
        annuleParId: null,
        annule: null,
        motifAnnulation: null,
      }),
    ] as never);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        equipementNom: 'CGL-01',
        boutiqueNom: 'MG Paris 11',
        salarieNom: 'Nina',
        temperature: -20.5,
        creneau: 'MATIN',
        statut: 'ACTIF',
      });
    }
  });

  it('should filter by equipementId on happy path when equipement belongs to scope', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.equipement.findFirst).mockResolvedValue({ id: 'e1' } as never);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow({
        equipement: { nom: 'CGL-01', seuilMin: -25, seuilMax: -18 },
      }),
    ] as never);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        equipementId: 'e1',
      },
    });
    expect(db.equipement.findFirst).toHaveBeenCalledWith({
      where: { id: 'e1', boutiqueId: { in: ['b1'] } },
      select: { id: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
    expect(db.releve.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ equipementId: 'e1' }),
      })
    );
  });

  it('should return BOUTIQUE_NOT_FOUND when equipementId belongs to a boutique out of scope', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.equipement.findFirst).mockResolvedValue(null);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        equipementId: 'e-out-of-scope',
      },
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    expect(db.releve.findMany).not.toHaveBeenCalled();
  });

  it('should mark cancelled releves as ANNULE and surface motif via relation', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.releve.findMany).mockResolvedValue([
      makeReleveRow({
        annuleParId: 'replacement-uuid',
        annule: { motifAnnulation: 'Erreur de saisie' },
      }),
    ] as never);
    const result = await listForExportCsv({
      viewer: VIEWER,
      query: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]?.statut).toBe('ANNULE');
      expect(result.data[0]?.motifAnnulation).toBe('Erreur de saisie');
    }
  });
});

describe('[export.service] buildRegistreJournalier', () => {
  it('should return FORBIDDEN for salarie', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(false);
    const result = await buildRegistreJournalier({
      viewer: SALARIE_VIEWER,
      query: { date: '2026-01-01', boutiqueId: 'b1' },
      performedByName: 'Nina',
      performedByRole: 'SALARIE',
    });
    expect(result).toEqual({ success: false, error: 'FORBIDDEN' });
  });

  it('should return BOUTIQUE_NOT_FOUND if boutique not in scope', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    const result = await buildRegistreJournalier({
      viewer: VIEWER,
      query: { date: '2026-01-01', boutiqueId: 'b-other' },
      performedByName: 'Jane',
      performedByRole: 'RESPONSABLE',
    });
    expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should return a RegistreJournalier with MISSING creneaux for equipements without releves', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findUnique).mockResolvedValue({
      id: 'b1',
      nom: 'MG Paris 11',
      adresse: '12 rue X',
      ville: 'Paris',
    } as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      {
        id: 'e1',
        nom: 'CGL-01',
        type: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
        releves: [],
      },
    ] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([] as never);
    const result = await buildRegistreJournalier({
      viewer: ADMIN_VIEWER,
      query: { date: '2026-01-01', boutiqueId: 'b1' },
      performedByName: 'Admin Dupont',
      performedByRole: 'ADMIN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.boutique.nom).toBe('MG Paris 11');
      expect(result.data.equipements).toHaveLength(1);
      expect(result.data.equipements[0]?.creneaux).toHaveLength(3);
      expect(result.data.equipements[0]?.creneaux[0]?.temperature).toBeNull();
      expect(result.data.alertes).toHaveLength(0);
    }
  });

  it('should include alertes with resolution details', async () => {
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findUnique).mockResolvedValue({
      id: 'b1',
      nom: 'MG Paris 11',
      adresse: null,
      ville: null,
    } as never);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as never);
    vi.mocked(db.alerte.findMany).mockResolvedValue([
      {
        id: 'a1',
        status: 'RESOLUE',
        commentaireResolution: 'Porte refermee, temperature revenue normale',
        resoluAt: new Date('2026-01-01T16:00:00Z'),
        resoluPar: { name: 'Jane' },
        releve: {
          creneau: 'MIDI',
          temperature: -10,
          equipement: { nom: 'CGL-01', seuilMin: -25, seuilMax: -18 },
        },
      },
    ] as never);
    const result = await buildRegistreJournalier({
      viewer: ADMIN_VIEWER,
      query: { date: '2026-01-01', boutiqueId: 'b1' },
      performedByName: 'Admin',
      performedByRole: 'ADMIN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alertes).toHaveLength(1);
      expect(result.data.alertes[0]?.status).toBe('RESOLUE');
      expect(result.data.alertes[0]?.commentaireResolution).toContain(
        'Porte refermee'
      );
      expect(result.data.alertes[0]?.resoluParNom).toBe('Jane');
    }
  });
});

describe('[export.service] logExportSuccess', () => {
  it('should call logAudit with EXPORT action and EXPORT entityType', async () => {
    await logExportSuccess({
      viewer: VIEWER,
      performedByName: 'Jane',
      format: 'CSV',
      rowCount: 42,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      boutiqueId: 'b1',
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT',
        entityType: 'EXPORT',
        entityLabel: expect.stringContaining('Export CSV'),
        performedById: VIEWER.id,
        metadata: expect.objectContaining({
          format: 'CSV',
          rowCount: 42,
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
        }),
      })
    );
    const call = vi.mocked(logAudit).mock.calls[0]?.[0];
    expect(call?.entityId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    // entityId must NOT be the viewer id (anti-regression on previous hack).
    expect(call?.entityId).not.toBe(VIEWER.id);
    // metadata must NOT contain the legacy `kind: 'EXPORT'` hack.
    expect(call?.metadata).not.toHaveProperty('kind');
  });

  it('should swallow logAudit errors (best-effort)', async () => {
    vi.mocked(logAudit).mockRejectedValueOnce(new Error('DB down'));
    await expect(
      logExportSuccess({
        viewer: VIEWER,
        performedByName: 'Jane',
        format: 'PDF',
        rowCount: 1,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-01',
        boutiqueId: 'b1',
      })
    ).resolves.toBeUndefined();
  });
});

function makeReleveRow(
  overrides: Partial<{
    creneau: 'MATIN' | 'MIDI' | 'SOIR';
    temperature: number;
    commentaire: string | null;
    signature: string;
    alerteHorsSeuils: boolean;
    annuleParId: string | null;
    annule: { motifAnnulation: string } | null;
    motifAnnulation: string | null;
    equipement: { nom: string; seuilMin: number; seuilMax: number };
    boutique: { nom: string };
    user: { name: string };
  }> = {}
) {
  return {
    id: 'r1',
    date: new Date('2026-01-01T00:00:00Z'),
    creneau: overrides.creneau ?? 'MATIN',
    temperature: overrides.temperature ?? -20,
    commentaire: overrides.commentaire ?? null,
    signature: overrides.signature ?? 'sha:abc',
    alerteHorsSeuils: overrides.alerteHorsSeuils ?? false,
    annuleParId: overrides.annuleParId ?? null,
    motifAnnulation: overrides.motifAnnulation ?? null,
    equipement: overrides.equipement ?? {
      nom: 'CGL-01',
      seuilMin: -25,
      seuilMax: -18,
    },
    boutique: overrides.boutique ?? { nom: 'MG Paris 11' },
    user: overrides.user ?? { name: 'Nina' },
    annule: overrides.annule ?? null,
  };
}
