import { test, expect } from '@playwright/test';

/**
 * Tests E2E de la vitrine publique Maison Givre.
 *
 * La vitrine presente la marque (glacier artisan depuis 1933) et non
 * l'application HACCP interne. Le CTA "Espace pro" reste discret et
 * pointe vers /login. Couverture :
 *  - Accessibilite anonyme (status 200, hero h1 visible)
 *  - CTA "Espace pro" -> /login
 *  - Toutes les sections principales sont rendues (data-testid stables)
 *  - User authentifie voit le CTA "Acceder a mon espace" -- @db-required
 *  - Pas de console.error au chargement
 */

const SALARIE_EMAIL = 'lea@maison-givre.fr';
const SALARIE_PASSWORD = 'Secret123!aaaa';

test.describe('[Landing] visiteur anonyme', () => {
  test('should render every main section of the brand landing', async ({
    page,
  }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('landing-hero')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /maison givre/i, level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId('landing-valeurs')).toBeVisible();
    await expect(page.getByTestId('landing-piliers')).toBeVisible();
    await expect(page.getByTestId('landing-histoire')).toBeVisible();
    await expect(page.getByTestId('landing-cta')).toBeVisible();
    await expect(page.getByTestId('landing-footer')).toBeVisible();
  });

  test('should show "Espace pro" CTA pointing to /login', async ({ page }) => {
    await page.goto('/');

    const headerCta = page.getByTestId('landing-cta-login').first();
    await expect(headerCta).toBeVisible();
    await expect(headerCta).toHaveAttribute('href', '/login');
  });

  test('should navigate to /login when clicking the header CTA', async ({
    page,
  }) => {
    await page.goto('/');

    await Promise.all([
      page.waitForURL('**/login', { timeout: 5_000 }),
      page.getByTestId('landing-cta-login').first().click(),
    ]);

    expect(page.url()).toContain('/login');
  });

  test('should scroll to histoire section via hero CTA', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('hero-cta-histoire').click();

    await expect(page).toHaveURL(/#histoire$/);
    await expect(page.getByTestId('landing-histoire')).toBeInViewport();
  });

  test('should not log console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});

test.describe('[Landing] utilisateur authentifie @db-required', () => {
  test('should show "Acceder a mon espace" instead of "Espace pro"', async ({
    page,
  }) => {
    // Connexion prealable
    await page.goto('/login');
    await page.getByTestId('login-email').fill(SALARIE_EMAIL);
    await page.getByTestId('login-password').fill(SALARIE_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 10_000 }),
      page.getByTestId('login-submit').click(),
    ]);

    // Retour sur la landing : doit etre accessible, CTA contextuel
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Le CTA pointe vers POST_LOGIN_REDIRECT[role] = /dashboard
    // (feat/dashboard-as-home), et non plus /releves.
    const appCta = page.getByTestId('landing-cta-app').first();
    await expect(appCta).toBeVisible();
    await expect(appCta).toHaveText(/acceder a mon espace/i);
    await expect(appCta).toHaveAttribute('href', '/dashboard');
  });
});
