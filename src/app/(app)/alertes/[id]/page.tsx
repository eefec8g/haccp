import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canManageAlertes } from '@/lib/permissions';
import { getAlerteById } from '@/lib/services/alerte.service';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import { DateCourte } from '@/components/features/releves/DateCourte';
import { CreneauBadge } from '@/components/features/releves/CreneauBadge';
import { ResolutionForm } from '@/components/features/alertes/ResolutionForm';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';

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

const PAGE_TITLE = 'Resoudre une alerte';
const PAGE_SUBTITLE =
  "Documentez la cause et l'action corrective pour l'audit.";

/**
 * Page detail d'une alerte + formulaire de resolution (US-ALE-002).
 *
 * Server Component async :
 *   - Auth + role check (notFound si SALARIE pour ne pas reveler la
 *     page).
 *   - Charge l'alerte (notFound si NOT_FOUND ou hors scope boutique).
 *   - Rend l'entete avec recap rapide (date + creneau + temperature
 *     + boutique) puis ResolutionForm (Client Component minimal pour
 *     useActionState).
 */
export default async function AlerteDetailPage({
  params,
}: AlerteDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const viewer = { id: session.user.id, role: session.user.role };
  if (!canManageAlertes(viewer)) {
    notFound();
  }

  const { id } = await params;
  const result = await getAlerteById({ viewer, alerteId: id });
  if (!result.success) {
    notFound();
  }
  const alerte = result.data;
  const { releve } = alerte;

  return (
    <main
      className="min-h-screen bg-mg-ivoire"
      data-testid="alerte-detail-page"
    >
      <AppPageHeader
        eyebrow={`Maison Givre - ${EQUIPEMENT_TYPE_LABELS[releve.equipementType]}`}
        title={PAGE_TITLE}
        subtitle={PAGE_SUBTITLE}
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
      </section>
    </main>
  );
}
