import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';
import type { TypeEquipement } from '@prisma/client';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { EquipementForm } from '@/components/features/admin/EquipementForm';
import { EquipementToggleActiveButton } from '@/components/features/admin/EquipementToggleActiveButton';
import { getEquipementById } from '@/lib/services/equipement.service';
import { listBoutiques } from '@/lib/services/boutique.service';
import { formatDateShort, isoFromDate } from '@/lib/utils/dates';

export const metadata: Metadata = {
  title: 'Detail equipement - Administration HACCP',
};

interface AdminEquipementDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';
const STATUS_ACTIVE_CLASSES = `${BADGE_BASE} border-mg-or/40 text-mg-or`;
const STATUS_INACTIVE_CLASSES = `${BADGE_BASE} border-mg-noir/20 text-mg-noir/50`;

const TYPE_LABELS: Readonly<Record<TypeEquipement, string>> = {
  CONGELATEUR: 'Congelateur',
  VITRINE: 'Vitrine refrigeree',
  CHAMBRE_FROIDE: 'Chambre froide',
  AUTRE: 'Autre',
} as const;

/**
 * Page de detail / edition d'un equipement (Server Component, US-ADM-002).
 *
 * Le layout parent garantit auth + role ADMIN. Si l'id ne resoud pas a
 * un equipement existant on declenche `notFound()` (404 propre).
 */
export default async function AdminEquipementDetailPage({
  params,
}: AdminEquipementDetailPageProps) {
  const { id } = await params;
  const result = await getEquipementById(id);
  if (!result.success) {
    notFound();
  }
  const equipement = result.data;

  // Pour l'edition, on autorise potentiellement la reaffectation a une
  // autre boutique active : on charge donc la liste des boutiques actives.
  const boutiquesResult = await listBoutiques({
    query: { page: 1, pageSize: 200 },
  });
  const boutiques = boutiquesResult.items;

  const dateMiseEnServiceLabel = formatDateShort(
    isoFromDate(equipement.dateMiseEnService)
  );
  const subtitle = `${TYPE_LABELS[equipement.type]} - ${equipement.seuilMin}°C / ${equipement.seuilMax}°C - En service depuis le ${dateMiseEnServiceLabel}`;

  return (
    <div data-testid={`admin-equipement-detail-${equipement.id}`}>
      <AdminPageHeader
        title={equipement.nom}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                equipement.actif
                  ? STATUS_ACTIVE_CLASSES
                  : STATUS_INACTIVE_CLASSES
              }
              data-testid="equipement-status"
            >
              {equipement.actif ? 'Actif' : 'Inactif'}
            </span>
            <Link
              href={'/admin/equipements' as Route}
              className={BACK_LINK_CLASSES}
              data-testid="equipement-back-link"
            >
              Retour a la liste
            </Link>
            <EquipementToggleActiveButton
              equipementId={equipement.id}
              equipementNom={equipement.nom}
              actif={equipement.actif}
            />
          </div>
        }
      />

      <section className="border border-mg-noir/10 bg-mg-ivoire p-8">
        <EquipementForm
          mode="edit"
          equipement={equipement}
          boutiques={boutiques}
        />
      </section>
    </div>
  );
}
