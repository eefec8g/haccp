/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mocks hoisted BEFORE the page import (vi.mock pattern). Stubs reducent
// l'arbre de dependances Server Component a des valeurs deterministes.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  canManageAlertes: vi.fn(),
  getAccessibleBoutiqueIds: vi.fn(),
}));

vi.mock('@/lib/services/dashboard.service', () => ({
  computeResponsableKpis: vi.fn(),
  loadEquipementsTodayBoard: vi.fn(),
  buildAlertesTrend: vi.fn(),
}));

vi.mock('@/lib/services/alerte.service', () => ({
  listAlertesOuvertes: vi.fn(),
}));

vi.mock('@/lib/services/boutique.service', () => ({
  getBoutiquesByIds: vi.fn(),
}));

// TrendChart est charge via next/dynamic (ssr: false) dans la page reelle
// pour reduire le bundle. En test SSR (renderToStaticMarkup) il faut
// stubber le composant ET intercepter next/dynamic pour qu'il retourne
// un Server Component synchrone.
function TrendChartStub({
  title,
  testId,
}: {
  readonly title: string;
  readonly testId?: string;
}) {
  return (
    <div data-testid={testId ?? 'trend-chart'} aria-label={title}>
      {title}
    </div>
  );
}

vi.mock('@/components/features/dashboard/TrendChart', () => ({
  TrendChart: TrendChartStub,
}));

vi.mock('next/dynamic', () => ({
  default: () => TrendChartStub,
}));

vi.mock('@/lib/utils/dates', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/utils/dates')>(
      '@/lib/utils/dates'
    );
  return {
    ...actual,
    todayParisISO: vi.fn(() => '2026-05-27'),
  };
});

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import * as permissions from '@/lib/permissions';
import * as dashboardService from '@/lib/services/dashboard.service';
import * as alerteService from '@/lib/services/alerte.service';
import * as boutiqueService from '@/lib/services/boutique.service';
import DashboardPage from '../page';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};
const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};
const ADMIN_SESSION = {
  user: { id: 'a1', role: 'ADMIN' as const, email: 'a1@mg.test' },
};

const DEFAULT_KPIS = {
  tauxConformiteJour: 87,
  alertesOuvertesCount: 3,
  relevesManquantsJourCount: 2,
  boutiquesCount: 1,
};

function setHappyPathMocks({
  boutiques = [{ id: 'b1', nom: 'MG Paris 11', ville: 'Paris' }],
  accessible = ['b1'],
  alertes = [] as any[],
}: {
  readonly boutiques?: any[];
  readonly accessible?: string[];
  readonly alertes?: any[];
} = {}): void {
  vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
  vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(accessible);
  vi.mocked(dashboardService.computeResponsableKpis).mockResolvedValue({
    success: true,
    data: DEFAULT_KPIS,
  });
  vi.mocked(dashboardService.loadEquipementsTodayBoard).mockResolvedValue({
    success: true,
    data: { dateISO: '2026-05-27', rows: [] },
  });
  vi.mocked(dashboardService.buildAlertesTrend).mockResolvedValue({
    success: true,
    data: [{ dateISO: '2026-05-27', value: 0 }],
  });
  vi.mocked(alerteService.listAlertesOuvertes).mockResolvedValue({
    items: alertes,
    total: alertes.length,
    page: 1,
    pageSize: 5,
    totalPages: 1,
  });
  vi.mocked(boutiqueService.getBoutiquesByIds).mockResolvedValue(
    boutiques as any
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[DashboardPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render the salarie view (board only) for a SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(false);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);
    vi.mocked(dashboardService.loadEquipementsTodayBoard).mockResolvedValue({
      success: true,
      data: { dateISO: '2026-05-27', rows: [] },
    });

    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="dashboard-salarie-page"');
    expect(html).toContain('data-testid="dashboard-board-section"');
    expect(html).not.toContain('data-testid="dashboard-kpis"');
    expect(html).not.toContain('data-testid="dashboard-trend"');
    expect(html).not.toContain('data-testid="dashboard-alertes"');
  });

  it('should render KPIs, trend chart and equipements board for a RESPONSABLE', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    setHappyPathMocks();

    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="dashboard-responsable-page"');
    expect(html).toContain('data-testid="dashboard-kpis"');
    expect(html).toContain('data-testid="kpi-conformite"');
    expect(html).toContain('data-testid="kpi-alertes"');
    expect(html).toContain('data-testid="kpi-manquants"');
    expect(html).toContain('data-testid="kpi-boutiques"');
    expect(html).toContain('data-testid="dashboard-trend"');
    expect(html).toContain('data-testid="dashboard-board-section"');
    expect(html).toContain('data-testid="dashboard-refresh"');
    expect(html).toContain('87 %');
  });

  it('should hide boutique selector when accessible boutiques count is below threshold', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    setHappyPathMocks({
      boutiques: [{ id: 'b1', nom: 'MG Paris 11', ville: 'Paris' }],
      accessible: ['b1'],
    });

    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).not.toContain('data-testid="dashboard-boutique-selector"');
  });

  it('should display boutique selector when viewer has at least 2 boutiques', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    setHappyPathMocks({
      boutiques: [
        { id: 'b1', nom: 'MG Paris 11', ville: 'Paris' },
        { id: 'b2', nom: 'MG Lyon 03', ville: 'Lyon' },
      ],
      accessible: ['b1', 'b2'],
    });

    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="dashboard-boutique-selector"');
    expect(html).toContain('data-testid="dashboard-boutique-select"');
    expect(html).toContain('MG Paris 11 - Paris');
    expect(html).toContain('MG Lyon 03 - Lyon');
  });

  it('should redirect to /dashboard when boutiqueId query is out of viewer scope', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(permissions.getAccessibleBoutiqueIds).mockResolvedValue(['b1']);

    await expect(
      DashboardPage({
        searchParams: Promise.resolve({
          boutiqueId: '00000000-0000-0000-0000-000000000999',
        }),
      })
    ).rejects.toThrow('__REDIRECT__:/dashboard');
  });

  it('should render empty alertes block when there is no alert', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    setHappyPathMocks({ alertes: [] });

    const element = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="dashboard-alertes-empty"');
    expect(html).toContain('Aucune alerte ouverte.');
  });
});
