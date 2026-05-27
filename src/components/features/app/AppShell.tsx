import type { ReactNode } from 'react';
import type { UserRole } from '@prisma/client';
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
 *     client) et passe en prop a l'unique boundary client
 *     `AppMobileNavButton`.
 *   - Bundle JS reduit : seul le FAB hydrate.
 *
 * Pas de wrapper visuel autour de children : volontaire, pour ne pas
 * casser les pages qui prennent la pleine largeur (registre PDF preview,
 * boutiques admin, etc.).
 */
export function AppShell({ viewerRole, children }: AppShellProps) {
  return (
    <>
      {children}
      <AppMobileNavButton viewerRole={viewerRole} />
    </>
  );
}
