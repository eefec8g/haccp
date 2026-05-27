import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { auth } from '@/lib/auth';
import {
  buildAlertesTrend,
  computeAdminKpis,
} from '@/lib/services/dashboard.service';
import { listAlertesOuvertes } from '@/lib/services/alerte.service';
import { listAuditLogsCompact } from '@/lib/services/audit-log.service';
import { dashboardQuerySchema } from '@/lib/validations/dashboard';
import {
  DASHBOARD_ALERT_DISPLAY_LIMIT,
  DASHBOARD_AUDIT_LOG_LIMIT,
} from '@/lib/constants/dashboard';
import { formatDateShort, todayParisISO } from '@/lib/utils/dates';
import { logger } from '@/lib/logger';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { KpiCard } from '@/components/features/dashboard/KpiCard';
import { KpisGrid } from '@/components/features/dashboard/KpisGrid';
import { TrendChart } from '@/components/features/dashboard/TrendChart';
import { RefreshButton } from '@/components/features/dashboard/RefreshButton';
import { DashboardAlertesSection } from '@/components/features/dashboard/DashboardAlertesSection';
import { AdminAuditLogCompact } from '@/components/features/dashboard/AdminAuditLogCompact';
import type {
  AdminDashboardKpis,
  DashboardError,
  TrendPoint,
} from '@/types/dashboard';
import type { Result } from '@/types/result';
import type { AlerteListItem as AlerteListItemData } from '@/lib/services/alerte.service';
import type { AuditLogCompactItem } from '@/types/audit';

/**
 * Dashboard Admin (US-DAS-002).
 *
 * Server Component dynamique (`force-dynamic`) : pas de cache, lecture
 * temps reel des KPI sur le parc complet (decision Epic).
 *
 * Pipeline :
 *   1. `auth()` -> redirect /login si pas de session.
 *   2. Role ADMIN obligatoire (notFound() = anti-enum URL pour
 *      RESPONSABLE / SALARIE).
 *   3. Parse `searchParams` via `dashboardQuerySchema` (date optionnelle).
 *   4. Fetch parallele : KPIs, alertes recentes, trend 7j, audit log
 *      compact (DTO sans email PII).
 *   5. Erreur service FORBIDDEN -> notFound() (anti-enum) ; INTERNAL ->
 *      throw -> error boundary Next.js (visibilite ops).
 *
 * Le layout `(app)/admin/layout.tsx` fait deja un redirect mais on garde
 * la verification ici (defense en profondeur, le service guard aussi via
 * `canManageParc`).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard Admin - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface AdminDashboardPageProps {
  readonly searchParams: Promise<{
    readonly dateISO?: string;
    readonly boutiqueId?: string;
  }>;
}

interface ResolvedQuery {
  readonly dateISO?: string;
}

interface DashboardData {
  readonly kpis: AdminDashboardKpis;
  readonly alertesRecentes: readonly AlerteListItemData[];
  readonly trend: readonly TrendPoint[];
  readonly auditLog: readonly AuditLogCompactItem[];
}

const ADMIN_BACK_HREF = '/admin' as Route;
const ALERTES_HREF = '/alertes' as Route;
const ADMIN_USERS_HREF = '/admin/users' as Route;
const ADMIN_BOUTIQUES_HREF = '/admin/boutiques' as Route;
const ADMIN_EQUIPEMENTS_HREF = '/admin/equipements' as Route;
const ADMIN_DASHBOARD_HREF = '/admin/dashboard' as Route;

const PAGE_LAYOUT_CLASSES = 'flex flex-col gap-8 px-6 py-8 sm:px-10';

function parseQuery(
  raw: Record<string, string | undefined>,
  userId: string
): ResolvedQuery {
  const parsed = dashboardQuerySchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('[admin-dashboard] invalid query params', {
      userId,
      keys: Object.keys(raw),
    });
    return {};
  }
  return { dateISO: parsed.data.dateISO };
}

async function fetchDashboardData({
  viewerId,
  role,
  dateISO,
}: {
  readonly viewerId: string;
  readonly role: 'ADMIN';
  readonly dateISO?: string;
}): Promise<Result<DashboardData, DashboardError>> {
  const viewer = { id: viewerId, role } as const;
  const [kpis, alertesPage, trend, auditLog] = await Promise.all([
    computeAdminKpis({ viewer, dateISO }),
    listAlertesOuvertes({
      viewer,
      pagination: { page: 1, pageSize: DASHBOARD_ALERT_DISPLAY_LIMIT },
    }),
    buildAlertesTrend({ viewer }),
    listAuditLogsCompact({
      query: { page: 1, pageSize: DASHBOARD_AUDIT_LOG_LIMIT },
    }),
  ]);
  if (!kpis.success) {
    return { success: false, error: kpis.error };
  }
  if (!trend.success) {
    return { success: false, error: trend.error };
  }
  return {
    success: true,
    data: {
      kpis: kpis.data,
      alertesRecentes: alertesPage.items,
      trend: trend.data,
      auditLog: auditLog.items,
    },
  };
}

function buildSubtitle(dateISO: string | undefined): string {
  const targetISO = dateISO ?? todayParisISO();
  return `Parc complet - ${formatDateShort(targetISO)}`;
}

function renderKpis(kpis: AdminDashboardKpis): React.ReactNode {
  return (
    <KpisGrid
      ariaLabel="Indicateurs cles administrateur"
      testId="admin-dashboard-kpis"
    >
      <KpiCard
        title="Utilisateurs actifs"
        value={kpis.utilisateursActifs}
        href={ADMIN_USERS_HREF}
        testId="kpi-admin-utilisateurs"
      />
      <KpiCard
        title="Boutiques actives"
        value={kpis.boutiquesActives}
        href={ADMIN_BOUTIQUES_HREF}
        testId="kpi-admin-boutiques"
      />
      <KpiCard
        title="Equipements actifs"
        value={kpis.equipementsActifs}
        href={ADMIN_EQUIPEMENTS_HREF}
        testId="kpi-admin-equipements"
      />
      <KpiCard
        title="Alertes 7j ouvertes"
        value={kpis.alertes7jOuvertes}
        href={ALERTES_HREF}
        testId="kpi-admin-alertes-ouvertes"
      />
      <KpiCard
        title="Alertes 7j resolues"
        value={kpis.alertes7jResolues}
        testId="kpi-admin-alertes-resolues"
      />
      <KpiCard
        title="Taux conformite global"
        value={`${kpis.tauxConformiteGlobal}%`}
        testId="kpi-admin-conformite"
      />
    </KpisGrid>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    notFound();
  }

  const resolvedParams = await searchParams;
  const { dateISO } = parseQuery(resolvedParams, session.user.id);

  const result = await fetchDashboardData({
    viewerId: session.user.id,
    role: 'ADMIN',
    dateISO,
  });

  if (!result.success) {
    if (result.error === 'FORBIDDEN') {
      notFound();
    }
    throw new Error(`[admin-dashboard] data fetch failed: ${result.error}`);
  }

  const { kpis, alertesRecentes, trend, auditLog } = result.data;
  const subtitle = buildSubtitle(dateISO);

  return (
    <div data-testid="dashboard-admin-page">
      <AppPageHeader
        title="Dashboard Admin"
        eyebrow="MAISON GIVRE - ADMINISTRATION"
        subtitle={subtitle}
        backHref={ADMIN_BACK_HREF}
        backLabel="Espace admin"
        testId="admin-dashboard-header"
      >
        <RefreshButton
          href={ADMIN_DASHBOARD_HREF}
          testId="admin-dashboard-refresh"
        />
      </AppPageHeader>

      <div className={PAGE_LAYOUT_CLASSES}>
        {renderKpis(kpis)}

        <TrendChart
          data={trend}
          title="Alertes 7 derniers jours (toutes boutiques)"
          testId="admin-dashboard-trend"
        />

        <DashboardAlertesSection
          alertes={alertesRecentes}
          title="Alertes recentes"
          emptyMessage="Aucune alerte ouverte. Tout est conforme."
          testId="admin-dashboard-alertes"
        />

        <AdminAuditLogCompact
          entries={auditLog}
          testId="admin-dashboard-audit"
        />
      </div>
    </div>
  );
}
