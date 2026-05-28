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
  },
}));

vi.mock('@/lib/permissions', () => ({
  canExport: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { redirect } from 'next/navigation';
import RegistreJournalierPage from './page';

const ADMIN_SESSION = {
  user: { id: 'a1', role: 'ADMIN' as const, email: 'a1@mg.test' },
};

const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[RegistreJournalierPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      RegistreJournalierPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /dashboard when user is SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    await expect(
      RegistreJournalierPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/dashboard');
  });

  it('should render the registre form with take bound on boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Paris 11' },
    ] as any);

    const element = await RegistreJournalierPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="export-pdf-page"');
    expect(html).toContain('data-testid="export-form"');
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: { id: { in: ['b1'] }, actif: true },
      })
    );
  });

  it('should render the rate_limited error with retry duration', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as any);

    const element = await RegistreJournalierPage({
      searchParams: Promise.resolve({ error: 'rate_limited', retry: '90s' }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="export-form-error"');
    // React escapes apostrophes as &#x27; in renderToStaticMarkup output.
    expect(html).toMatch(/Trop d.{1,8}exports recents/);
    expect(html).toContain('Patientez 90s.');
  });

  it('should skip DB query when user has no accessible boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);

    const element = await RegistreJournalierPage({
      searchParams: Promise.resolve({}),
    });
    renderToStaticMarkup(element as any);

    expect(db.boutique.findMany).not.toHaveBeenCalled();
  });
});
