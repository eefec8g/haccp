import type { Route } from 'next';
import { UserRole } from '@prisma/client';

/**
 * Constantes de navigation transversale de l'app authentifiee (Epic
 * RESPONSIVE).
 *
 * Source unique consommee par `AppMobileNavDrawer` pour offrir un acces
 * mobile a toutes les routes principales selon le role. Le finding
 * initial CRITICAL etait : "Un RESPONSABLE n'a aucun raccourci vers
 * /alertes, /dashboard, /exports/registre-consolide depuis son mobile".
 *
 * Pourquoi un fichier dedie (et pas une fusion avec `admin-nav.ts`) ?
 *   - Scope different : `admin-nav` couvre uniquement la sidebar admin
 *     (deja contextualisee par le layout admin), `app-nav` couvre la
 *     navigation transversale visible des trois roles.
 *   - Filtrage par role : on a besoin de declarer `roles` par item.
 */
export interface AppNavItem {
  readonly href: Route;
  readonly label: string;
  readonly slug: string;
  readonly roles: readonly UserRole[];
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    // Tableau de bord = accueil post-login pour TOUS les roles
    // (feat/dashboard-as-home). Place en tete de la nav.
    href: '/dashboard' as Route,
    label: 'Tableau de bord',
    slug: 'dashboard',
    roles: [UserRole.SALARIE, UserRole.RESPONSABLE, UserRole.ADMIN],
  },
  {
    href: '/releves' as Route,
    label: 'Mes releves',
    slug: 'releves',
    roles: [UserRole.SALARIE, UserRole.RESPONSABLE, UserRole.ADMIN],
  },
  {
    href: '/releves/listing' as Route,
    label: 'Listing des releves',
    slug: 'releves-listing',
    roles: [UserRole.RESPONSABLE, UserRole.ADMIN],
  },
  {
    href: '/alertes' as Route,
    label: 'Alertes',
    slug: 'alertes',
    roles: [UserRole.SALARIE, UserRole.RESPONSABLE, UserRole.ADMIN],
  },
  {
    // Page d'export unifiee : PDF + CSV depuis le meme formulaire
    // (cf. fix/csv-in-consolide). Le slug reste `registre-consolide`
    // pour preserver la stabilite des testids existants ; seul le
    // label change pour refleter le perimetre fonctionnel etendu.
    href: '/exports/registre-consolide' as Route,
    label: 'Exports',
    slug: 'registre-consolide',
    roles: [UserRole.RESPONSABLE, UserRole.ADMIN],
  },
  {
    href: '/admin' as Route,
    label: 'Espace admin',
    slug: 'admin',
    roles: [UserRole.ADMIN],
  },
] as const;

export function getAppNavItemsForRole(role: UserRole): readonly AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
