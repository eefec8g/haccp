import type { UserRole } from '@prisma/client';
import { getAppNavItemsForRole } from '@/lib/constants/app-nav';
import { LogoutButton } from '@/components/features/auth/LogoutButton';
import { AppSidebarLink } from './AppSidebarLink';

interface AppSidebarProps {
  readonly viewerRole: UserRole;
}

/**
 * Sidebar desktop du route group `(app)` non-admin (Server Component,
 * fix/app-sidebar).
 *
 * Remplace l'ancienne `AppDesktopNav` (top bar horizontale) par une
 * sidebar fixe a gauche calquee sur `AdminSidebar` pour homogeneiser
 * l'experience desktop des trois roles (SALARIE, RESPONSABLE, ADMIN).
 *
 * Charte Maison Givre : fond noir profond, wordmark MAISON GIVRE en
 * capitales espacees ivoire, ligne or comme divider, sous-titre or
 * "HACCP". Les liens sont delegues a `AppSidebarLink` (Client Component)
 * car `usePathname` est requis pour l'etat actif.
 *
 * Visibilite :
 *   - `hidden lg:flex` : visible >= lg (>= 1024px). Sur md/sm le FAB
 *     mobile (`AppMobileNavButton`) prend le relais comme avant.
 *   - `fixed inset-y-0 left-0 z-30` : sidebar ancree a gauche pleine
 *     hauteur, sous les overlays modaux/dialogs (z-40+).
 *   - Le main est decale via `lg:pl-64` dans `AppShell`.
 *
 * Pied : `LogoutButton` au bas de la sidebar (cale en bas via
 * `mt-auto`). Sur `/admin/*` cette sidebar est masquee par le gate de
 * visibilite ; l'`AdminSidebar` prend alors le relais avec son propre
 * LogoutButton.
 */

const ASIDE_CLASSES =
  'hidden lg:flex fixed inset-y-0 left-0 z-30 h-screen w-64 flex-col bg-mg-noir text-mg-ivoire';
const HEADER_CLASSES = 'px-8 pt-10 pb-8';
const NAV_CLASSES = 'mt-2 flex flex-col';
const FOOTER_CLASSES = 'mt-auto px-8 py-8';
const LOGOUT_CLASSES =
  'inline-flex min-h-touch items-center justify-center border border-mg-or/40 bg-transparent px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-mg-ivoire transition-colors hover:border-mg-or hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-noir';

export function AppSidebar({ viewerRole }: AppSidebarProps) {
  const items = getAppNavItemsForRole(viewerRole);
  return (
    <aside
      className={ASIDE_CLASSES}
      aria-label="Navigation principale"
      data-testid="app-sidebar"
    >
      <div className={HEADER_CLASSES}>
        <span className="block text-sm font-semibold tracking-[0.3em] text-mg-ivoire uppercase">
          Maison Givre
        </span>
        <span
          aria-hidden="true"
          className="mt-3 inline-block h-px w-10 bg-mg-or"
        />
        <p className="mt-3 text-[10px] font-light tracking-[0.3em] text-mg-or uppercase">
          HACCP
        </p>
      </div>
      <nav className={NAV_CLASSES} aria-label="Sections application">
        {items.map((item) => (
          <AppSidebarLink
            key={item.slug}
            href={item.href}
            label={item.label}
            testId={`app-sidebar-link-${item.slug}`}
          />
        ))}
      </nav>
      <div className={FOOTER_CLASSES}>
        <LogoutButton className={LOGOUT_CLASSES} />
      </div>
    </aside>
  );
}
