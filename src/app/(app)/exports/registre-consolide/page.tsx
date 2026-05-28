import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/prisma';
import {
  canExport,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import {
  MILLIS_PER_DAY,
  parseISODateUtc,
  todayParisISO,
} from '@/lib/utils/dates';
import { resolveExportConsolideErrorMessage } from '@/lib/utils/export-consolide-error-messages';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { ExportConsolideForm } from '@/components/features/exports/ExportConsolideForm';
import { MAX_PERIODE_DAYS } from '@/lib/constants/export-consolide';

/**
 * Page `/exports/registre-consolide` (Epic REGISTRE US-REG-001).
 *
 * Server Component qui rend le formulaire d'export "Registre journalier
 * consolide". Le submit GET file directement vers
 * `/api/exports/registre-consolide` (Route Handler) qui repond avec un
 * Content-Disposition attachment pour declencher le download natif.
 *
 * Permissions : RESPONSABLE + ADMIN seulement (canExport). SALARIE est
 * redirige vers /releves (anti-enum, on n'expose pas l'existence de
 * la page).
 *
 * Donnees pre-chargees : liste des boutiques accessibles (le selecteur
 * client a une option "Toutes mes boutiques" par defaut).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Exports - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const RELEVES_PATH = '/releves' as Route;
const ACTION_URL = '/api/exports/registre-consolide';
const CSV_ACTION_URL = '/api/exports/csv';

/**
 * Borne defensive sur le `findMany` boutiques : un viewer ADMIN couvre
 * potentiellement la totalite des boutiques actives ; on plafonne pour
 * eviter un payload select demesure si la base grossit. Valeur largement
 * au-dessus du besoin reel Maison Givre.
 */
const MAX_BOUTIQUES = 100;

const DEFAULT_RANGE_DAYS = 30;

interface PageProps {
  readonly searchParams: Promise<{
    readonly error?: string;
    readonly retry?: string;
  }>;
}

function computeDefaultDateStart(today: string): string {
  const todayMs = parseISODateUtc(today).getTime();
  const startMs = todayMs - (DEFAULT_RANGE_DAYS - 1) * MILLIS_PER_DAY;
  const start = new Date(startMs);
  const year = start.getUTCFullYear();
  const month = String(start.getUTCMonth() + 1).padStart(2, '0');
  const day = String(start.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function RegistreConsolidePage({
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer: SessionUser = {
    id: session.user.id,
    role: session.user.role,
  };
  if (!canExport(viewer)) {
    redirect(RELEVES_PATH);
  }

  const [boutiqueIds, params] = await Promise.all([
    getAccessibleBoutiqueIds(viewer),
    searchParams,
  ]);

  const boutiques =
    boutiqueIds.length > 0
      ? await db.boutique.findMany({
          where: { id: { in: boutiqueIds }, actif: true },
          orderBy: { nom: 'asc' },
          select: { id: true, nom: true, ville: true },
          take: MAX_BOUTIQUES,
        })
      : [];

  const errorMessage = resolveExportConsolideErrorMessage(
    params.error,
    params.retry
  );

  const today = todayParisISO();
  const defaultDateStart = computeDefaultDateStart(today);

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="export-consolide-page"
    >
      <AppPageHeader
        eyebrow="MAISON GIVRE - HACCP"
        title="Exports"
        subtitle={`Exportez le registre consolide au format PDF ou CSV sur une periode personnalisee (${MAX_PERIODE_DAYS} jours max) pour audit DDPP.`}
        backHref={RELEVES_PATH}
        backLabel="Mes releves"
        testId="export-consolide-header"
      />
      <section className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <ExportConsolideForm
          actionUrl={ACTION_URL}
          csvActionUrl={CSV_ACTION_URL}
          boutiques={boutiques}
          defaultDateStart={defaultDateStart}
          defaultDateEnd={today}
          maxDate={today}
          maxPeriodeDays={MAX_PERIODE_DAYS}
          errorMessage={errorMessage}
        />
      </section>
    </main>
  );
}
