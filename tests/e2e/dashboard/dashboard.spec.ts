import { test, expect } from '@playwright/test';
import { loginAsSalarie, loginAsResponsable } from '../fixtures/login';

/**
 * Tests E2E du tableau de bord (feat/dashboard-as-home).
 *
 * `/dashboard` est l'accueil post-login de TOUS les roles.
 *   - SALARIE : vue allegee (tableau "Releves du jour" + boutons tournee).
 *   - RESPONSABLE/ADMIN : KPIs + tableau equipements jour + trend + alertes.
 *
 * Pre-requis (prisma/seed.ts, idempotent) :
 *   - SALARIE     : lea@maison-givre.fr / Secret123!aaaa (boutique MG E2E Lyon)
 *   - RESPONSABLE : resp@maison-givre.fr / RespPass1!aaaa (boutique MG E2E Lyon)
 *   - Boutique MG E2E Lyon + equipements actifs (Congelo/Frigo/Vitrine E2E)
 *
 * Les scenarios `@db-required` echouent sans seed : la responsabilite
 * incombe au pipeline CI (pas un bug applicatif masque).
 */

const CRENEAUX = ['matin', 'midi', 'soir'] as const;

test.describe('[Dashboard] vue SALARIE @db-required', () => {
  test('should land on the salarie dashboard with the today board', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-salarie-page')).toBeVisible();
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    await expect(page.getByTestId('equipements-today-table')).toBeVisible();
  });

  test('should expose the three tournee buttons (matin/midi/soir)', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    const buttons = page.getByTestId('dashboard-tournee-buttons');
    await expect(buttons).toBeVisible();
    for (const creneau of CRENEAUX) {
      await expect(
        buttons.getByTestId(`tournee-button-${creneau}`)
      ).toBeVisible();
    }
  });

  test('should list the boutique equipements in the today board', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    const table = page.getByTestId('equipements-today-table');
    await expect(table).toBeVisible();
    // Le seed cree au moins un equipement actif : au moins une ligne doit
    // etre presente. Les `<tr>` portent `equipements-today-table-row-{id}`
    // (prefixe = testId du tableau).
    const rows = page.locator('[data-testid^="equipements-today-table-row-"]');
    await expect(rows.first()).toBeVisible();
  });
});

test.describe('[Dashboard] vue RESPONSABLE @db-required', () => {
  test('should land on the responsable dashboard with KPIs and board', async ({
    page,
  }) => {
    await loginAsResponsable(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('dashboard-responsable-page')).toBeVisible();
    await expect(page.getByTestId('dashboard-kpis')).toBeVisible();
    await expect(page.getByTestId('equipements-today-table')).toBeVisible();
  });

  test('should display the four conformity KPIs', async ({ page }) => {
    await loginAsResponsable(page);

    const kpis = page.getByTestId('dashboard-kpis');
    await expect(kpis.getByTestId('kpi-conformite')).toBeVisible();
    await expect(kpis.getByTestId('kpi-alertes')).toBeVisible();
    await expect(kpis.getByTestId('kpi-manquants')).toBeVisible();
    await expect(kpis.getByTestId('kpi-boutiques')).toBeVisible();
  });

  test('should also expose the tournee buttons for the manager', async ({
    page,
  }) => {
    await loginAsResponsable(page);

    const buttons = page.getByTestId('dashboard-tournee-buttons');
    await expect(buttons).toBeVisible();
    await expect(buttons.getByTestId('tournee-button-matin')).toBeVisible();
  });
});
