import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-AUTH-001 : Connexion email/mot de passe.
 *
 * Pre-requis (a seeder dans prisma/seed.ts ou via fixture dediee) :
 *   - SALARIE actif : lea@maison-givre.fr / Secret123!aaaa (boutique rattachee)
 *   - ADMIN actif   : admin@maison-givre.fr / AdminPass1!aaaa
 *   - INACTIF       : ghost@maison-givre.fr / Whatever1!aaaa (actif=false)
 *
 * Redirect post-login (feat/dashboard-as-home) : TOUS les roles sont
 * rediriges vers /dashboard (POST_LOGIN_REDIRECT). L'ancienne cible par
 * role (/releves pour SALARIE, /admin pour ADMIN) n'existe plus.
 *
 * Si le seed n'est pas execute, les scenarios `@db-required` echoueront
 * sans masquer un bug de l'app : la responsabilite incombe au pipeline CI.
 */

const SALARIE_EMAIL = 'lea@maison-givre.fr';
const SALARIE_PASSWORD = 'Secret123!aaaa';
const ADMIN_EMAIL = 'admin@maison-givre.fr';
const ADMIN_PASSWORD = 'AdminPass1!aaaa';
const INACTIVE_EMAIL = 'ghost@maison-givre.fr';
const GENERIC_ERROR = 'Email ou mot de passe incorrect';

test.describe('[US-AUTH-001] Connexion - UI', () => {
  test('should render the login form with proper accessibility attributes', async ({
    page,
  }) => {
    await page.goto('/login');

    const form = page.getByTestId('login-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('aria-label', 'Formulaire de connexion');

    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeEnabled();
    await expect(page.getByTestId('login-forgot-password')).toBeVisible();
  });

  test('should not leak which field is wrong : a single generic error', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill('unknown@example.com');
    await page.getByTestId('login-password').fill('NotTheRealOne1!');
    await page.getByTestId('login-submit').click();

    const error = page.getByTestId('login-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(GENERIC_ERROR);
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'polite');
  });

  test('should mark inputs as aria-invalid after a failed attempt', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill('unknown@example.com');
    await page.getByTestId('login-password').fill('NotTheRealOne1!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-email')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await expect(page.getByTestId('login-password')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });
});

test.describe('[US-AUTH-001] Connexion - happy path @db-required', () => {
  test('should sign in a SALARIE and redirect to /dashboard', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill(SALARIE_EMAIL);
    await page.getByTestId('login-password').fill(SALARIE_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 10_000 }),
      page.getByTestId('login-submit').click(),
    ]);

    expect(page.url()).toContain('/dashboard');

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) =>
      c.name.includes('authjs.session-token')
    );
    expect(sessionCookie).toBeDefined();
  });

  test('should sign in an ADMIN and redirect to /dashboard', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill(ADMIN_EMAIL);
    await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 10_000 }),
      page.getByTestId('login-submit').click(),
    ]);

    expect(page.url()).toContain('/dashboard');
  });

  test('should reject an INACTIVE account with the same generic error (anti-enum)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByTestId('login-email').fill(INACTIVE_EMAIL);
    await page.getByTestId('login-password').fill(SALARIE_PASSWORD);
    await page.getByTestId('login-submit').click();

    const error = page.getByTestId('login-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(GENERIC_ERROR);
  });

  test('should redirect already-authenticated users away from /login', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(SALARIE_EMAIL);
    await page.getByTestId('login-password').fill(SALARIE_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard'),
      page.getByTestId('login-submit').click(),
    ]);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe.serial('[US-AUTH-001] Rate-limit @db-required', () => {
  // Serial : utiliser une IP partagee par les tentatives.
  test('should return a 429-equivalent error after exceeding the limit', async ({
    page,
  }) => {
    await page.goto('/login');

    // 5 tentatives autorisees : on attend que le formulaire ait re-rendu
    // l'erreur generique avant de re-cliquer (pas de waitForTimeout flaky).
    for (let i = 0; i < 5; i += 1) {
      await page.getByTestId('login-email').fill(`flood+${i}@example.com`);
      await page.getByTestId('login-password').fill('WrongPass1!aaaa');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-error')).toBeVisible();
      await expect(page.getByTestId('login-submit')).toBeEnabled();
    }

    // 6e tentative : doit declencher le rate-limit.
    await page.getByTestId('login-email').fill('flood+final@example.com');
    await page.getByTestId('login-password').fill('WrongPass1!aaaa');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toContainText(
      /trop de tentatives|rate.?limit|patienter/i
    );
  });
});
