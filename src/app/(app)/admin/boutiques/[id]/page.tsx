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
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';
const STATUS_ACTIVE_CLASSES = `${BADGE_BASE} border-mg-or/40 text-mg-or`;
const STATUS_INACTIVE_CLASSES = `${BADGE_BASE} border-mg-noir/20 text-mg-noir/50`;

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

      <section className="border border-mg-noir/10 bg-mg-ivoire p-8">
        <BoutiqueForm mode="edit" boutique={boutique} />
      </section>
    </div>
  );
}
