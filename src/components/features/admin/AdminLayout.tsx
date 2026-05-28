import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

interface AdminLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout de la zone admin (Server Component).
 *
 * Verifie la session + le role ADMIN avant de rendre les enfants. Le
 * middleware fait deja une premiere passe mais on garde cette defense
 * en profondeur (server-side, post-hydratation) : aucune information
 * n'est rendue cote client sans auth check.
 *
 * Charte Maison Givre : fond ivoire, texte noir profond, sidebar noire
 * fixe sur lg+, header sticky sobre. Le `<main>` recoit un padding
 * lateral qui compense la sidebar sur lg+.
 */
export async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-mg-ivoire text-mg-noir">
      <AdminSidebar />
      <div className="lg:pl-64">
        <AdminHeader />
        <main
          className="px-6 py-10 lg:px-10"
          data-testid="admin-main"
          aria-label="Contenu administration"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
