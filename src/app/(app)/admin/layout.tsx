import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Empeche l'indexation des routes /admin par les moteurs de recherche :
 * elles sont protegees par auth() et ne presentent aucun contenu public.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout des routes `/admin/*` (refactor/unified-sidebar).
 *
 * Plus de chrome dedie : la sidebar unifiee + le FAB mobile sont rendus
 * une seule fois par le layout parent `(app)` (`AppShell`). Ce layout ne
 * conserve que deux responsabilites :
 *
 *   1. Garde de role ADMIN (defense en profondeur server-side). Les
 *      pages `/admin/*` (boutiques, equipements, audit-log, ...) ne
 *      re-verifient PAS le role et documentent qu'elles s'appuient sur
 *      ce layout : retirer cette garde ouvrirait l'acces aux RESPONSABLE
 *      / SALARIE. Le middleware filtre deja en amont, on garde la double
 *      barriere conforme au pattern du reste de l'app.
 *   2. Wrapper `<main>` de mise en page (padding + label a11y), qui
 *      remplace l'ancien `<main>` de `AdminLayout` afin que les pages
 *      admin conservent leur gouttiere et leur region semantique sans
 *      dependre d'une sidebar/header admin separes.
 */
export default async function AdminRouteLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <main
      className="px-6 py-10 lg:px-10"
      data-testid="admin-main"
      aria-label="Contenu administration"
    >
      {children}
    </main>
  );
}
