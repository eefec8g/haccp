import type { ReactNode } from 'react';
import type { UserRole } from '@prisma/client';
import { AppDesktopNav } from './AppDesktopNav';
import { AppMobileNavButton } from './AppMobileNavButton';

interface AppShellProps {
  readonly viewerRole: UserRole;
  readonly children: ReactNode;
}

/**
 * Shell transversal pour le route group `(app)` (Server Component, Epic
 * RESPONSIVE).
 *
 * Render strategy :
 *   - `<AppDesktopNav>` : top navigation desktop-only (`hidden md:block`)
 *     qui expose les routes transversales (Listing, Alertes, Dashboard,
 *     Exports, Registre consolide, Admin) filtrees par role. Resout le
 *     manque de nav desktop signale sur `fix/desktop-nav` (les chromes
 *     de page n'avaient pas de lien vers les autres sections).
 *   - `{children}` : on conserve le chrome existant de chaque page
 *     (`TourneeHeader`, `AppPageHeader`, `AdminLayout`). Le shell ne
 *     touche pas a leur layout pour eviter le doublon visuel.
 *   - `<AppMobileNavButton>` : overlay mobile-only (FAB) qui ouvre un
 *     drawer plein-ecran avec les routes filtrees par role. Resout le
 *     finding CRITICAL "Un RESPONSABLE n'a aucun raccourci vers
 *     /alertes, /dashboard, /exports/registre-consolide depuis son
 *     mobile".
 *
 * Pourquoi Server Component ?
 *   - Pas de hooks ici. Le role est lu server-side (no leak de session
 *     client) et passe en prop aux boundaries client (`AppDesktopNavLink`
 *     pour le highlight actif, `AppMobileNavButton` pour le FAB).
 *   - Bundle JS reduit : seuls les liens desktop + le FAB hydratent.
 *
 * Pas de wrapper visuel autour de children : volontaire, pour ne pas
 * casser les pages qui prennent la pleine largeur (registre PDF preview,
 * boutiques admin, etc.).
 */
export function AppShell({ viewerRole, children }: AppShellProps) {
  return (
    <>
      <AppDesktopNav viewerRole={viewerRole} />
      {children}
      <AppMobileNavButton viewerRole={viewerRole} />
    </>
  );
}
