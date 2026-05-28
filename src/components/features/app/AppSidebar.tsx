import type { Route } from 'next';
import Link from 'next/link';
import type { UserRole } from '@prisma/client';
import { getAppNavGroupsForRole } from '@/lib/constants/app-nav';
import { LogoutButton } from '@/components/features/auth/LogoutButton';
import { AppSidebarLink } from './AppSidebarLink';

interface AppSidebarProps {
  readonly viewerRole: UserRole;
}

/**
 * Sidebar desktop UNIFIEE du route group `(app)` (Server Component,
 * refactor/unified-sidebar).
 *
 * Une seule sidebar pour TOUTES les pages authentifiees (y compris
 * `/admin/*`), organisee en groupes (`Operations`, `Administration`).
 * Remplace l'ancien duo `AppSidebar` (non-admin) + `AdminSidebar`
 * (`/admin/*`) et supprime le lien de bascule "Espace admin" : les
 * routes admin deviennent un groupe de cette meme sidebar, visible des
 * seuls ADMIN.
 *
 * Charte Maison Givre : fond noir profond, wordmark MAISON GIVRE en
 * capitales espacees ivoire, ligne or comme divider, sous-titre or
 * "HACCP". Chaque groupe expose son titre en eyebrow or et delegue ses
 * liens a `AppSidebarLink` (Client Component) car `usePathname` est
 * requis pour l'etat actif.
 *
 * Visibilite :
 *   - `hidden lg:flex` : visible >= lg (>= 1024px). Sur md/sm le FAB
 *     mobile (`AppMobileNavButton`) prend le relais.
 *   - `fixed inset-y-0 left-0 z-30` : sidebar ancree a gauche pleine
 *     hauteur, sous les overlays modaux/dialogs (z-40+).
 *   - Le main est decale via `lg:pl-64` dans `AppShell`.
 */

const ASIDE_CLASSES =
  'hidden lg:flex fixed inset-y-0 left-0 z-30 h-screen w-64 flex-col overflow-y-auto bg-mg-noir text-mg-ivoire';
const HEADER_CLASSES = 'px-8 pt-10 pb-8';
const NAV_CLASSES = 'mt-2 flex flex-col gap-6';
const GROUP_TITLE_CLASSES =
  'px-8 pb-2 text-[10px] font-light uppercase tracking-[0.3em] text-mg-or/70';
const FOOTER_CLASSES = 'mt-auto flex flex-col gap-3 px-8 py-8';
const ACCOUNT_LINK_HREF = '/compte/mot-de-passe' as Route;
const ACCOUNT_LINK_CLASSES =
  'inline-flex min-h-touch items-center justify-center text-[11px] font-medium uppercase tracking-[0.2em] text-mg-ivoire/70 transition-colors hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-noir';
const LOGOUT_CLASSES =
  'inline-flex min-h-touch items-center justify-center border border-mg-or/40 bg-transparent px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-mg-ivoire transition-colors hover:border-mg-or hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-noir';

export function AppSidebar({ viewerRole }: AppSidebarProps) {
  const groups = getAppNavGroupsForRole(viewerRole);
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
        {groups.map((group) => (
          <div
            key={group.slug}
            data-testid={`app-sidebar-group-${group.slug}`}
            aria-label={group.label}
            role="group"
          >
            <p className={GROUP_TITLE_CLASSES}>{group.label}</p>
            <div className="flex flex-col">
              {group.items.map((item) => (
                <AppSidebarLink
                  key={item.slug}
                  href={item.href}
                  label={item.label}
                  testId={`app-sidebar-link-${item.slug}`}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={FOOTER_CLASSES}>
        <Link
          href={ACCOUNT_LINK_HREF}
          className={ACCOUNT_LINK_CLASSES}
          data-testid="app-sidebar-link-account-password"
        >
          Mon mot de passe
        </Link>
        <LogoutButton className={LOGOUT_CLASSES} />
      </div>
    </aside>
  );
}
