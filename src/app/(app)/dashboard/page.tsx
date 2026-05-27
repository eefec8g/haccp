import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  canManageAlertes,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  buildAlertesTrend,
  computeResponsableKpis,
  listMissingReleves,
} from '@/lib/services/dashboard.service';
import { listAlertesOuvertes } from '@/lib/services/alerte.service';
import { getBoutiquesByIds } from '@/lib/services/boutique.service';
import { dashboardQuerySchema } from '@/lib/validations/dashboard';
import {
  DASHBOARD_ALERT_DISPLAY_LIMIT,
  DASHBOARD_TREND_DAYS,
} from '@/lib/constants/dashboard';
import { formatDateShort, todayParisISO } from '@/lib/utils/dates';
import {
  MG_EYEBROW_CLASSES,
  MG_GHOST_BUTTON_CLASSES,
} from '@/lib/constants/styles';
import { logger } from '@/lib/logger';
import type {
  MissingReleveEntry,
  ResponsableDashboardKpis,
  TrendPoint,
} from '@/types/dashboard';
import type { AlerteListItem } from '@/lib/services/alerte.service';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { KpisGrid } from '@/components/features/dashboard/KpisGrid';
import { KpiCard } from '@/components/features/dashboard/KpiCard';
import { MissingReleveTable } from '@/components/features/dashboard/MissingReleveTable';
import { RefreshButton } from '@/components/features/dashboard/RefreshButton';
import { TrendChart } from '@/components/features/dashboard/TrendChart';
import { DashboardAlertesSection } from '@/components/features/dashboard/DashboardAlertesSection';

/**
 * Page `/dashboard` (US-DAS-001) - Dashboard Responsable.
 *
 * Server Component async. Acces : RESPONSABLE + ADMIN (defense en
 * profondeur). SALARIE est redirige vers `/releves` (la route reste
 * decouvrable dans la nav, mais le redirect filtre les acces non
 * autorises).
 *
 * Decisions Epic :
 *   - Pas de cache (temps reel) -> `dynamic = 'force-dynamic'`.
 *   - Selector boutique optionnel (?boutiqueId=...) avec scope strict.
 *   - 4 KPIs cles + tendance 7j + alertes recentes + saisies manquantes.
 *
 * Le rendu reste 100% Server Component a l'exception de `TrendChart`
 * (`'use client'` impose par recharts). Next.js code-splitte automati-
 * quement le bundle recharts cote client (le RSC payload n'embarque
 * pas recharts), donc pas besoin de `next/dynamic` ici (interdit en
 * Server Component avec `ssr: false` en Next 15).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface DashboardSearchParams {
  readonly boutiqueId?: string;
  readonly dateISO?: string;
}

interface DashboardPageProps {
  readonly searchParams: Promise<DashboardSearchParams>;
}

const BACK_HREF: Route = '/releves';
const ALERTES_HREF: Route = '/alertes';
const SALARIE_REDIRECT: Route = '/releves';
const LOGIN_REDIRECT: Route = '/login';
const DASHBOARD_HREF: Route = '/dashboard';
const PAGE_EYEBROW = 'Maison Givre HACCP';
const PAGE_TITLE = 'Dashboard';
const ALERT_PAGINATION = { page: 1, pageSize: DASHBOARD_ALERT_DISPLAY_LIMIT };
const MIN_BOUTIQUES_FOR_SELECTOR = 2;
const TREND_TITLE = `Alertes ${DASHBOARD_TREND_DAYS} derniers jours`;

const SECTION_CLASSES =
  'mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10';
const SELECTOR_FORM_CLASSES = 'flex flex-wrap items-end gap-3';
const SELECTOR_LABEL_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70';
const SELECTOR_SELECT_CLASSES =
  'border border-mg-noir/15 bg-transparent px-3 py-2 text-sm font-light text-mg-noir focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or';

interface BoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

interface DashboardData {
  readonly kpis: ResponsableDashboardKpis;
  readonly missing: readonly MissingReleveEntry[];
  readonly alertes: readonly AlerteListItem[];
  readonly trend: readonly TrendPoint[];
  readonly boutiques: readonly BoutiqueOption[];
}

const EMPTY_KPIS: ResponsableDashboardKpis = {
  tauxConformiteJour: 0,
  alertesOuvertesCount: 0,
  relevesManquantsJourCount: 0,
  boutiquesCount: 0,
};

/**
 * Resout le filtre `boutiqueId` : si invalide ou hors scope viewer, on
 * retourne `'INVALID'` (le caller redirige vers `/dashboard` sans filtre).
 */
async function resolveBoutiqueFilter(
  viewer: SessionUser,
  raw: string | undefined
): Promise<string | null | 'INVALID'> {
  if (!raw) {
    return null;
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  return accessible.includes(raw) ? raw : 'INVALID';
}

async function loadDashboardData({
  viewer,
  boutiqueId,
  dateISO,
}: {
  readonly viewer: SessionUser;
  readonly boutiqueId: string | null;
  readonly dateISO: string;
}): Promise<DashboardData> {
  const scopeArgs = { viewer, boutiqueId: boutiqueId ?? undefined };
  const [kpisResult, missingResult, alertesResult, trendResult, accessibleIds] =
    await Promise.all([
      computeResponsableKpis({ ...scopeArgs, dateISO }),
      listMissingReleves({ ...scopeArgs, dateISO }),
      listAlertesOuvertes({ viewer, pagination: ALERT_PAGINATION }),
      buildAlertesTrend(scopeArgs),
      getAccessibleBoutiqueIds(viewer),
    ]);
  const boutiques = await getBoutiquesByIds(accessibleIds);
  return {
    kpis: kpisResult.success ? kpisResult.data : EMPTY_KPIS,
    missing: missingResult.success ? missingResult.data : [],
    alertes: alertesResult.items,
    trend: trendResult.success ? trendResult.data : [],
    boutiques,
  };
}

function buildDashboardHref(boutiqueId: string | null): Route {
  return (
    boutiqueId ? `/dashboard?boutiqueId=${boutiqueId}` : '/dashboard'
  ) as Route;
}

function buildBoutiqueLabel(boutique: BoutiqueOption): string {
  return boutique.ville ? `${boutique.nom} - ${boutique.ville}` : boutique.nom;
}

interface BoutiqueSelectorProps {
  readonly boutiques: readonly BoutiqueOption[];
  readonly currentBoutiqueId: string | null;
}

function BoutiqueSelector({
  boutiques,
  currentBoutiqueId,
}: BoutiqueSelectorProps) {
  return (
    <form
      action={DASHBOARD_HREF}
      method="get"
      className={SELECTOR_FORM_CLASSES}
      data-testid="dashboard-boutique-selector"
    >
      <label htmlFor="dashboard-boutique" className={SELECTOR_LABEL_CLASSES}>
        Boutique
      </label>
      <select
        id="dashboard-boutique"
        name="boutiqueId"
        defaultValue={currentBoutiqueId ?? ''}
        className={SELECTOR_SELECT_CLASSES}
        data-testid="dashboard-boutique-select"
        aria-label="Filtrer par boutique"
      >
        <option value="">Toutes les boutiques</option>
        {boutiques.map((boutique) => (
          <option key={boutique.id} value={boutique.id}>
            {buildBoutiqueLabel(boutique)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className={MG_GHOST_BUTTON_CLASSES}
        data-testid="dashboard-boutique-submit"
      >
        Appliquer
      </button>
    </form>
  );
}

export default async function DashboardResponsablePage({
  searchParams,
}: DashboardPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect(LOGIN_REDIRECT);
  }

  const viewer: SessionUser = {
    id: session.user.id,
    role: session.user.role,
  };
  if (!canManageAlertes(viewer)) {
    redirect(SALARIE_REDIRECT);
  }

  const raw = await searchParams;
  const parsed = dashboardQuerySchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('[dashboard] invalid query params', {
      userId: viewer.id,
      keys: Object.keys(raw),
    });
  }
  const queryBoutiqueId = parsed.success ? parsed.data.boutiqueId : undefined;
  const queryDateISO = parsed.success ? parsed.data.dateISO : undefined;

  const filter = await resolveBoutiqueFilter(viewer, queryBoutiqueId);
  if (filter === 'INVALID') {
    redirect(DASHBOARD_HREF);
  }

  const todayISO = queryDateISO ?? todayParisISO();
  const data = await loadDashboardData({
    viewer,
    boutiqueId: filter,
    dateISO: todayISO,
  });

  const subtitle = `Conformite HACCP du ${formatDateShort(todayISO)}`;
  const currentHref = buildDashboardHref(filter);
  const showSelector = data.boutiques.length >= MIN_BOUTIQUES_FOR_SELECTOR;

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="dashboard-responsable-page"
    >
      <AppPageHeader
        eyebrow={PAGE_EYEBROW}
        title={PAGE_TITLE}
        subtitle={subtitle}
        backHref={BACK_HREF}
        backLabel="Mes releves"
        testId="dashboard-header"
      >
        <RefreshButton href={currentHref} testId="dashboard-refresh" />
      </AppPageHeader>
      <section className={SECTION_CLASSES}>
        {showSelector ? (
          <BoutiqueSelector
            boutiques={data.boutiques}
            currentBoutiqueId={filter}
          />
        ) : null}

        <KpisGrid testId="dashboard-kpis">
          <KpiCard
            title="Conformite jour"
            value={`${data.kpis.tauxConformiteJour} %`}
            description="Releves saisis sur le total attendu."
            testId="kpi-conformite"
          />
          <KpiCard
            title="Alertes ouvertes"
            value={data.kpis.alertesOuvertesCount}
            description="A traiter sans delai."
            href={ALERTES_HREF}
            testId="kpi-alertes"
          />
          <KpiCard
            title="Saisies manquantes"
            value={data.kpis.relevesManquantsJourCount}
            description="Creneaux jour non encore saisis."
            href={'/dashboard#missing' as Route}
            testId="kpi-manquants"
          />
          <KpiCard
            title="Boutiques"
            value={data.kpis.boutiquesCount}
            description="Sites surveilles dans votre perimetre."
            testId="kpi-boutiques"
          />
        </KpisGrid>

        <TrendChart
          data={data.trend}
          title={TREND_TITLE}
          testId="dashboard-trend"
        />

        <DashboardAlertesSection
          alertes={data.alertes}
          title="Alertes recentes"
          emptyMessage="Aucune alerte ouverte."
          testId="dashboard-alertes"
        />

        <section
          id="missing"
          className="flex flex-col gap-4"
          data-testid="dashboard-missing-section"
          aria-label="Saisies manquantes du jour"
        >
          <h2 className={MG_EYEBROW_CLASSES}>Saisies manquantes du jour</h2>
          <MissingReleveTable
            entries={data.missing}
            testId="dashboard-missing-table"
          />
        </section>
      </section>
    </main>
  );
}
