import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canManageAlertes } from '@/lib/permissions';
import { getReleveById } from '@/lib/services/releve.service';
import { AnnulerReleveForm } from '@/components/features/releves/AnnulerReleveForm';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';

const LOGIN_PATH: Route = '/login';
const HISTORIQUE_PATH: Route = '/releves/historique';
const SECTION_CLASSES = 'px-6 py-10 sm:px-10';

interface AnnulerReleveePageProps {
  readonly params: Promise<{ readonly releveId: string }>;
}

/**
 * Metadonnees dynamiques de la page d'annulation : on prefetch le releve
 * uniquement pour recuperer le nom de l'equipement et le mettre dans le
 * title (UX onglets navigateur). Si le releve est introuvable on retombe
 * sur un title generique (la page elle-meme fera `notFound()`).
 */
export async function generateMetadata({
  params,
}: AnnulerReleveePageProps): Promise<Metadata> {
  const { releveId } = await params;
  const session = await auth();
  if (!session?.user) {
    return {
      title: 'Annuler un releve - HACCP Maison Givre',
      robots: { index: false, follow: false },
    };
  }
  const result = await getReleveById({
    viewer: { id: session.user.id, role: session.user.role },
    releveId,
  });
  if (!result.success) {
    return {
      title: 'Annuler un releve - HACCP Maison Givre',
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `Annuler le releve - ${result.data.equipementNom}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Page d'annulation/correction d'un releve (US-REL-004, RG-IMMU-001).
 *
 * Server Component async :
 *   - Auth check + role RESPONSABLE/ADMIN (redirect /login si non
 *     connecte, notFound() si role insuffisant pour ne pas reveler
 *     l'existence du releve aux salaries).
 *   - Charge le releve via le service (404 si introuvable ou hors scope
 *     boutiques du viewer).
 *   - Si le releve est deja annule, redirect vers l'historique (le
 *     responsable y verra le releve marque comme annule, pas besoin de
 *     query string supplementaire).
 *   - Sinon rend le formulaire client `AnnulerReleveForm`.
 */
export default async function AnnulerRelevePage({
  params,
}: AnnulerReleveePageProps) {
  const { releveId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(LOGIN_PATH);
  }
  const viewer = { id: session.user.id, role: session.user.role };
  if (!canManageAlertes(viewer)) {
    notFound();
  }

  const result = await getReleveById({ viewer, releveId });
  if (!result.success) {
    notFound();
  }

  const releve = result.data;
  if (releve.annule) {
    redirect(HISTORIQUE_PATH);
  }

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="annuler-releve-page"
    >
      <AppPageHeader
        eyebrow="Maison Givre - Correction HACCP"
        title="Annuler un releve"
        subtitle="Le releve original sera conserve en lecture seule pour audit. Vous pouvez optionnellement saisir la valeur correcte de remplacement."
        testId="annuler-releve-header"
      />
      <section className={SECTION_CLASSES}>
        <AnnulerReleveForm releve={releve} cancelHref={HISTORIQUE_PATH} />
      </section>
    </main>
  );
}
