import type { UserRole } from '@prisma/client';
import { getAppNavItemsForRole } from '@/lib/constants/app-nav';
import { AppDesktopNavLink } from './AppDesktopNavLink';

interface AppDesktopNavProps {
  readonly viewerRole: UserRole;
}

/**
 * Top navigation desktop transversale (Server Component, fix/desktop-nav).
 *
 * Resout le finding manquant cote desktop : les pages `(app)` exposent
 * leur propre chrome (TourneeHeader, AppPageHeader) mais aucune nav
 * transversale n'est visible. L'utilisateur desktop n'avait aucun moyen
 * d'acceder a Listing / Alertes / Dashboard / Exports / Registre
 * consolide sans connaitre l'URL.
 *
 * Pourquoi Server Component ?
 *   - Pas de hooks ni d'evenements ici, juste des `<Link>`. Le
 *     `usePathname()` necessaire au highlight de l'item actif est isole
 *     dans `AppDesktopNavLink` pour reduire le bundle JS.
 *
 * Placement :
 *   - `hidden md:block` : visible >= md (>= 768px). Sur mobile le
 *     `AppMobileNavButton` (FAB) prend le relais.
 *   - `sticky top-0 z-40` : reste accessible en scroll, sous les overlays
 *     modaux (`z-50`).
 *   - `bg-mg-ivoire/95 backdrop-blur` : voile discret pour preserver la
 *     lisibilite sur les pages a hero (registre consolide, dashboard).
 */

const NAV_CLASSES =
  'hidden md:block sticky top-0 z-40 border-b border-mg-noir/10 bg-mg-ivoire/95 backdrop-blur';
const CONTAINER_CLASSES =
  'max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6';
const EYEBROW_CLASSES =
  'text-[10px] uppercase tracking-[0.3em] text-mg-or font-medium';
const LIST_CLASSES = 'flex items-center gap-1';

export function AppDesktopNav({ viewerRole }: AppDesktopNavProps) {
  const items = getAppNavItemsForRole(viewerRole);
  return (
    <nav
      role="navigation"
      aria-label="Navigation principale"
      className={NAV_CLASSES}
      data-testid="app-desktop-nav"
    >
      <div className={CONTAINER_CLASSES}>
        <span className={EYEBROW_CLASSES}>Maison Givre — HACCP</span>
        <ul className={LIST_CLASSES}>
          {items.map((item) => (
            <li key={item.slug}>
              <AppDesktopNavLink
                href={item.href}
                label={item.label}
                testId={`app-desktop-nav-link-${item.slug}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
