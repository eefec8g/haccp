import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { BoutiqueForm } from '@/components/features/admin/BoutiqueForm';

export const metadata: Metadata = {
  title: 'Nouvelle boutique - Administration HACCP',
};

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

/**
 * Page de creation d'une boutique (Server Component).
 *
 * Auth + role ADMIN deja verifies dans le layout parent. On rend juste
 * le header + le formulaire ; toute la logique server vit dans
 * `createBoutiqueAction`.
 */
export default function AdminBoutiqueNouvellePage() {
  return (
    <div data-testid="admin-boutique-nouvelle-page">
      <AdminPageHeader
        title="Nouvelle boutique"
        subtitle="Ajouter une boutique au parc Maison Givre."
        actions={
          <Link
            href={'/admin/boutiques' as Route}
            className={BACK_LINK_CLASSES}
            data-testid="boutique-back-link"
          >
            Retour a la liste
          </Link>
        }
      />
      <section className="border border-mg-noir/10 bg-mg-ivoire p-8">
        <BoutiqueForm mode="create" />
      </section>
    </div>
  );
}
