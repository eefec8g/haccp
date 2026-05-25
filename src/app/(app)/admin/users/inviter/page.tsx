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
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

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
      <section className="border border-mg-noir/10 bg-mg-ivoire p-8">
        <UserInviteForm boutiques={boutiquesResult.items} />
      </section>
    </div>
  );
}
