import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
const { canExport } = vi.hoisted(() => ({ canExport: vi.fn() }));
const { getAccessibleBoutiqueIds } = vi.hoisted(() => ({
  getAccessibleBoutiqueIds: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { buildRegistreConsolide } = vi.hoisted(() => ({
  buildRegistreConsolide: vi.fn(),
}));
const { buildRegistreConsolidePdf } = vi.hoisted(() => ({
  buildRegistreConsolidePdf: vi.fn(),
}));
const { logAudit } = vi.hoisted(() => ({ logAudit: vi.fn() }));

vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/permissions', () => ({ canExport, getAccessibleBoutiqueIds }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  formatRetryAfterEnhanced: (ms: number): string =>
    `${Math.ceil(ms / 60_000)} minutes`,
}));
vi.mock('@/lib/services/export-consolide.service', () => ({
  buildRegistreConsolide,
}));
vi.mock('@/lib/utils/pdf-builder-consolide', () => ({
  buildRegistreConsolidePdf,
}));
vi.mock('@/lib/services/audit-log.service', () => ({ logAudit }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from './route';

const BOUTIQUE_UUID = '22222222-2222-2222-2222-222222222222';
const VALID_QUERY = `boutiqueId=${BOUTIQUE_UUID}&dateStart=2026-05-01&dateEnd=2026-05-15`;
const FORM_PATH = '/exports/registre-consolide';

function buildRequest(query: string = VALID_QUERY): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/exports/registre-consolide?${query}`)
  );
}

function mockAuthResponsable(): void {
  auth.mockResolvedValue({
    user: {
      id: 'u1',
      email: 'resp@maison-givre.fr',
      name: 'Resp',
      role: 'RESPONSABLE',
      boutiqueIds: [BOUTIQUE_UUID],
    },
  });
  canExport.mockReturnValue(true);
  getAccessibleBoutiqueIds.mockResolvedValue([BOUTIQUE_UUID]);
}

function mockRateAllowed(): void {
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remainingRequests: 4,
    resetAtMs: Date.now() + 3_600_000,
  });
}

function mockServiceSuccess(): void {
  buildRegistreConsolide.mockResolvedValue({
    success: true,
    data: {
      periode: { dateStart: '2026-05-01', dateEnd: '2026-05-15', jours: 15 },
      boutiques: [{ id: BOUTIQUE_UUID, nom: 'MG Paris 11', ville: 'Paris' }],
      jours: [],
      alertes: [],
      signatures: [],
      stats: {
        totalRelevesAttendus: 0,
        totalRelevesSaisis: 0,
        relevesManquants: 0,
        tauxConformite: 0,
        totalAlertes: 0,
        alertesOuvertes: 0,
        alertesTraitees: 0,
        tauxResolutionAlertes: 0,
        totalSignatures: 0,
        joursAvecSignature: 0,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthResponsable();
  mockRateAllowed();
  mockServiceSuccess();
  buildRegistreConsolidePdf.mockResolvedValue(
    Buffer.from('%PDF-1.7 fake', 'latin1')
  );
});

describe('[GET /api/exports/registre-consolide]', () => {
  it('should redirect anonymous users to /login', async () => {
    auth.mockResolvedValueOnce(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
    expect(buildRegistreConsolide).not.toHaveBeenCalled();
  });

  it('should redirect SALARIE to /login (canExport=false, anti-enum)', async () => {
    auth.mockResolvedValueOnce({
      user: { id: 'u2', role: 'SALARIE', email: 's@x.fr' },
    });
    canExport.mockReturnValueOnce(false);

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
    expect(buildRegistreConsolide).not.toHaveBeenCalled();
  });

  it('should redirect with ?error=rate_limited&retry=... when rate-limited', async () => {
    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remainingRequests: 0,
      resetAtMs: Date.now() + 1_800_000,
      retryAfterMs: 1_800_000,
    });

    const response = await GET(buildRequest());
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expect(location).toContain(FORM_PATH);
    expect(location).toContain('error=rate_limited');
    expect(location).toContain('retry=');
  });

  it('should redirect with ?error=validation when Zod parsing fails', async () => {
    const response = await GET(buildRequest('dateStart=not-a-date'));
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expect(location).toContain(FORM_PATH);
    expect(location).toContain('error=validation');
    expect(buildRegistreConsolide).not.toHaveBeenCalled();
  });

  it('should redirect with ?error=boutique_not_found when service returns BOUTIQUE_NOT_FOUND', async () => {
    buildRegistreConsolide.mockResolvedValueOnce({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const response = await GET(buildRequest());

    expect(response.headers.get('location')).toContain(
      'error=boutique_not_found'
    );
  });

  it('should redirect with ?error=periode_too_large when service returns PERIODE_TOO_LARGE', async () => {
    buildRegistreConsolide.mockResolvedValueOnce({
      success: false,
      error: 'PERIODE_TOO_LARGE',
    });

    const response = await GET(buildRequest());

    expect(response.headers.get('location')).toContain(
      'error=periode_too_large'
    );
  });

  it('should redirect with ?error=forbidden when service returns FORBIDDEN (defense in depth)', async () => {
    buildRegistreConsolide.mockResolvedValueOnce({
      success: false,
      error: 'FORBIDDEN',
    });

    const response = await GET(buildRequest());

    expect(response.headers.get('location')).toContain('error=forbidden');
  });

  it('should redirect with ?error=internal when pdfmake throws', async () => {
    buildRegistreConsolidePdf.mockRejectedValueOnce(new Error('pdf boom'));

    const response = await GET(buildRequest());

    expect(response.headers.get('location')).toContain('error=internal');
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('should return 200 with PDF Content-Type and attachment filename on happy path (single boutique slug)', async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment; filename=');
    expect(disposition).toContain(
      'registre-consolide-mg-paris-11-2026-05-01-au-2026-05-15.pdf'
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('should use "all" slug when no boutiqueId is provided (multi-boutiques mode)', async () => {
    buildRegistreConsolide.mockResolvedValueOnce({
      success: true,
      data: {
        periode: { dateStart: '2026-05-01', dateEnd: '2026-05-03', jours: 3 },
        boutiques: [
          { id: 'b1', nom: 'MG A', ville: null },
          { id: 'b2', nom: 'MG B', ville: null },
        ],
        jours: [],
        alertes: [],
        signatures: [],
        stats: {
          totalRelevesAttendus: 0,
          totalRelevesSaisis: 0,
          relevesManquants: 0,
          tauxConformite: 0,
          totalAlertes: 0,
          alertesOuvertes: 0,
          alertesTraitees: 0,
          tauxResolutionAlertes: 0,
          totalSignatures: 0,
          joursAvecSignature: 0,
        },
      },
    });

    const response = await GET(
      buildRequest('dateStart=2026-05-01&dateEnd=2026-05-03')
    );
    expect(response.headers.get('Content-Disposition')).toContain(
      'registre-consolide-all-2026-05-01-au-2026-05-03.pdf'
    );
  });

  it('should trim trailing hyphen reintroduced by slice(60) on long boutique names (slug edge case)', async () => {
    // Nom dont la slugification produit 66 chars et coupe pile sur "-" au 60e caractere.
    // Sans le fix (slice apres trim), le filename contiendrait "ffff--2026" (double tiret).
    const longNom =
      'aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd eeeeeeeeee ffff GGGGGG';
    buildRegistreConsolide.mockResolvedValueOnce({
      success: true,
      data: {
        periode: { dateStart: '2026-05-01', dateEnd: '2026-05-15', jours: 15 },
        boutiques: [{ id: BOUTIQUE_UUID, nom: longNom, ville: null }],
        jours: [],
        alertes: [],
        signatures: [],
        stats: {
          totalRelevesAttendus: 0,
          totalRelevesSaisis: 0,
          relevesManquants: 0,
          tauxConformite: 0,
          totalAlertes: 0,
          alertesOuvertes: 0,
          alertesTraitees: 0,
          tauxResolutionAlertes: 0,
          totalSignatures: 0,
          joursAvecSignature: 0,
        },
      },
    });

    const response = await GET(buildRequest());
    const disposition = response.headers.get('Content-Disposition') ?? '';
    expect(disposition).not.toContain('--');
    expect(disposition).toContain(
      'registre-consolide-aaaaaaaaaa-bbbbbbbbbb-cccccccccc-dddddddddd-eeeeeeeeee-ffff-2026-05-01-au-2026-05-15.pdf'
    );
  });

  it('should call logAudit with EXPORT_REGISTRE_CONSOLIDE action and metadata on success', async () => {
    await GET(buildRequest());

    expect(logAudit).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT_REGISTRE_CONSOLIDE',
        entityType: 'EXPORT',
        performedById: 'u1',
        metadata: expect.objectContaining({
          boutiqueId: BOUTIQUE_UUID,
          dateStart: '2026-05-01',
          dateEnd: '2026-05-15',
        }),
      })
    );
  });

  it('should log boutiqueId=ALL in audit metadata when no boutiqueId in query', async () => {
    await GET(buildRequest('dateStart=2026-05-01&dateEnd=2026-05-03'));

    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ boutiqueId: 'ALL' }),
      })
    );
  });

  it('should ignore audit log errors and still return the PDF (best-effort logging)', async () => {
    logAudit.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
  });

  it('should strip error= and retry= from the query before Zod parsing', async () => {
    await GET(buildRequest(`${VALID_QUERY}&error=rate_limited&retry=5%20min`));

    expect(buildRegistreConsolide).toHaveBeenCalledTimes(1);
  });

  it('should pass accessibleBoutiqueIds to the service (PERF-2: single resolution)', async () => {
    await GET(buildRequest());

    expect(getAccessibleBoutiqueIds).toHaveBeenCalledTimes(1);
    expect(buildRegistreConsolide).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleBoutiqueIds: [BOUTIQUE_UUID],
      })
    );
  });

  it('should compute a deterministic entityId from viewerId+boutique+dates (SEC-3)', async () => {
    await GET(buildRequest());
    const firstCall = logAudit.mock.calls[0]?.[0] as { entityId: string };
    const firstEntityId = firstCall.entityId;

    logAudit.mockClear();
    await GET(buildRequest());
    const secondCall = logAudit.mock.calls[0]?.[0] as { entityId: string };

    expect(secondCall.entityId).toBe(firstEntityId);
    expect(firstEntityId).toMatch(/^[a-f0-9]+$/);
    expect(firstEntityId.length).toBeLessThanOrEqual(32);
  });

  it('should compute different entityIds for different periods (SEC-3 determinism)', async () => {
    await GET(buildRequest());
    const id1 = (logAudit.mock.calls[0]?.[0] as { entityId: string }).entityId;

    logAudit.mockClear();
    await GET(
      buildRequest(
        `boutiqueId=${BOUTIQUE_UUID}&dateStart=2026-04-01&dateEnd=2026-04-15`
      )
    );
    buildRegistreConsolide.mockResolvedValueOnce({
      success: true,
      data: {
        periode: { dateStart: '2026-04-01', dateEnd: '2026-04-15', jours: 15 },
        boutiques: [{ id: BOUTIQUE_UUID, nom: 'MG Paris 11', ville: 'Paris' }],
        jours: [],
        alertes: [],
        signatures: [],
        stats: {
          totalRelevesAttendus: 0,
          totalRelevesSaisis: 0,
          relevesManquants: 0,
          tauxConformite: 0,
          totalAlertes: 0,
          alertesOuvertes: 0,
          alertesTraitees: 0,
          tauxResolutionAlertes: 0,
          totalSignatures: 0,
          joursAvecSignature: 0,
        },
      },
    });
    await GET(
      buildRequest(
        `boutiqueId=${BOUTIQUE_UUID}&dateStart=2026-04-01&dateEnd=2026-04-15`
      )
    );
    const id2 = (logAudit.mock.calls[0]?.[0] as { entityId: string }).entityId;

    expect(id2).not.toBe(id1);
  });
});

describe('[route consolide] maxDuration (SEC-2)', () => {
  it('should export maxDuration = 60 to align with Vercel Pro limit', async () => {
    const mod = await import('./route');
    expect(mod.maxDuration).toBe(60);
  });
});
