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
import RegistreConsolidePage from '../page';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};

const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[RegistreConsolidePage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(
      RegistreConsolidePage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /releves when user is SALARIE (anti-enum)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(false);

    await expect(
      RegistreConsolidePage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/releves');
  });

  it('should render the form for RESPONSABLE with accessible boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([
      'b1',
      'b2',
    ]);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Paris 11', ville: 'Paris' },
      { id: 'b2', nom: 'MG Bastille', ville: 'Paris' },
    ] as any);

    const element = await RegistreConsolidePage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="export-consolide-page"');
    expect(html).toContain('data-testid="consolide-form"');
    expect(html).toContain('MG Paris 11');
    expect(db.boutique.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: { id: { in: ['b1', 'b2'] }, actif: true },
      })
    );
  });

  it('should skip boutique findMany when viewer has no accessible boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue([]);

    const element = await RegistreConsolidePage({
      searchParams: Promise.resolve({}),
    });
    renderToStaticMarkup(element as any);

    expect(db.boutique.findMany).not.toHaveBeenCalled();
  });

  it('should render the server error message when ?error=rate_limited is set', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([
      { id: 'b1', nom: 'MG Test', ville: null },
    ] as any);

    const element = await RegistreConsolidePage({
      searchParams: Promise.resolve({
        error: 'rate_limited',
        retry: '5 minutes',
      }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="consolide-form-error"');
    expect(html).toContain('Patientez 5 minutes');
  });

  it('should render the server error message when ?error=periode_too_large is set', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canExport).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(db.boutique.findMany).mockResolvedValue([] as any);

    const element = await RegistreConsolidePage({
      searchParams: Promise.resolve({ error: 'periode_too_large' }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="consolide-form-error"');
    expect(html).toContain('inferieure ou egale a 31 jours');
  });
});
