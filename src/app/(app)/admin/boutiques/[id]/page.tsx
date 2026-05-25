import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { BoutiqueForm } from '@/components/features/admin/BoutiqueForm';
import { BoutiqueToggleActiveButton } from '@/components/features/admin/BoutiqueToggleActiveButton';
import { getBoutiqueById } from '@/lib/services/boutique.service';

export const metadata: Metadata = {
  title: 'Detail boutique - Administration HACCP',
};

interface AdminBoutiqueDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5A6A85] transition-colors hover:bg-[#F6F9FC] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const STATUS_ACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#E6FBF6] px-3 py-1 text-xs font-semibold text-[#0F9F86]';
const STATUS_INACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#F1F4F9] px-3 py-1 text-xs font-semibold text-[#5A6A85]';

/**
 * Page de detail / edition d'une boutique (Server Component).
 *
 * Le layout parent garantit auth + role ADMIN. Si l'id ne resoud pas
 * a une boutique existante on declenche `notFound()` (404 propre via
 * Next.js, sans leak d'information).
 */
export default async function AdminBoutiqueDetailPage({
  params,
}: AdminBoutiqueDetailPageProps) {
  const { id } = await params;
  const result = await getBoutiqueById(id);
  if (!result.success) {
    notFound();
  }

  const boutique = result.data;
  const subtitleParts = [boutique.ville, boutique.adresse].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );
  const subtitle =
    subtitleParts.length > 0
      ? subtitleParts.join(' - ')
      : 'Aucune adresse renseignee';

  return (
    <div data-testid={`admin-boutique-detail-${boutique.id}`}>
      <AdminPageHeader
        title={boutique.nom}
        subtitle={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                boutique.actif ? STATUS_ACTIVE_CLASSES : STATUS_INACTIVE_CLASSES
              }
              data-testid="boutique-status"
            >
              {boutique.actif ? 'Actif' : 'Inactif'}
            </span>
            <Link
              href={'/admin/boutiques' as Route}
              className={BACK_LINK_CLASSES}
              data-testid="boutique-back-link"
            >
              Retour a la liste
            </Link>
            <BoutiqueToggleActiveButton
              boutiqueId={boutique.id}
              boutiqueNom={boutique.nom}
              actif={boutique.actif}
            />
          </div>
        }
      />

      <section className="rounded-[7px] border border-[#DFE5EF] bg-white p-6">
        <BoutiqueForm mode="edit" boutique={boutique} />
      </section>
    </div>
  );
}
