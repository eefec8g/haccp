import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
const { canExport } = vi.hoisted(() => ({ canExport: vi.fn() }));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { listForExportCsv, logExportSuccess } = vi.hoisted(() => ({
  listForExportCsv: vi.fn(),
  logExportSuccess: vi.fn(),
}));
const { encodeCsv } = vi.hoisted(() => ({ encodeCsv: vi.fn() }));

vi.mock('@/lib/auth', () => ({ auth }));
vi.mock('@/lib/permissions', () => ({ canExport }));
vi.mock('@/lib/services/rateLimit', () => ({
  checkRateLimit,
  formatRetryAfterEnhanced: (ms: number): string =>
    `${Math.ceil(ms / 60_000)} minutes`,
}));
vi.mock('@/lib/services/export.service', () => ({
  listForExportCsv,
  logExportSuccess,
}));
vi.mock('@/lib/utils/csv-encoder', () => ({ encodeCsv }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from './route';

const VALID_QUERY = 'dateFrom=2026-05-01&dateTo=2026-05-15';
const FORM_PATH = '/releves/export';

function buildRequest(query: string = VALID_QUERY): NextRequest {
  return new NextRequest(new URL(`http://localhost/api/exports/csv?${query}`));
}

function mockAuthResponsable(): void {
  auth.mockResolvedValue({
    user: {
      id: 'u1',
      email: 'resp@maison-givre.fr',
      name: 'Resp',
      role: 'RESPONSABLE',
      boutiqueIds: ['b1'],
    },
  });
  canExport.mockReturnValue(true);
}

function mockRateAllowed(): void {
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remainingRequests: 4,
    resetAtMs: Date.now() + 3_600_000,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthResponsable();
  mockRateAllowed();
  listForExportCsv.mockResolvedValue({ success: true, data: [] });
  encodeCsv.mockReturnValue('﻿Date;Creneau;...\n');
});

describe('[GET /api/exports/csv]', () => {
  it('should redirect anonymous users to /login', async () => {
    auth.mockResolvedValueOnce(null);

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/login');
    expect(listForExportCsv).not.toHaveBeenCalled();
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
      resetAtMs: Date.now() + 600_000,
      retryAfterMs: 600_000,
    });

    const response = await GET(buildRequest());
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expect(location).toContain(FORM_PATH);
    expect(location).toContain('error=rate_limited');
    expect(location).toContain('retry=');
  });

  it('should redirect with ?error=validation when Zod parsing fails', async () => {
    const response = await GET(
      buildRequest('dateFrom=notadate&dateTo=2026-05-15')
    );
    const location = response.headers.get('location') ?? '';

    expect(response.status).toBe(303);
    expect(location).toContain(FORM_PATH);
    expect(location).toContain('error=validation');
    expect(listForExportCsv).not.toHaveBeenCalled();
  });

  it('should redirect with ?error=boutique_not_found when service returns BOUTIQUE_NOT_FOUND', async () => {
    listForExportCsv.mockResolvedValueOnce({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain(
      'error=boutique_not_found'
    );
  });

  it('should redirect with ?error=range_too_large when service returns RANGE_TOO_LARGE', async () => {
    listForExportCsv.mockResolvedValueOnce({
      success: false,
      error: 'RANGE_TOO_LARGE',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('error=range_too_large');
  });

  it('should redirect with ?error=forbidden when service returns FORBIDDEN', async () => {
    listForExportCsv.mockResolvedValueOnce({
      success: false,
      error: 'FORBIDDEN',
    });

    const response = await GET(buildRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('error=forbidden');
  });

  it('should return 200 with text/csv Content-Type and attachment filename on happy path', async () => {
    listForExportCsv.mockResolvedValueOnce({ success: true, data: [] });
    encodeCsv.mockReturnValueOnce('﻿Date;Creneau\n2026-05-01;MATIN\n');

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Type')).toContain('charset=utf-8');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment; filename=');
    expect(disposition).toContain('haccp_releves_20260501_20260515.csv');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it('should call logExportSuccess after a successful response', async () => {
    listForExportCsv.mockResolvedValueOnce({
      success: true,
      data: [{ date: '2026-05-01' }],
    });

    await GET(buildRequest());

    expect(logExportSuccess).toHaveBeenCalledTimes(1);
    expect(logExportSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'CSV',
        rowCount: 1,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-15',
      })
    );
  });

  it('should ignore audit log errors and still return the CSV (best-effort logging)', async () => {
    listForExportCsv.mockResolvedValueOnce({ success: true, data: [] });
    logExportSuccess.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
  });

  it('should strip error= and retry= from the query before Zod parsing', async () => {
    await GET(
      buildRequest(`${VALID_QUERY}&error=rate_limited&retry=5%20minutes`)
    );

    expect(listForExportCsv).toHaveBeenCalledTimes(1);
    // Si le strip n'avait pas marche, Zod aurait throw sur les champs en plus.
  });

  it('should pass boutiqueId and equipementId filters to the service when present', async () => {
    const buuid = '11111111-1111-1111-1111-111111111111';
    const euuid = '22222222-2222-2222-2222-222222222222';
    await GET(
      buildRequest(`${VALID_QUERY}&boutiqueId=${buuid}&equipementId=${euuid}`)
    );

    expect(listForExportCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          boutiqueId: buuid,
          equipementId: euuid,
        }),
      })
    );
  });
});
