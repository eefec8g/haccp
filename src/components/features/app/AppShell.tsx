import type { ReactNode } from 'react';
import type { UserRole } from '@prisma/client';
import { AppShellClientGate } from './AppShellClientGate';
import { AppMobileNavButton } from './AppMobileNavButton';

interface AppShellProps {
  readonly viewerRole: UserRole;
  readonly children: ReactNode;
}

/**
 * Shell transversal pour le route group `(app)` (Server Component,
 * fix/app-sidebar).
 *
 * Render strategy :
 *   - `<AppShellClientGate>` : Client Component fin qui rend la sidebar
 *     desktop `AppSidebar` + wrapper de padding `lg:pl-64` UNIQUEMENT
 *     hors `/admin/*`. Sur `/admin/*` le gate s'efface pour laisser
 *     `AdminLayout` appliquer son propre layout (AdminSidebar + son
 *     propre `lg:pl-64`) sans doubler la sidebar ni le padding.
 *   - `{children}` : on conserve le chrome existant de chaque page
 *     (`AppPageHeader`, `AdminLayout`). Le shell ne touche pas a leur
 *     layout pour eviter le doublon visuel.
 *   - `<AppMobileNavButton>` : overlay mobile-only (FAB) qui ouvre un
 *     drawer plein-ecran avec les routes filtrees par role. Resout le
 *     finding CRITICAL "Un RESPONSABLE n'a aucun raccourci vers
 *     /alertes, /dashboard, /exports/registre-consolide depuis son
 *     mobile".
 *
 * Pourquoi Server Component ?
 *   - Pas de hooks ici. Le role est lu server-side (no leak de session
 *     client) et passe en prop aux boundaries client (`AppShellClientGate`
 *     pour la visibilite et le highlight actif, `AppMobileNavButton`
 *     pour le FAB).
 *   - Bundle JS reduit : seul le gate + les liens individuels hydratent.
 */
export function AppShell({ viewerRole, children }: AppShellProps) {
  return (
    <>
      <AppShellClientGate viewerRole={viewerRole}>
        {children}
      </AppShellClientGate>
      <AppMobileNavButton viewerRole={viewerRole} />
    </>
  );
}
