/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('__NOT_FOUND__');
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/services/tournee.service', () => ({
  loadTourneeStatus: vi.fn(),
}));

// Le Client Component TourneeGuidedFlow utilise hooks React (useState,
// useActionState, useRouter) qui ne sont pas exécutables sous SSR pur.
// On le stubbe pour tester la page (auth + scope + render shape).
vi.mock('@/components/features/tournee/TourneeGuidedFlow', () => ({
  TourneeGuidedFlow: ({
    boutiqueId,
    boutiqueNom,
    equipements,
    signature,
  }: {
    readonly boutiqueId: string;
    readonly boutiqueNom: string;
    readonly equipements: readonly { readonly id: string }[];
    readonly signature: unknown;
  }) => (
    <div
      data-testid="tournee-flow"
      data-boutique-id={boutiqueId}
      data-boutique-nom={boutiqueNom}
      data-equipements-count={equipements.length}
      data-has-signature={signature !== null ? 'true' : 'false'}
    />
  ),
}));

import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { loadTourneeStatus } from '@/lib/services/tournee.service';
import TourneePage from '../page';

const SALARIE_SESSION = {
  user: { id: 'sal-1', role: 'SALARIE' as const, email: 'sal@mg.test' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[TourneePage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      TourneePage({
        params: Promise.resolve({ creneau: 'MATIN' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should notFound when creneau segment is invalid', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    await expect(
      TourneePage({
        params: Promise.resolve({ creneau: 'NUIT' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('__NOT_FOUND__');
    expect(notFound).toHaveBeenCalled();
  });

  it('should render the guided flow on the happy path', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(loadTourneeStatus).mockResolvedValue({
      success: true,
      data: {
        dateISO: '2026-05-27',
        creneau: 'MATIN',
        boutiqueId: 'b1',
        boutiqueNom: 'MG Paris 11',
        equipements: [
          { id: 'eq-1', nom: 'Congelateur A', seuilMin: -25, seuilMax: -18 },
        ],
        releves: { 'eq-1': null },
        signature: null,
      },
    });

    const element = await TourneePage({
      params: Promise.resolve({ creneau: 'MATIN' }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="tournee-page"');
    expect(html).toContain('data-testid="tournee-flow"');
    expect(html).toContain('data-boutique-id="b1"');
    expect(html).toContain('data-equipements-count="1"');
    expect(html).toContain('MG Paris 11');
  });

  it('should render the "select boutique" error view when BOUTIQUE_NOT_FOUND', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(loadTourneeStatus).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const element = await TourneePage({
      params: Promise.resolve({ creneau: 'MIDI' }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="tournee-page-no-boutique"');
    expect(html).toContain('Selectionnez une boutique');
  });

  it('should notFound when boutiqueId is FORBIDDEN', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(loadTourneeStatus).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });

    await expect(
      TourneePage({
        params: Promise.resolve({ creneau: 'SOIR' }),
        searchParams: Promise.resolve({ boutiqueId: 'unauthorized' }),
      })
    ).rejects.toThrow('__NOT_FOUND__');
  });

  it('should forward the boutiqueId query param to the service', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(loadTourneeStatus).mockResolvedValue({
      success: true,
      data: {
        dateISO: '2026-05-27',
        creneau: 'MATIN',
        boutiqueId: 'b2',
        boutiqueNom: 'MG Lyon 03',
        equipements: [],
        releves: {},
        signature: null,
      },
    });

    await TourneePage({
      params: Promise.resolve({ creneau: 'MATIN' }),
      searchParams: Promise.resolve({ boutiqueId: 'b2' }),
    });

    expect(loadTourneeStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        creneau: 'MATIN',
        boutiqueId: 'b2',
        viewer: { id: 'sal-1', role: 'SALARIE' },
      })
    );
  });
});
