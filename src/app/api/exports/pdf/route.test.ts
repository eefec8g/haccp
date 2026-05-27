import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
const { canExport } = vi.hoisted(() => ({ canExport: vi.fn() }));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { buildRegistreJournalierForExport, logExportSuccess } = vi.hoisted(
  () => ({
    buildRegistreJournalierForExport: vi.fn(),
    logExportSuccess: vi.fn(),
  })
);
const { buildRegistreJournalierPdf } = vi.hoisted(() => ({
  buildRegistreJournalierPdf: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/permissions', () => ({ canExport }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  formatRetryAfterEnhanced: (ms: number): string =>
    `${Math.ceil(ms / 60_000)} minutes`,
}));
vi.mock('@/lib/services/export.service', () => ({
  buildRegistreJournalierForExport,
  logExportSuccess,
}));
vi.mock('@/lib/utils/pdf-builder', () => ({ buildRegistreJournalierPdf }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from './route';

const BOUTIQUE_UUID = '11111111-1111-1111-1111-111111111111';
const VALID_QUERY = `date=2026-05-15&boutiqueId=${BOUTIQUE_UUID}`;
const FORM_PATH = '/releves/registre';

function buildRequest(query: string = VALID_QUERY): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/exports/pdf?${query}`));
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
}

function mockRateAllowed(): void {
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remainingRequests: 1,
    resetAtMs: Date.now() + 3_600_000,
  });
}

function mockRegistreSuccess(): void {
  buildRegistreJournalierForExport.mockResolvedValue({
    success: true,
    data: {
      dateISO: '2026-05-15',
      boutique: {
        id: BOUTIQUE_UUID,
        nom: 'MG Paris',
        adresse: null,
        ville: null,
      },
      generatedBy: { nom: 'Resp', role: 'RESPONSABLE' },
      generatedAt: new Date(),
      equipements: [{ equipementId: 'e1' }],
      alertes: [],
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthResponsable();
  mockRateAllowed();
  mockRegistreSuccess();
  buildRegistreJournalierPdf.mockResolvedValue(
    Buffer.from('%PDF-1.7 fake', 'latin1')
  );
});

describe('[GET /api/exports/pdf]', () => {
  it('should redirect anonymous users to /login', async () => {
    auth.mockResolvedValueOnce(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
    expect(buildRegistreJournalierForExport).not.toHaveBeenCalled();
  });

  it('should redirect SALARIE to /login (canExport=false)', async () => {
    auth.mockResolvedValueOnce({
      user: { id: 'u2', role: 'SALARIE', email: 's@x.fr' },
    });
    canExport.mockReturnValueOnce(false);

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
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
    const response = await GET(buildRequest('date=not-a-date'));
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expect(location).toContain(FORM_PATH);
    expect(location).toContain('error=validation');
    expect(buildRegistreJournalierForExport).not.toHaveBeenCalled();
  });

  it('should redirect with ?error=boutique_not_found when service returns BOUTIQUE_NOT_FOUND', async () => {
    buildRegistreJournalierForExport.mockResolvedValueOnce({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain(
      'error=boutique_not_found'
    );
  });

  it('should redirect with ?error=forbidden when service returns FORBIDDEN', async () => {
    buildRegistreJournalierForExport.mockResolvedValueOnce({
      success: false,
      error: 'FORBIDDEN',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('error=forbidden');
  });

  it('should redirect with ?error=internal when pdfmake throws', async () => {
    buildRegistreJournalierPdf.mockRejectedValueOnce(new Error('pdf boom'));

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('error=internal');
    expect(logExportSuccess).not.toHaveBeenCalled();
  });

  it('should return 200 with application/pdf Content-Type and attachment filename on happy path', async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment; filename=');
    expect(disposition).toContain('haccp_registre_2026-05-15_mg-paris.pdf');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('should call logExportSuccess after a successful response', async () => {
    await GET(buildRequest());

    expect(logExportSuccess).toHaveBeenCalledTimes(1);
    expect(logExportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'PDF',
        rowCount: 1,
        dateFrom: '2026-05-15',
        dateTo: '2026-05-15',
        boutiqueId: BOUTIQUE_UUID,
      })
    );
  });

  it('should ignore audit log errors and still return the PDF (best-effort logging)', async () => {
    logExportSuccess.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
  });

  it('should strip error= and retry= from the query before Zod parsing', async () => {
    await GET(
      buildRequest(`${VALID_QUERY}&error=rate_limited&retry=5%20minutes`)
    );

    expect(buildRegistreJournalierForExport).toHaveBeenCalledTimes(1);
  });
});
