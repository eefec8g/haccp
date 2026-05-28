import { test, expect } from '@playwright/test';
import { loginAsResponsable, loginAsSalarie } from '../fixtures/login';

/**
 * Tests E2E Epic LISTING : consultation/filtrage des releves multi-jours.
 *
 * Permissions (`canExport`) : RESPONSABLE + ADMIN seulement. Le SALARIE est
 * redirige (anti-enum, defense en profondeur) vers /dashboard.
 *
 * Regression couverte : un filtre avec boutique "Toutes" (champ vide) +
 * statut renseigne ne doit PAS casser la page (bug des query params vides
 * desormais corrige : le schema Zod coerce les chaines vides en undefined).
 *
 * Pre-requis (prisma/seed.ts, idempotent) :
 *   - RESPONSABLE : resp@maison-givre.fr / RespPass1!aaaa (MG E2E Lyon)
 *   - SALARIE     : lea@maison-givre.fr / Secret123!aaaa
 *
 * `@db-required` : echecs sans seed = responsabilite du pipeline CI.
 */

test.describe('[Listing] acces RESPONSABLE @db-required', () => {
  test('should render the listing page with filters', async ({ page }) => {
    await loginAsResponsable(page);

    await page.goto('/releves/listing');
    await expect(page.getByTestId('releve-listing-page')).toBeVisible();
    await expect(page.getByTestId('listing-form')).toBeVisible();
    await expect(page.getByTestId('listing-boutique')).toBeVisible();
    await expect(page.getByTestId('listing-statut')).toBeVisible();
    await expect(page.getByTestId('listing-date-start')).toBeVisible();
    await expect(page.getByTestId('listing-date-end')).toBeVisible();
  });

  test('should apply statut=MANQUANT with boutique "Toutes" without crashing', async ({
    page,
  }) => {
    await loginAsResponsable(page);
    await page.goto('/releves/listing');

    // Boutique laissee sur "Toutes mes boutiques" (valeur vide) + statut
    // MANQUANT : le cas qui regressait (params vides) doit desormais
    // renvoyer une page fonctionnelle.
    await page.getByTestId('listing-statut').selectOption('MANQUANT');

    const submit = page.getByTestId('listing-submit');
    await expect(submit).toBeEnabled();
    await Promise.all([
      page.waitForURL(/statut=MANQUANT/, { timeout: 10_000 }),
      submit.click(),
    ]);

    // La page ne casse pas : le shell + les stats restent rendus, et le
    // filtre statut est bien reflete dans le formulaire.
    await expect(page.getByTestId('releve-listing-page')).toBeVisible();
    await expect(page.getByTestId('listing-stats')).toBeVisible();
    await expect(page.getByTestId('listing-statut')).toHaveValue('MANQUANT');
    // Le bloc d'erreur serveur ne doit PAS apparaitre (params vides geres).
    await expect(page.getByTestId('releve-listing-error')).toHaveCount(0);
    await expect(page.getByTestId('listing-form-error')).toHaveCount(0);
  });

  test('should show the four stat cards (saisis/alertes/manquants/annules)', async ({
    page,
  }) => {
    await loginAsResponsable(page);
    await page.goto('/releves/listing');

    const stats = page.getByTestId('listing-stats');
    await expect(stats).toBeVisible();
    await expect(stats.getByTestId('listing-stats-saisis')).toBeVisible();
    await expect(stats.getByTestId('listing-stats-alertes')).toBeVisible();
    await expect(stats.getByTestId('listing-stats-manquants')).toBeVisible();
    await expect(stats.getByTestId('listing-stats-annules')).toBeVisible();
  });
});

test.describe('[Listing] acces SALARIE refuse @db-required', () => {
  test('should redirect a SALARIE away from /releves/listing', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    await page.goto('/releves/listing');
    await expect(page).not.toHaveURL(/\/releves\/listing/);
    await expect(page.getByTestId('releve-listing-page')).toHaveCount(0);
  });
});
