/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests page liste des alertes (US-ALE-001 + acces lecture SALARIE).
 *
 * Verifie l'orchestration Server Component :
 *   - Garde auth : redirect /login si pas de session.
 *   - Lecture ouverte aux trois roles : le SALARIE accede (plus de 404)
 *     et la liste est scopee cote service par `getAccessibleBoutiqueIds`.
 *   - Prop `canManage` propagee a `AlerteList` : true pour
 *     RESPONSABLE/ADMIN, false pour SALARIE (conditionne les actions).
 */

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

vi.mock('@/lib/permissions', () => ({
  canManageAlertes: vi.fn(),
}));

vi.mock('@/lib/services/alerte.service', () => ({
  listAlertesOuvertes: vi.fn(),
}));

// AlerteList est un Server Component pur ; on stub pour capturer la prop
// `canManage` passee par la page (assertion ciblee sur l'orchestration).
vi.mock('@/components/features/alertes/AlerteList', () => ({
  AlerteList: ({
    items,
    canManage,
  }: {
    readonly items: readonly { readonly id: string }[];
    readonly canManage: boolean;
  }) => (
    <div
      data-testid="alerte-list-stub"
      data-can-manage={String(canManage)}
      data-items-count={String(items.length)}
    />
  ),
}));

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import * as permissions from '@/lib/permissions';
import * as alerteService from '@/lib/services/alerte.service';
import AlertesPage from '../page';

const BOUTIQUE_ID = 'b1';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};
const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

function buildPaginatedResult(itemsCount: number) {
  const items = Array.from({ length: itemsCount }, (_, index) => ({
    id: `a-${index}`,
    status: 'OUVERTE' as const,
    createdAt: new Date('2026-05-27T08:00:00.000Z'),
    releve: {
      id: `r-${index}`,
      dateISO: '2026-05-27',
      creneau: 'MATIN' as const,
      temperature: -12,
      commentaire: null,
      equipementNom: 'Congelo 1',
      equipementType: 'CONGELATEUR' as const,
      boutiqueId: BOUTIQUE_ID,
      boutiqueNom: 'MG Paris 11',
      seuilMin: -25,
      seuilMax: -18,
    },
  }));
  return { items, page: 1, pageSize: 20, total: itemsCount, totalPages: 1 };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[AlertesPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(
      AlertesPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should let a SALARIE access the list in read-only (canManage=false, no 404)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(false);
    vi.mocked(alerteService.listAlertesOuvertes).mockResolvedValue(
      buildPaginatedResult(2) as any
    );

    const element = await AlertesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="alertes-page"');
    expect(html).toContain('data-testid="alerte-list-stub"');
    expect(html).toContain('data-can-manage="false"');
    expect(html).toContain('data-items-count="2"');
    // Le service est appele avec le viewer SALARIE (scope cote service).
    expect(alerteService.listAlertesOuvertes).toHaveBeenCalledWith({
      viewer: { id: 's1', role: 'SALARIE' },
      pagination: { page: 1, pageSize: 20 },
    });
  });

  it('should pass canManage=true to AlerteList for a RESPONSABLE', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(alerteService.listAlertesOuvertes).mockResolvedValue(
      buildPaginatedResult(1) as any
    );

    const element = await AlertesPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-can-manage="true"');
  });
});
