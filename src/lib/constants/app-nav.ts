import type { Route } from 'next';
import { UserRole } from '@prisma/client';

/**
 * Navigation unifiee de l'app authentifiee (refactor/unified-sidebar).
 *
 * UNE seule source pour la sidebar desktop (`AppSidebar`) ET le drawer
 * mobile (`AppMobileNavDrawer`), organisee en GROUPES. L'ancienne
 * dualite "espace app" / "espace admin" (deux sidebars + un lien de
 * bascule "Espace admin") est supprimee : un ADMIN voit desormais les
 * deux groupes dans la meme sidebar, partout (y compris sur `/admin/*`).
 *
 *   - "Operations"     : routes metier transversales (les trois roles).
 *   - "Administration" : routes de gestion du parc (ADMIN uniquement),
 *     reprises a l'identique de l'ancien `admin-nav.ts` (hrefs/labels).
 *
 * Le filtrage par role se fait au niveau de chaque item ; un groupe sans
 * item visible pour le role est masque par `getAppNavGroupsForRole`.
 */
export interface AppNavItem {
  readonly href: Route;
  readonly label: string;
  readonly slug: string;
  readonly roles: readonly UserRole[];
}

export interface AppNavGroup {
  readonly label: string;
  readonly slug: string;
  readonly items: readonly AppNavItem[];
}

export const APP_NAV_GROUPS: readonly AppNavGroup[] = [
  {
    label: 'Operations',
    slug: 'operations',
    items: [
      {
        // Tableau de bord = accueil post-login pour TOUS les roles
        // (feat/dashboard-as-home). Place en tete de la nav.
        href: '/dashboard' as Route,
        label: 'Tableau de bord',
        slug: 'dashboard',
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
    ],
  },
  {
    label: 'Administration',
    slug: 'administration',
    items: [
      {
        href: '/admin/users' as Route,
        label: 'Utilisateurs',
        slug: 'admin-users',
        roles: [UserRole.ADMIN],
      },
      {
        href: '/admin/boutiques' as Route,
        label: 'Boutiques',
        slug: 'admin-boutiques',
        roles: [UserRole.ADMIN],
      },
      {
        href: '/admin/equipements' as Route,
        label: 'Equipements',
        slug: 'admin-equipements',
        roles: [UserRole.ADMIN],
      },
      {
        href: '/admin/audit-log' as Route,
        label: "Journal d'audit",
        slug: 'admin-audit',
        roles: [UserRole.ADMIN],
      },
    ],
  },
] as const;

/**
 * Groupes filtres pour un role : chaque groupe ne conserve que ses items
 * visibles, et un groupe sans item restant est entierement masque (pas
 * de titre de groupe orphelin). Un SALARIE n'obtient donc que le groupe
 * "Operations" ; un ADMIN obtient "Operations" + "Administration".
 */
export function getAppNavGroupsForRole(role: UserRole): readonly AppNavGroup[] {
  return APP_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
