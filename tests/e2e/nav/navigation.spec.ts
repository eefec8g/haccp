import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsResponsable,
  loginAsSalarie,
} from '../fixtures/login';

/**
 * Tests E2E de la navigation UNIFIEE (refactor/unified-sidebar).
 *
 * Une seule sidebar `app-sidebar` pour TOUTES les pages authentifiees,
 * organisee en groupes filtres par role :
 *   - "operations"     : Dashboard, Alertes (+ Listing/Exports pour
 *                        RESPONSABLE/ADMIN).
 *   - "administration" : Utilisateurs/Boutiques/Equipements/Journal
 *                        d'audit (ADMIN uniquement).
 *
 * L'ancien duo de sidebars (app + admin) et le lien de bascule "Espace
 * admin" sont supprimes : un ADMIN voit les deux groupes dans la meme
 * sidebar, partout.
 *
 * La sidebar desktop est `hidden lg:flex` (>= 1024px). Le viewport
 * Desktop Chrome (1280x720) la rend visible.
 *
 * Pre-requis (prisma/seed.ts, idempotent) : ADMIN/RESPONSABLE/SALARIE.
 * `@db-required` : echecs sans seed = responsabilite du pipeline CI.
 */

test.describe('[Nav] sidebar unifiee - ADMIN @db-required', () => {
  test('should expose both Operations and Administration groups', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-operations')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-administration')
    ).toBeVisible();

    // Liens admin presents dans le groupe Administration.
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-users')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-boutiques')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-equipements')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-audit')
    ).toBeVisible();
  });

  test('should still show the admin sidebar group while on an /admin route', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/boutiques');

    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-administration')
    ).toBeVisible();
  });
});

test.describe('[Nav] sidebar unifiee - RESPONSABLE @db-required', () => {
  test('should show only the Operations group, never Administration', async ({
    page,
  }) => {
    await loginAsResponsable(page);

    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-operations')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-administration')
    ).toHaveCount(0);

    // Operations RESPONSABLE : dashboard + listing + alertes + exports.
    await expect(
      sidebar.getByTestId('app-sidebar-link-dashboard')
    ).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-link-releves-listing')
    ).toBeVisible();
    await expect(sidebar.getByTestId('app-sidebar-link-alertes')).toBeVisible();
  });
});

test.describe('[Nav] sidebar unifiee - SALARIE @db-required', () => {
  test('should show Operations (Dashboard + Alertes) and no admin links', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByTestId('app-sidebar-group-operations')
    ).toBeVisible();

    await expect(
      sidebar.getByTestId('app-sidebar-link-dashboard')
    ).toBeVisible();
    await expect(sidebar.getByTestId('app-sidebar-link-alertes')).toBeVisible();

    // Pas de groupe ni de liens d'administration pour le salarie.
    await expect(
      sidebar.getByTestId('app-sidebar-group-administration')
    ).toHaveCount(0);
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-users')
    ).toHaveCount(0);
    // Listing/Exports (RESPONSABLE/ADMIN) absents pour le salarie.
    await expect(
      sidebar.getByTestId('app-sidebar-link-releves-listing')
    ).toHaveCount(0);
  });
});

test.describe('[Nav] suppression de la bascule "Espace admin" @db-required', () => {
  test('should not render any legacy admin sidebar or "Espace admin" toggle', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Une seule sidebar unifiee (pas de seconde sidebar admin legacy).
    await expect(page.getByTestId('app-sidebar')).toHaveCount(1);
    await expect(page.getByTestId('admin-sidebar')).toHaveCount(0);

    // Plus de lien de bascule "Espace admin".
    await expect(page.getByRole('link', { name: /espace admin/i })).toHaveCount(
      0
    );
  });
});
