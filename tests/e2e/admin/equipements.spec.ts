import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-ADM-002 : Admin cree un equipement.
 *
 * Pre-requis (a seeder dans prisma/seed.ts) :
 *   - ADMIN actif : admin@maison-givre.fr / AdminPass1!aaaa
 *   - SALARIE actif : lea@maison-givre.fr / Secret123!aaaa
 *   - Au moins une boutique active (seed -> "MG Paris 11")
 *
 * Decision Epic ADMIN #4 : les seuils sont OBLIGATOIRES. Soumettre un
 * formulaire sans seuilMin/seuilMax doit produire une erreur Zod.
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

async function createBoutiqueFixture(
  page: import('@playwright/test').Page,
  nom: string
): Promise<string> {
  await page.goto('/admin/boutiques/nouvelle');
  await page.getByTestId('boutique-nom').fill(nom);
  await Promise.all([
    page.waitForURL(/\/admin\/boutiques\/[a-f0-9-]+$/, { timeout: 10_000 }),
    page.getByTestId('boutique-submit').click(),
  ]);
  return page.url().split('/').pop() ?? '';
}

test.describe('[US-ADM-002] Liste equipements - access control @db-required', () => {
  test('should allow an ADMIN to access /admin/equipements', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    await page.goto('/admin/equipements');
    await expect(page.getByTestId('admin-equipements-page')).toBeVisible();
    await expect(page.getByTestId('equipement-create-link')).toBeVisible();
    await expect(page.getByTestId('equipement-filter-form')).toBeVisible();
  });

  test('should redirect a SALARIE away from /admin/equipements', async ({
    page,
  }) => {
    await loginAs(page, SALARIE_EMAIL, SALARIE_PASSWORD, /\/releves$/);

    await page.goto('/admin/equipements');
    await expect(page).not.toHaveURL(/\/admin\/equipements/);
  });
});

test.describe('[US-ADM-002] Creation equipement @db-required', () => {
  test('should display the creation form with proper a11y attributes', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    await page.goto('/admin/equipements/nouveau');
    const form = page.getByTestId('equipement-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute(
      'aria-label',
      "Formulaire de creation d'equipement"
    );
    await expect(page.getByTestId('equipement-nom')).toBeFocused();
    await expect(page.getByTestId('equipement-submit')).toBeEnabled();
  });

  test('should reject a submission with missing seuils (decision #4)', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    const boutiqueId = await createBoutiqueFixture(
      page,
      `MG Equip Seuils ${Date.now()}`
    );

    await page.goto(`/admin/equipements/nouveau?boutiqueId=${boutiqueId}`);
    await page.getByTestId('equipement-nom').fill('Cong test');
    await page.getByTestId('equipement-type').selectOption('CONGELATEUR');
    // On omet volontairement seuilMin / seuilMax pour valider le refus
    // cote serveur (HTML required est bypass par noValidate).
    await page.getByTestId('equipement-submit').click();

    const errorBox = page.getByTestId('equipement-error');
    await expect(errorBox).toBeVisible();
  });

  test('should create an equipement and redirect to its detail page', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    const boutiqueId = await createBoutiqueFixture(
      page,
      `MG Equip Create ${Date.now()}`
    );
    const uniqueNom = `Congelateur E2E ${Date.now()}`;

    await page.goto(`/admin/equipements/nouveau?boutiqueId=${boutiqueId}`);
    await page.getByTestId('equipement-nom').fill(uniqueNom);
    await page.getByTestId('equipement-type').selectOption('CONGELATEUR');
    await expect(page.getByTestId('equipement-boutique')).toHaveValue(
      boutiqueId
    );
    await page.getByTestId('equipement-seuil-min').fill('-25');
    await page.getByTestId('equipement-seuil-max').fill('-18');
    await Promise.all([
      page.waitForURL(/\/admin\/equipements\/[a-f0-9-]+$/, { timeout: 10_000 }),
      page.getByTestId('equipement-submit').click(),
    ]);

    await expect(
      page.getByRole('heading', { level: 1, name: uniqueNom })
    ).toBeVisible();
    await expect(page.getByTestId('equipement-status')).toHaveText('Actif');
  });
});

test.describe('[US-ADM-002] Edition et desactivation @db-required', () => {
  test('should edit an existing equipement and persist the change', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    const boutiqueId = await createBoutiqueFixture(
      page,
      `MG Equip Edit ${Date.now()}`
    );
    const initialNom = `Cong Edit ${Date.now()}`;

    await page.goto(`/admin/equipements/nouveau?boutiqueId=${boutiqueId}`);
    await page.getByTestId('equipement-nom').fill(initialNom);
    await page.getByTestId('equipement-type').selectOption('CONGELATEUR');
    await page.getByTestId('equipement-seuil-min').fill('-25');
    await page.getByTestId('equipement-seuil-max').fill('-18');
    await page.getByTestId('equipement-submit').click();
    await page.waitForURL(/\/admin\/equipements\/[a-f0-9-]+$/);

    await page.getByTestId('equipement-seuil-max').fill('-15');
    await page.getByTestId('equipement-submit').click();

    await expect(page.getByTestId('equipement-success')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('equipement-seuil-max')).toHaveValue('-15');
  });

  test('should disable an equipement via confirm dialog and reactivate it', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    const boutiqueId = await createBoutiqueFixture(
      page,
      `MG Equip Toggle ${Date.now()}`
    );
    const nom = `Cong Toggle ${Date.now()}`;

    await page.goto(`/admin/equipements/nouveau?boutiqueId=${boutiqueId}`);
    await page.getByTestId('equipement-nom').fill(nom);
    await page.getByTestId('equipement-type').selectOption('CONGELATEUR');
    await page.getByTestId('equipement-seuil-min').fill('-25');
    await page.getByTestId('equipement-seuil-max').fill('-18');
    await page.getByTestId('equipement-submit').click();
    await page.waitForURL(/\/admin\/equipements\/[a-f0-9-]+$/);

    const equipementId = page.url().split('/').pop() ?? '';

    await page.getByTestId(`disable-equipement-${equipementId}`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-action').click();
    await expect(page.getByTestId('equipement-status')).toHaveText('Inactif');

    await page.getByTestId(`enable-equipement-${equipementId}`).click();
    await expect(page.getByTestId('equipement-status')).toHaveText('Actif');
  });
});

test.describe('[US-ADM-002] Filtre par boutique @db-required', () => {
  test('should filter the list by boutique', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

    const boutiqueId = await createBoutiqueFixture(
      page,
      `MG Equip Filter ${Date.now()}`
    );

    await page.goto(`/admin/equipements?boutiqueId=${boutiqueId}`);
    await expect(page.getByTestId('equipement-filter-boutique')).toHaveValue(
      boutiqueId
    );
    // Avec un boutiqueId actif et zero equipement, le tableau affiche
    // l'etat empty -> verifie indirectement le filtre applique.
    await expect(
      page.getByTestId('admin-table-equipements-empty')
    ).toBeVisible();
  });
});
