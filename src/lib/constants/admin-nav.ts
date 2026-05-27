import type { Route } from 'next';

/**
 * Constantes de navigation administration (Epic RESPONSIVE).
 *
 * Source unique partagee entre :
 *   - `AdminSidebar` (desktop lg+) ;
 *   - `AdminMobileMenu` (panneau full-screen mobile).
 *
 * Centralise l'ordre et les libelles pour eviter la divergence entre
 * desktop et mobile (le bug classique d'un item ajoute uniquement dans
 * un des deux composants).
 */
export interface AdminNavItem {
  readonly href: Route;
  readonly label: string;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin' as Route, label: 'Tableau de bord' },
  { href: '/admin/boutiques' as Route, label: 'Boutiques' },
  { href: '/admin/equipements' as Route, label: 'Equipements' },
  { href: '/admin/users' as Route, label: 'Utilisateurs' },
  { href: '/admin/audit-log' as Route, label: "Journal d'audit" },
] as const;
