'use client';

import type { ReactNode } from 'react';
import type { UserRole } from '@prisma/client';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './AppSidebar';

interface AppShellClientGateProps {
  readonly viewerRole: UserRole;
  readonly children: ReactNode;
}

/**
 * Gate de visibilite client pour la sidebar `(app)` et son decalage
 * `lg:pl-64` (fix/app-sidebar).
 *
 * Pourquoi un Client Component ?
 *   - Le route group `(app)` englobe `(app)/admin/*` qui possede deja son
 *     propre `AdminLayout` avec `AdminSidebar` + decalage `lg:pl-64`.
 *     Sans gate, on aurait deux sidebars empilees et un padding-left
 *     double (256 + 256 = 512px) qui casse la mise en page admin.
 *   - Le middleware Next.js n'injecte pas de header `x-pathname`, donc
 *     impossible de lire la route cote server dans `AppShell`. On utilise
 *     `usePathname()` client. Cout : un seul Client Component fin qui
 *     wrap la sidebar + le wrapper de padding ; les pages enfants restent
 *     entierement server-rendered.
 *
 * Comportement :
 *   - Sur `/admin/*` : ne rend NI sidebar NI wrapper `lg:pl-64`. Les
 *     enfants sont rendus inline pour que `AdminLayout` applique son
 *     propre layout sans interference.
 *   - Sinon : rend `<AppSidebar>` + wrap les enfants dans `lg:pl-64`
 *     pour decaler le main du contenu de la sidebar w-64.
 *
 * Note : aucun `data-testid` racine ici, le gate est invisible. On
 * delegue les testid aux composants enfants (`app-sidebar`).
 */
export function AppShellClientGate({
  viewerRole,
  children,
}: AppShellClientGateProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <AppSidebar viewerRole={viewerRole} />
      <div className="lg:pl-64">{children}</div>
    </>
  );
}
