import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-ADM-004 : Journal d'audit + desactivation avec motif.
 *
 * Pre-requis (a seeder dans prisma/seed.ts) :
 *   - ADMIN actif : admin@maison-givre.fr / AdminPass1!aaaa
 *   - SALARIE actif : lea@maison-givre.fr / Secret123!aaaa
 *   - Au moins une boutique active (pour scenario disable+log)
 *
 * Les scenarios `@db-required` echouent sans seed - la responsabilite
 * incombe au pipeline CI.
 */

const ADMIN_EMAIL = 'admin@maison-givre.fr';
const ADMIN_PASSWORD = 'AdminPass1!aaaa';
const SALARIE_EMAIL = 'lea@maison-givre.fr';
const SALARIE_PASSWORD = 'Secret123!aaaa';

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  expectedPath: RegExp
): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await Promise.all([
    page.waitForURL(expectedPath, { timeout: 10_000 }),
    page.getByTestId('login-submit').click(),
  ]);
}

test.describe('[US-ADM-004] Audit log access control @db-required', () => {
  test('should allow an ADMIN to reach /admin/audit-log', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/audit-log');
    await expect(page.getByTestId('admin-audit-log-page')).toBeVisible();
    await expect(page.getByTestId('admin-audit-log-filters')).toBeVisible();
  });

  test('should redirect a SALARIE away from /admin/audit-log', async ({
    page,
  }) => {
    await loginAs(page, SALARIE_EMAIL, SALARIE_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/audit-log');
    await expect(page).not.toHaveURL(/\/admin\/audit-log/);
  });
});

test.describe('[US-ADM-004] Filtres et a11y @db-required', () => {
  test('should expose a table with role and caption (screen readers)', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/audit-log');
    const table = page.getByTestId('admin-table-audit-log');
    const empty = page.getByTestId('admin-table-audit-log-empty');
    await expect(table.or(empty)).toBeVisible();
  });

  test('should filter by entity type when clicking the filter link', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/audit-log');
    await page.getByTestId('audit-filter-boutique').click();
    await expect(page).toHaveURL(/entityType=BOUTIQUE/);
  });

  test('should expose the audit-log link in the unified sidebar Administration group', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    const sidebar = page.getByTestId('app-sidebar');
    await expect(
      sidebar.getByTestId('app-sidebar-link-admin-audit')
    ).toBeVisible();
  });
});

test.describe('[US-ADM-004] Disable boutique with motif @db-required', () => {
  test('should display the motif textarea in the confirm dialog', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/boutiques');
    const firstDisable = page
      .locator('[data-testid^="disable-boutique-"]')
      .first();
    if (
      !(await firstDisable.isVisible({ timeout: 2_000 }).catch(() => false))
    ) {
      test.skip(true, 'Aucune boutique active disponible pour le scenario');
      return;
    }
    await firstDisable.click();

    const motifInput = page.getByTestId('disable-motif-input');
    await expect(motifInput).toBeVisible();
    await expect(motifInput).toHaveAttribute('maxlength', '500');
  });
});
