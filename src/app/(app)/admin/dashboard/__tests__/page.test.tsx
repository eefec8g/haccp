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

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
    'aria-label': ariaLabel,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
    readonly 'aria-label'?: string;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestid}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/services/dashboard.service', () => ({
  computeAdminKpis: vi.fn(),
  buildAlertesTrend: vi.fn(),
}));

vi.mock('@/lib/services/alerte.service', () => ({
  listAlertesOuvertes: vi.fn(),
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  listAuditLogsCompact: vi.fn(),
}));

// TrendChart utilise recharts (DOM/ResizeObserver) : on stubbe en
// composant statique pour des tests rapides et deterministes.
vi.mock('@/components/features/dashboard/TrendChart', () => ({
  TrendChart: ({
    title,
    testId,
  }: {
    readonly title: string;
    readonly testId?: string;
  }) => (
    <div data-testid={testId ?? 'trend-chart'} data-title={title}>
      {title}
    </div>
  ),
}));

import { auth } from '@/lib/auth';
import {
  buildAlertesTrend,
  computeAdminKpis,
} from '@/lib/services/dashboard.service';
import { listAlertesOuvertes } from '@/lib/services/alerte.service';
import { listAuditLogsCompact } from '@/lib/services/audit-log.service';
import AdminDashboardPage from '../page';

/**
 * Tests AdminDashboardPage (US-DAS-002).
 *
 * Couvre :
 *  - redirect /login si pas de session,
 *  - notFound() pour RESPONSABLE et SALARIE (anti-enum URL),
 *  - rendu de la grille KPI complete (6 cards),
 *  - rendu de la section audit log condensee,
 *  - notFound si le service rejette (FORBIDDEN cote couche metier).
 */

const ADMIN_SESSION = {
  user: { id: 'a1', role: 'ADMIN' as const, email: 'a1@mg.test' },
};
const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};
const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

const DEFAULT_KPIS = {
  utilisateursActifs: 12,
  boutiquesActives: 4,
  equipementsActifs: 18,
  alertes7jOuvertes: 3,
  alertes7jResolues: 7,
  tauxConformiteGlobal: 91,
};

function setSuccessfulMocks(): void {
  vi.mocked(computeAdminKpis).mockResolvedValue({
    success: true,
    data: DEFAULT_KPIS,
  });
  vi.mocked(buildAlertesTrend).mockResolvedValue({
    success: true,
    data: [
      { dateISO: '2026-05-20', value: 1 },
      { dateISO: '2026-05-21', value: 0 },
    ],
  });
  vi.mocked(listAlertesOuvertes).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 5,
    totalPages: 0,
  } as any);
  vi.mocked(listAuditLogsCompact).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 5,
    totalPages: 0,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[AdminDashboardPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      AdminDashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__REDIRECT__:/login');
  });

  it('should notFound when user is RESPONSABLE', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    await expect(
      AdminDashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__NOT_FOUND__');
  });

  it('should notFound when user is SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    await expect(
      AdminDashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__NOT_FOUND__');
  });

  it('should render the 6 KPI cards with their values for ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    setSuccessfulMocks();

    const element = await AdminDashboardPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="dashboard-admin-page"');
    expect(html).toContain('data-testid="admin-dashboard-kpis"');
    expect(html).toContain('data-testid="kpi-admin-utilisateurs"');
    expect(html).toContain('data-testid="kpi-admin-boutiques"');
    expect(html).toContain('data-testid="kpi-admin-equipements"');
    expect(html).toContain('data-testid="kpi-admin-alertes-ouvertes"');
    expect(html).toContain('data-testid="kpi-admin-alertes-resolues"');
    expect(html).toContain('data-testid="kpi-admin-conformite"');
    expect(html).toContain('91%');
    expect(html).toContain('href="/admin/users"');
    expect(html).toContain('href="/admin/boutiques"');
    expect(html).toContain('href="/admin/equipements"');
    expect(html).toContain('href="/alertes"');
  });

  it('should render the audit log compact section', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    setSuccessfulMocks();
    vi.mocked(listAuditLogsCompact).mockResolvedValue({
      items: [
        {
          id: 'audit-1',
          action: 'CREATE',
          entityType: 'BOUTIQUE',
          entityId: 'b-1',
          entityLabel: 'MG Lyon',
          performedById: 'u-1',
          performedByName: 'Alice',
          createdAt: new Date('2026-05-26T08:30:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    } as any);

    const element = await AdminDashboardPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="admin-dashboard-audit"');
    expect(html).toContain('Alice');
    expect(html).toContain('MG Lyon');
    expect(html).toContain('href="/admin/audit-log"');
  });

  it('should render the empty state when there are no recent alerts', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    setSuccessfulMocks();

    const element = await AdminDashboardPage({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="admin-dashboard-alertes-empty"');
    expect(html).toMatch(/Aucune alerte ouverte/);
  });

  it('should notFound when computeAdminKpis returns FORBIDDEN', async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(computeAdminKpis).mockResolvedValue({
      success: false,
      error: 'FORBIDDEN',
    });
    vi.mocked(buildAlertesTrend).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(listAlertesOuvertes).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      totalPages: 0,
    } as any);
    vi.mocked(listAuditLogsCompact).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 5,
      totalPages: 0,
    } as any);

    await expect(
      AdminDashboardPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('__NOT_FOUND__');
  });
});
