import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Creneau } from '@prisma/client';
import { auth } from '@/lib/auth';
import { loadTourneeStatus } from '@/lib/services/tournee.service';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { formatDateShort } from '@/lib/utils/dates';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { TourneeGuidedFlow } from '@/components/features/tournee/TourneeGuidedFlow';

/**
 * Page tournee guidee (feat/tournee-guidee).
 *
 * Server Component async qui charge le statut de la tournee pour un
 * creneau donne et rend `<TourneeGuidedFlow>` (Client) avec les props
 * derivees du service.
 *
 * Securite :
 *   - auth() : redirect /login si pas de session.
 *   - Validation du segment dynamique `creneau` (enum Prisma).
 *   - Scope boutique enforce dans `loadTourneeStatus` (defense en
 *     profondeur, getAccessibleBoutiqueIds).
 *
 * Cas multi-boutiques :
 *   - SALARIE : sa boutique unique.
 *   - RESPONSABLE / ADMIN avec plusieurs boutiques : le caller doit
 *     fournir `?boutiqueId=...` (sinon BOUTIQUE_NOT_FOUND -> message UX
 *     explicite "Selectionnez une boutique").
 */

export const dynamic = 'force-dynamic';

interface TourneePageParams {
  readonly creneau: string;
}

interface TourneePageSearchParams {
  readonly boutiqueId?: string;
}

interface TourneePageProps {
  readonly params: Promise<TourneePageParams>;
  readonly searchParams: Promise<TourneePageSearchParams>;
}

const LOGIN_PATH = '/login';
const HEADER_EYEBROW = 'Maison Givre HACCP';
const ERROR_SELECT_BOUTIQUE_MESSAGE =
  'Selectionnez une boutique pour demarrer la tournee.';

function isCreneau(value: string): value is Creneau {
  return value in Creneau;
}

export async function generateMetadata({
  params,
}: TourneePageProps): Promise<Metadata> {
  const { creneau } = await params;
  const label = isCreneau(creneau) ? CRENEAU_LABELS[creneau] : 'Tournee';
  return {
    title: `Tournee ${label} - HACCP Maison Givre`,
    robots: { index: false, follow: false },
  };
}

interface ErrorViewProps {
  readonly title: string;
  readonly message: string;
  readonly testId: string;
}

function ErrorView({ title, message, testId }: ErrorViewProps) {
  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid={testId}>
      <AppPageHeader
        eyebrow={HEADER_EYEBROW}
        title={title}
        testId="tournee-page-header"
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <section className="mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <p className="border border-mg-or/40 bg-mg-or/5 px-6 py-8 text-center text-sm font-light text-mg-noir">
          {message}
        </p>
      </section>
    </main>
  );
}

export default async function TourneePage({
  params,
  searchParams,
}: TourneePageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect(LOGIN_PATH);
  }

  const { creneau } = await params;
  if (!isCreneau(creneau)) {
    notFound();
  }

  const { boutiqueId } = await searchParams;

  const result = await loadTourneeStatus({
    viewer: { id: session.user.id, role: session.user.role },
    creneau,
    boutiqueId,
  });

  if (!result.success) {
    if (result.error === 'BOUTIQUE_NOT_FOUND') {
      return (
        <ErrorView
          title={`Tournee ${CRENEAU_LABELS[creneau]}`}
          message={ERROR_SELECT_BOUTIQUE_MESSAGE}
          testId="tournee-page-no-boutique"
        />
      );
    }
    if (result.error === 'FORBIDDEN') {
      notFound();
    }
    return (
      <ErrorView
        title={`Tournee ${CRENEAU_LABELS[creneau]}`}
        message="Une erreur est survenue. Merci de reessayer dans quelques instants."
        testId="tournee-page-error"
      />
    );
  }

  const subtitle = `${result.data.boutiqueNom} - ${formatDateShort(result.data.dateISO)}`;

  return (
    <main className="min-h-screen bg-mg-ivoire" data-testid="tournee-page">
      <AppPageHeader
        eyebrow={HEADER_EYEBROW}
        title={`Tournee ${CRENEAU_LABELS[creneau]}`}
        subtitle={subtitle}
        backHref="/dashboard"
        backLabel="Dashboard"
        testId="tournee-page-header"
      />
      <section className="mx-auto max-w-4xl px-6 py-10 sm:px-10">
        <TourneeGuidedFlow
          boutiqueId={result.data.boutiqueId}
          boutiqueNom={result.data.boutiqueNom}
          dateISO={result.data.dateISO}
          creneau={result.data.creneau}
          equipements={result.data.equipements}
          releves={result.data.releves}
          signature={result.data.signature}
        />
      </section>
    </main>
  );
}
