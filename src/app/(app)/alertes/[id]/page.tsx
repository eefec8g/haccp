import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canManageAlertes } from '@/lib/permissions';
import { getAlerteById } from '@/lib/services/alerte.service';
import { listPhotosForAlerte } from '@/lib/services/photo.service';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import { DateCourte } from '@/components/features/releves/DateCourte';
import { CreneauBadge } from '@/components/features/releves/CreneauBadge';
import { ResolutionForm } from '@/components/features/alertes/ResolutionForm';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { PhotoGallery } from '@/components/features/photos/PhotoGallery';
import { PhotoUploadForm } from '@/components/features/photos/PhotoUploadForm';

export const metadata: Metadata = {
  title: 'Resoudre une alerte - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

interface AlerteDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

const BACK_HREF: Route = '/alertes';
const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const CONTEXT_BAND_CLASSES =
  'mb-8 flex flex-wrap items-center gap-3 text-sm font-light text-mg-noir/70';

const PAGE_TITLE_MANAGE = 'Resoudre une alerte';
const PAGE_TITLE_READ = "Detail de l'alerte";
const PAGE_SUBTITLE_MANAGE =
  "Documentez la cause et l'action corrective pour l'audit.";
const PAGE_SUBTITLE_READ =
  'Consultez le releve hors seuils et les justificatifs.';

/**
 * Page detail d'une alerte (US-ALE-002 + lecture SALARIE).
 *
 * Server Component async :
 *   - Auth check : redirect /login si pas de session.
 *   - Lecture ouverte aux trois roles ; `getAlerteById` borne le scope
 *     boutique via `getAccessibleBoutiqueIds` (notFound si NOT_FOUND ou
 *     hors scope boutique - anti-enum, pas de distinction existe/droit).
 *   - `canManage` (RESPONSABLE/ADMIN) conditionne le formulaire de
 *     resolution et l'upload de photos. Le SALARIE voit le recap + la
 *     galerie en lecture seule, sans action.
 */
export default async function AlerteDetailPage({
  params,
}: AlerteDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer = { id: session.user.id, role: session.user.role };
  const canManage = canManageAlertes(viewer);

  const { id } = await params;
  const [result, photosResult] = await Promise.all([
    getAlerteById({ viewer, alerteId: id }),
    listPhotosForAlerte({ viewer, alerteId: id }),
  ]);
  if (!result.success) {
    notFound();
  }
  const alerte = result.data;
  const { releve } = alerte;
  const photos = photosResult.success ? photosResult.data : [];

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="alerte-detail-page"
    >
      <AppPageHeader
        eyebrow={`Maison Givre - ${EQUIPEMENT_TYPE_LABELS[releve.equipementType]}`}
        title={canManage ? PAGE_TITLE_MANAGE : PAGE_TITLE_READ}
        subtitle={canManage ? PAGE_SUBTITLE_MANAGE : PAGE_SUBTITLE_READ}
        backHref={BACK_HREF}
        backLabel="Retour aux alertes"
        testId="alerte-detail-header"
      />
      <section className={SECTION_CLASSES}>
        <div
          className={CONTEXT_BAND_CLASSES}
          data-testid="alerte-detail-context"
        >
          <DateCourte
            value={releve.dateISO}
            className="font-medium text-mg-noir"
            data-testid="alerte-detail-date"
          />
          <CreneauBadge
            creneau={releve.creneau}
            status="ALERTE"
            data-testid="alerte-detail-creneau"
          />
          <span className="sr-only">{CRENEAU_LABELS[releve.creneau]}</span>
          <span className="font-medium tabular-nums text-mg-noir">
            {releve.temperature.toFixed(1)} degC
          </span>
        </div>
        <div className="mb-10 space-y-6">
          <PhotoGallery
            photos={photos}
            canDelete={canManage}
            alerteId={alerte.id}
            testId="alerte-photo-gallery"
          />
          {canManage ? (
            <PhotoUploadForm
              alerteId={alerte.id}
              currentCount={photos.length}
              testId="alerte-photo-upload"
            />
          ) : null}
        </div>
        {canManage ? (
          <ResolutionForm
            alerteId={alerte.id}
            summary={{
              equipementNom: releve.equipementNom,
              boutiqueNom: releve.boutiqueNom,
              temperature: releve.temperature,
              seuilMin: releve.seuilMin,
              seuilMax: releve.seuilMax,
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
