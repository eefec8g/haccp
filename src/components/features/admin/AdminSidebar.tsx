import type { Route } from 'next';
import { AdminSidebarLink } from './AdminSidebarLink';

interface NavItem {
  readonly href: Route;
  readonly label: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/admin' as Route, label: 'Tableau de bord' },
  { href: '/admin/boutiques' as Route, label: 'Boutiques' },
  { href: '/admin/equipements' as Route, label: 'Equipements' },
  { href: '/admin/users' as Route, label: 'Utilisateurs' },
  { href: '/admin/audit-log' as Route, label: "Journal d'audit" },
] as const;

/**
 * Sidebar de la zone admin (Server Component).
 *
 * La mise en valeur du lien actif necessite `usePathname` -> deleguee
 * a `AdminSidebarLink` (composant client minimal). Cela evite
 * d'hydrater toute la sidebar inutilement.
 */
export function AdminSidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#DFE5EF] bg-white px-4 py-6 lg:flex"
      aria-label="Navigation administration"
      data-testid="admin-sidebar"
    >
      <div className="mb-8 px-2">
        <span className="text-xl font-bold text-[#2A3547]">Maison Givre</span>
        <p className="mt-1 text-xs uppercase tracking-wider text-[#5D87FF]">
          Administration
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
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
