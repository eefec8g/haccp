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
import { todayParisISO } from '@/lib/utils/dates';
import { listRelevesForListing } from '@/lib/services/releve-listing.service';
import { releveListingQuerySchema } from '@/lib/validations/releve';
import { MAX_PERIODE_DAYS } from '@/lib/constants/releve-listing';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { ReleveListingForm } from '@/components/features/releves/ReleveListingForm';
import { ReleveListingStats } from '@/components/features/releves/ReleveListingStats';
import { ReleveListingTable } from '@/components/features/releves/ReleveListingTable';
import { Pagination } from '@/components/features/admin/Pagination';
import { ERROR_BOX_CLASSES } from '@/components/features/ui/form-styles';
import type {
  ReleveListingError,
  ReleveListingResult,
} from '@/types/releve-listing';

/**
 * Page `/releves/listing` (Epic LISTING -- Phase 2).
 *
 * Server Component qui rend la page de consultation interactive des
 * releves multi-jours pour RESPONSABLE/ADMIN. Complete les exports CSV/PDF
 * existants en offrant une vue navigable avec filtres + pagination.
 *
 * Permissions : RESPONSABLE + ADMIN seulement (`canExport`). SALARIE est
 * redirige vers /releves (anti-enum -- defense en profondeur, on
 * n'expose pas l'existence de la page sans message d'erreur).
 *
 * Donnees pre-chargees en parallele :
 *   - Boutiques accessibles (selecteur filter).
 *   - Equipements actifs des boutiques scope (selecteur dependant).
 *   - Service `listRelevesForListing` (items + stats + pagination).
 *
 * Decisions Phase 0.5 :
 *   - Periode par defaut 30 jours.
 *   - Affiche TOUT (SAISI/ALERTE/MANQUANT/ANNULE) avec filtres.
 *   - Action "Voir" pointe vers le registre journee correspondante.
 *
 * Le `dynamic = 'force-dynamic'` evite le cache statique : les donnees
 * temps reel (manquants, alertes recentes) doivent toujours refleter
 * l'etat courant.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Listing des releves - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const RELEVES_PATH = '/releves' as Route;
const LISTING_PATH = '/releves/listing';

/**
 * Borne defensive sur le `findMany` boutiques+equipements : un ADMIN
 * couvre potentiellement la totalite du parc. Aligne sur la valeur de
 * `/exports/registre-consolide`.
 */
const MAX_BOUTIQUES = 100;
const MAX_EQUIPEMENTS = 500;

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface PageData {
  readonly boutiques: readonly { id: string; nom: string }[];
  readonly equipements: readonly {
    id: string;
    nom: string;
    boutiqueId: string;
  }[];
}

async function loadFiltersData(
  boutiqueIds: readonly string[]
): Promise<PageData> {
  if (boutiqueIds.length === 0) {
    return { boutiques: [], equipements: [] };
  }
  const [boutiques, equipements] = await Promise.all([
    db.boutique.findMany({
      where: { id: { in: [...boutiqueIds] }, actif: true },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true },
      take: MAX_BOUTIQUES,
    }),
    db.equipement.findMany({
      where: { boutiqueId: { in: [...boutiqueIds] }, actif: true },
      orderBy: [{ boutique: { nom: 'asc' } }, { nom: 'asc' }],
      select: { id: true, nom: true, boutiqueId: true },
      take: MAX_EQUIPEMENTS,
    }),
  ]);
  return { boutiques, equipements };
}

const LISTING_ERROR_MESSAGES: Readonly<Record<ReleveListingError, string>> = {
  FORBIDDEN: "Vous n'avez pas la permission d'acceder a ce listing.",
  PERIODE_INVALID:
    'La date de fin doit etre superieure ou egale a la date de debut.',
  PERIODE_TOO_LARGE: `La periode doit etre inferieure ou egale a ${MAX_PERIODE_DAYS} jours.`,
  PERIODE_IN_FUTURE: 'La date de fin ne peut pas etre dans le futur.',
  BOUTIQUE_NOT_FOUND:
    'La boutique selectionnee est introuvable ou hors de votre perimetre.',
  EQUIPEMENT_NOT_FOUND:
    "L'equipement selectionne est introuvable ou hors de votre perimetre.",
  TOO_MANY_RESULTS:
    'Trop de releves pour cette periode/scope. Reduisez la periode ou filtrez par boutique/equipement.',
  INTERNAL: 'Une erreur interne est survenue. Reessayez plus tard.',
};

const ZOD_VALIDATION_MESSAGE =
  'Les filtres saisis sont invalides. Verifiez les dates et les selecteurs.';

interface ResolvedQuery {
  readonly boutiqueId?: string;
  readonly equipementId?: string;
  readonly creneau?: 'MATIN' | 'MIDI' | 'SOIR';
  readonly statut?: 'SAISI' | 'ALERTE' | 'MANQUANT' | 'ANNULE';
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly page: number;
  readonly pageSize: number;
}

interface QueryResolution {
  readonly query: ResolvedQuery;
  readonly errorMessage: string | undefined;
}

function resolveListingQuery(
  raw: Record<string, string | string[] | undefined>
): QueryResolution {
  const parsed = releveListingQuerySchema.safeParse(raw);
  if (parsed.success) {
    return { query: parsed.data, errorMessage: undefined };
  }
  const fallback = releveListingQuerySchema.parse({});
  return { query: fallback, errorMessage: ZOD_VALIDATION_MESSAGE };
}

function buildPaginationBaseHref(query: ResolvedQuery): string {
  const params = new URLSearchParams();
  if (query.boutiqueId) {
    params.set('boutiqueId', query.boutiqueId);
  }
  if (query.equipementId) {
    params.set('equipementId', query.equipementId);
  }
  if (query.creneau) {
    params.set('creneau', query.creneau);
  }
  if (query.statut) {
    params.set('statut', query.statut);
  }
  params.set('dateStart', query.dateStart);
  params.set('dateEnd', query.dateEnd);
  params.set('pageSize', String(query.pageSize));
  return `${LISTING_PATH}?${params.toString()}`;
}

interface ListingBodyProps {
  readonly result: ReleveListingResult;
  readonly query: ResolvedQuery;
}

function ListingBody({ result, query }: ListingBodyProps): React.ReactElement {
  return (
    <>
      <ReleveListingStats stats={result.stats} />
      <ReleveListingTable items={result.items} />
      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={buildPaginationBaseHref(query)}
      />
    </>
  );
}

export default async function ReleveListingPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
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

  const { query, errorMessage: validationError } = resolveListingQuery(params);
  const today = todayParisISO();

  const [{ boutiques, equipements }, serviceResult] = await Promise.all([
    loadFiltersData(boutiqueIds),
    listRelevesForListing({ viewer, query }),
  ]);

  if (!serviceResult.success && serviceResult.error === 'FORBIDDEN') {
    redirect(RELEVES_PATH);
  }

  const serviceError = !serviceResult.success
    ? LISTING_ERROR_MESSAGES[serviceResult.error]
    : undefined;
  const errorMessage = validationError ?? serviceError;

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="releve-listing-page"
    >
      <AppPageHeader
        eyebrow="MAISON GIVRE - HACCP"
        title="Listing des releves"
        subtitle={`Consultez et filtrez les releves de votre perimetre (jusqu'a ${MAX_PERIODE_DAYS} jours).`}
        backHref={RELEVES_PATH}
        backLabel="Mes releves"
        testId="releve-listing-header"
      />
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12 sm:px-10">
        <ReleveListingForm
          boutiques={boutiques}
          equipements={equipements}
          currentQuery={query}
          maxDate={today}
          errorMessage={errorMessage}
        />
        {serviceResult.success ? (
          <ListingBody result={serviceResult.data} query={query} />
        ) : (
          <div
            role="alert"
            aria-live="polite"
            className={ERROR_BOX_CLASSES}
            data-testid="releve-listing-error"
          >
            {serviceError}
          </div>
        )}
      </section>
    </main>
  );
}
