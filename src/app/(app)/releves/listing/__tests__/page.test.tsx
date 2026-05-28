/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  db: {
    boutique: { findMany: vi.fn() },
    equipement: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  canExport: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/services/releve-listing.service', () => ({
  listRelevesForListing: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { listRelevesForListing } from '@/lib/services/releve-listing.service';
import ReleveListingPage from '../page';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};

const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

const ADMIN_SESSION = {
  user: { id: 'a1', role: 'ADMIN' as const, email: 'a1@mg.test' },
};

const VALID_BOUTIQUE_UUID = '11111111-1111-4111-8111-111111111111';

const SUCCESS_RESULT = {
  success: true as const,
  data: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    stats: {
      totalSaisis: 0,
      totalAlertes: 0,
      totalManquants: 0,
      totalAnnules: 0,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[ReleveListingPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(
      ReleveListingPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /dashboard when user is SALARIE (anti-enum)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(false);

    await expect(
      ReleveListingPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/dashboard');
  });

  it('should render the page for RESPONSABLE with form + stats + table', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b1',
      'b2',
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Paris 11' },
      { id: 'b2', nom: 'MG Bastille' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      { id: 'e1', nom: 'Congelo nord', boutiqueId: 'b1' },
    ] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    const element = await ReleveListingPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="releve-listing-page"');
    expect(html).toContain('data-testid="listing-form"');
    expect(html).toContain('data-testid="listing-stats"');
    expect(html).toContain('MG Paris 11');
    expect(html).toContain('Congelo nord');
  });

  it('should render the page for ADMIN with data', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Test' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    const element = await ReleveListingPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="releve-listing-page"');
    expect(html).toContain('MG Test');
  });

  it('should pass searchParams through Zod and persist filters to form', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      VALID_BOUTIQUE_UUID,
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: VALID_BOUTIQUE_UUID, nom: 'MG Test' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      { id: 'e1', nom: 'Congelo nord', boutiqueId: VALID_BOUTIQUE_UUID },
    ] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    const element = await ReleveListingPage({
      searchParams: Promise.resolve({
        boutiqueId: VALID_BOUTIQUE_UUID,
        statut: 'ALERTE',
        dateStart: '2026-05-01',
        dateEnd: '2026-05-15',
      }),
    });
    const html = renderToStaticMarkup(element as any);

    // The form must reflect the current query via selected option / value.
    expect(html).toMatch(
      new RegExp(
        `<select[^>]*data-testid="listing-boutique"[^>]*>[\\s\\S]*<option[^>]*value="${VALID_BOUTIQUE_UUID}"[^>]*selected`
      )
    );
    expect(html).toMatch(
      /<select[^>]*data-testid="listing-statut"[^>]*>[\s\S]*<option[^>]*value="ALERTE"[^>]*selected/
    );
    expect(html).toMatch(
      /<input[^>]*data-testid="listing-date-start"[^>]*value="2026-05-01"/
    );
    expect(html).toMatch(
      /<input[^>]*data-testid="listing-date-end"[^>]*value="2026-05-15"/
    );
  });

  it('should call the listing service with parsed query', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      VALID_BOUTIQUE_UUID,
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: VALID_BOUTIQUE_UUID, nom: 'MG Test' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    await ReleveListingPage({
      searchParams: Promise.resolve({
        boutiqueId: VALID_BOUTIQUE_UUID,
        page: '2',
      }),
    });

    expect(listRelevesForListing).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { id: 'r1', role: 'RESPONSABLE' },
        query: expect.objectContaining({
          boutiqueId: VALID_BOUTIQUE_UUID,
          page: 2,
        }),
      })
    );
  });

  it('should redirect to /dashboard when service returns FORBIDDEN (defense)', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    await expect(
      ReleveListingPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/dashboard');
  });

  it('should display the service error message when service returns non-forbidden error', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Test' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue({
      success: false,
      error: 'PERIODE_TOO_LARGE',
    });

    const element = await ReleveListingPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="releve-listing-error"');
    expect(html).toContain('inferieure ou egale a 92 jours');
  });

  it('should display the FR message when service returns TOO_MANY_RESULTS', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Test' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue({
      success: false,
      error: 'TOO_MANY_RESULTS',
    });

    const element = await ReleveListingPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="releve-listing-error"');
    expect(html).toContain('Trop de releves');
    expect(html).toContain('Reduisez la periode');
    expect(html).toContain('filtrez par boutique/equipement');
  });

  it('should skip filter loads when viewer has no accessible boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    await ReleveListingPage({ searchParams: Promise.resolve({}) });

    expect(db.boutique.findMany).not.toHaveBeenCalled();
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });

  it('should pass actif:true filter on boutique & equipement queries', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b1',
      'b2',
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);
    vi.mocked(listRelevesForListing).mockResolvedValue(SUCCESS_RESULT);

    await ReleveListingPage({ searchParams: Promise.resolve({}) });

    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['b1', 'b2'] }, actif: true },
      })
    );
    expect(db.equipement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boutiqueId: { in: ['b1', 'b2'] }, actif: true },
      })
    );
  });
});
