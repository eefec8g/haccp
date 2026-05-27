import { ADMIN_NAV_ITEMS } from '@/lib/constants/admin-nav';
import { AdminSidebarLink } from './AdminSidebarLink';

/**
 * Sidebar de la zone admin (Server Component).
 *
 * Charte Maison Givre : fond noir profond, wordmark MAISON GIVRE en
 * capitales espacees ivoire, ligne or comme divider, sous-titre or
 * "ESPACE ADMIN". Les liens sont delegues a `AdminSidebarLink`
 * (composant client) car `usePathname` est requis pour l'etat actif.
 */
export function AdminSidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-mg-noir text-mg-ivoire lg:flex"
      aria-label="Navigation administration"
      data-testid="admin-sidebar"
    >
      <div className="px-8 pt-10 pb-8">
        <span className="block text-sm font-semibold tracking-[0.3em] text-mg-ivoire uppercase">
          Maison Givre
        </span>
        <span
          aria-hidden="true"
          className="mt-3 inline-block h-px w-10 bg-mg-or"
        />
        <p className="mt-3 text-[10px] font-light tracking-[0.3em] text-mg-or uppercase">
          Espace Admin
        </p>
      </div>
      <nav className="mt-2 flex flex-col" aria-label="Sections administration">
        {ADMIN_NAV_ITEMS.map((item) => (
          <AdminSidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
          />
        ))}
      </nav>
    </aside>
  );
}
