import type { ReactNode } from 'react';
import type { UserRole } from '@prisma/client';
import { AppSidebar } from './AppSidebar';
import { AppMobileNavButton } from './AppMobileNavButton';

interface AppShellProps {
  readonly viewerRole: UserRole;
  readonly children: ReactNode;
}

/**
 * Shell transversal UNIFIE pour le route group `(app)` (Server
 * Component, refactor/unified-sidebar).
 *
 * Render strategy :
 *   - `<AppSidebar>` : sidebar desktop unifiee (Server Component) rendue
 *     PARTOUT, y compris sur `/admin/*`. L'ancien `AppShellClientGate`
 *     qui la masquait sur `/admin` (au profit de l'`AdminLayout`) est
 *     supprime : il n'y a plus qu'une seule sidebar.
 *   - Wrapper `lg:pl-64` : decale le main de la largeur de la sidebar
 *     sur lg+, applique uniformement (plus de cas particulier admin).
 *   - `<AppMobileNavButton>` : overlay mobile-only (FAB) qui ouvre le
 *     drawer plein-ecran avec les memes groupes filtres par role.
 *
 * Pourquoi Server Component ?
 *   - Plus aucun hook de routing ici (le gate client a disparu). Le role
 *     est lu server-side (no leak de session client) et passe en prop a
 *     la sidebar et au FAB. Seuls les liens individuels hydratent pour
 *     calculer leur etat actif.
 */
export function AppShell({ viewerRole, children }: AppShellProps) {
  return (
    <>
      <AppSidebar viewerRole={viewerRole} />
      <div className="lg:pl-64">{children}</div>
      <AppMobileNavButton viewerRole={viewerRole} />
    </>
  );
}
