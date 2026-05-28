import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-ADM-001 : Admin cree une boutique.
 *
 * Pre-requis (a seeder dans prisma/seed.ts) :
 *   - ADMIN actif : admin@maison-givre.fr / AdminPass1!aaaa
 *   - SALARIE actif : lea@maison-givre.fr / Secret123!aaaa
 *
 * Les scenarios `@db-required` echouent sans seed - cela ne masque pas
 * de bug applicatif, la responsabilite incombe au pipeline CI.
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

test.describe('[US-ADM-001] Liste boutiques - access control @db-required', () => {
  test('should allow an ADMIN to access /admin/boutiques', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/boutiques');
    await expect(page.getByTestId('admin-boutiques-page')).toBeVisible();
    await expect(page.getByTestId('boutique-create-link')).toBeVisible();
  });

  test('should redirect a SALARIE away from /admin/boutiques', async ({
    page,
  }) => {
    await loginAs(page, SALARIE_EMAIL, SALARIE_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/boutiques');
    await expect(page).not.toHaveURL(/\/admin\/boutiques/);
  });
});

test.describe('[US-ADM-001] Creation boutique @db-required', () => {
  test('should display the creation form with proper a11y attributes', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/boutiques/nouvelle');
    const form = page.getByTestId('boutique-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute(
      'aria-label',
      'Formulaire de creation de boutique'
    );
    await expect(page.getByTestId('boutique-nom')).toBeFocused();
    await expect(page.getByTestId('boutique-submit')).toBeEnabled();
  });

  test('should reject an empty nom with a field-level error', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    await page.goto('/admin/boutiques/nouvelle');
    await page.getByTestId('boutique-submit').click();

    const nomError = page.getByTestId('form-field-nom-error');
    await expect(nomError).toBeVisible();
    await expect(page.getByTestId('boutique-nom')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  test('should create a boutique and redirect to its detail page', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    const uniqueNom = `MG E2E ${Date.now()}`;
    await page.goto('/admin/boutiques/nouvelle');
    await page.getByTestId('boutique-nom').fill(uniqueNom);
    await page.getByTestId('boutique-ville').fill('Paris');
    await Promise.all([
      page.waitForURL(/\/admin\/boutiques\/[a-f0-9-]+$/, { timeout: 10_000 }),
      page.getByTestId('boutique-submit').click(),
    ]);

    await expect(
      page.getByRole('heading', { level: 1, name: uniqueNom })
    ).toBeVisible();
    await expect(page.getByTestId('boutique-status')).toHaveText('Actif');
  });
});

test.describe('[US-ADM-001] Edition et desactivation @db-required', () => {
  test('should edit an existing boutique and persist the change', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    const initialNom = `MG Edit ${Date.now()}`;
    await page.goto('/admin/boutiques/nouvelle');
    await page.getByTestId('boutique-nom').fill(initialNom);
    await page.getByTestId('boutique-submit').click();
    await page.waitForURL(/\/admin\/boutiques\/[a-f0-9-]+$/);

    const newVille = 'Lyon';
    await page.getByTestId('boutique-ville').fill(newVille);
    await page.getByTestId('boutique-submit').click();

    await expect(page.getByTestId('boutique-success')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('boutique-ville')).toHaveValue(newVille);
  });

  test('should disable a boutique via the confirm dialog and reactivate it', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/dashboard$/);

    const nom = `MG Toggle ${Date.now()}`;
    await page.goto('/admin/boutiques/nouvelle');
    await page.getByTestId('boutique-nom').fill(nom);
    await page.getByTestId('boutique-submit').click();
    await page.waitForURL(/\/admin\/boutiques\/[a-f0-9-]+$/);

    const detailUrl = page.url();
    const boutiqueId = detailUrl.split('/').pop() ?? '';

    await page.getByTestId(`disable-boutique-${boutiqueId}`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('boutique-status')).toHaveText('Inactif');

    await page.getByTestId(`enable-boutique-${boutiqueId}`).click();
    await expect(page.getByTestId('boutique-status')).toHaveText('Actif');
  });
});
