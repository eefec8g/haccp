import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { BoutiqueForm } from '@/components/features/admin/BoutiqueForm';

export const metadata: Metadata = {
  title: 'Nouvelle boutique - Administration HACCP',
};

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5A6A85] transition-colors hover:bg-[#F6F9FC] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

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
      <section className="rounded-[7px] border border-[#DFE5EF] bg-white p-6">
        <BoutiqueForm mode="create" />
      </section>
    </div>
  );
}
