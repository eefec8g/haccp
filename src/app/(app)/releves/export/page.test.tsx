/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mocks are hoisted BEFORE the page import (vi.mock pattern). Reduces
// the Server Component dependency tree to deterministic stubs.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    // Mimic next/navigation: redirect throws a special signal to abort
    // the render. We throw a typed error so tests can assert easily.
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

import { auth } from '@/lib/auth';
import { db } from '@/lib/prisma';
import * as permissions from '@/lib/permissions';
import { redirect } from 'next/navigation';
import ExportCsvPage from './page';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};

const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[ExportCsvPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      ExportCsvPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /releves when user is SALARIE (anti-enum)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    await expect(
      ExportCsvPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/releves');
  });

  it('should parallelize boutiques and equipements queries with take bounds', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b1',
      'b2',
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Paris 11' },
    ] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([
      { id: 'e1', nom: 'CGL-01', boutiqueId: 'b1' },
    ] as any);

    const element = await ExportCsvPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="export-csv-page"');
    expect(html).toContain('data-testid="export-form"');
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: { id: { in: ['b1', 'b2'] }, actif: true },
      })
    );
    expect(db.equipement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
        where: { boutiqueId: { in: ['b1', 'b2'] }, actif: true },
      })
    );
  });

  it('should render the validation error message when ?error=validation is set', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as any);
    vi.mocked(db.equipement.findMany).mockResolvedValue([] as any);

    const element = await ExportCsvPage({
      searchParams: Promise.resolve({ error: 'validation' }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="export-form-error"');
    expect(html).toContain('parametres sont invalides');
  });

  it('should skip DB queries entirely when user has no accessible boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);

    const element = await ExportCsvPage({
      searchParams: Promise.resolve({}),
    });
    renderToStaticMarkup(element as any);

    expect(db.boutique.findMany).not.toHaveBeenCalled();
    expect(db.equipement.findMany).not.toHaveBeenCalled();
  });
});
