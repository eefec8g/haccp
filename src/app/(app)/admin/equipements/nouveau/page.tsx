import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { EquipementForm } from '@/components/features/admin/EquipementForm';
import { listBoutiques } from '@/lib/services/boutique.service';

export const metadata: Metadata = {
  title: 'Nouvel equipement - Administration HACCP',
};

interface AdminEquipementNouveauPageProps {
  readonly searchParams: Promise<{
    readonly boutiqueId?: string;
  }>;
}

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

/**
 * Page de creation d'un equipement (Server Component, US-ADM-002).
 *
 * Auth + role ADMIN deja verifies par le layout parent. Si `boutiqueId`
 * est present en query string ET correspond a une boutique active, on
 * pre-selectionne dans le formulaire. Sinon l'admin choisira lui-meme.
 */
export default async function AdminEquipementNouveauPage({
  searchParams,
}: AdminEquipementNouveauPageProps) {
  const resolvedParams = await searchParams;
  const boutiquesResult = await listBoutiques({
    query: { page: 1, pageSize: 200 },
  });
  const boutiques = boutiquesResult.items;
  const defaultBoutiqueId =
    resolvedParams.boutiqueId &&
    boutiques.some((b) => b.id === resolvedParams.boutiqueId)
      ? resolvedParams.boutiqueId
      : undefined;

  return (
    <div data-testid="admin-equipement-nouveau-page">
      <AdminPageHeader
        title="Nouvel equipement"
        subtitle="Ajouter un equipement frigorifique a une boutique."
        actions={
          <Link
            href={'/admin/equipements' as Route}
            className={BACK_LINK_CLASSES}
            data-testid="equipement-back-link"
          >
            Retour a la liste
          </Link>
        }
      />
      <section className="border border-mg-noir/10 bg-mg-ivoire p-8">
        <EquipementForm
          mode="create"
          boutiques={boutiques}
          defaultBoutiqueId={defaultBoutiqueId}
        />
      </section>
    </div>
  );
}
