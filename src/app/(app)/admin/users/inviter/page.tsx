import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import { UserInviteForm } from '@/components/features/admin/UserInviteForm';
import { listBoutiques } from '@/lib/services/boutique.service';

export const metadata: Metadata = {
  title: 'Inviter un utilisateur - Administration HACCP',
};

const BACK_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5A6A85] transition-colors hover:bg-[#F6F9FC] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

/**
 * Page d'invitation d'un utilisateur (Server Component, US-ADM-003).
 *
 * Auth + role ADMIN deja verifies dans le layout parent. On charge les
 * boutiques actives pour alimenter les selecteurs SALARIE/RESPONSABLE
 * du formulaire ; toute la logique serveur vit dans `inviteUserAction`.
 */
export default async function AdminUserInviterPage() {
  const boutiquesResult = await listBoutiques({
    query: { page: 1, pageSize: 200 },
  });

  return (
    <div data-testid="admin-user-inviter-page">
      <AdminPageHeader
        title="Inviter un utilisateur"
        subtitle="Envoyer un email d'invitation avec lien d'activation."
        actions={
          <Link
            href={'/admin/users' as Route}
            className={BACK_LINK_CLASSES}
            data-testid="user-back-link"
          >
            Retour a la liste
          </Link>
        }
      />
      <section className="rounded-[7px] border border-[#DFE5EF] bg-white p-6">
        <UserInviteForm boutiques={boutiquesResult.items} />
      </section>
    </div>
  );
}
