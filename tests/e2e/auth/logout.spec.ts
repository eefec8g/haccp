import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-AUTH-003 : Logout.
 *
 * Pre-requis : seed du SALARIE actif (idem login.spec.ts).
 *   - SALARIE actif : lea@maison-givre.fr / Secret123!aaaa
 */

const SALARIE_EMAIL = 'lea@maison-givre.fr';
const SALARIE_PASSWORD = 'Secret123!aaaa';
const SESSION_COOKIE_NAME = 'authjs.session-token';

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 10_000 }),
    page.getByTestId('login-submit').click(),
  ]);
}

test.describe('[US-AUTH-003] Logout @db-required', () => {
  test('should log out the user and redirect to /login', async ({ page }) => {
    await login(page, SALARIE_EMAIL, SALARIE_PASSWORD);

    const logoutButton = page.getByTestId('logout-button');
    await expect(logoutButton).toBeVisible();

    await Promise.all([
      page.waitForURL('**/login', { timeout: 10_000 }),
      logoutButton.click(),
    ]);

    expect(page.url()).toContain('/login');
  });

  test('should clear the NextAuth session cookie after logout', async ({
    page,
  }) => {
    await login(page, SALARIE_EMAIL, SALARIE_PASSWORD);

    const before = await page.context().cookies();
    const beforeSession = before.find((c) =>
      c.name.includes(SESSION_COOKIE_NAME)
    );
    expect(beforeSession).toBeDefined();

    await Promise.all([
      page.waitForURL('**/login'),
      page.getByTestId('logout-button').click(),
    ]);

    const after = await page.context().cookies();
    const afterSession = after.find(
      (c) => c.name.includes(SESSION_COOKIE_NAME) && c.value.length > 0
    );
    expect(afterSession).toBeUndefined();
  });

  test('should redirect to /login when accessing a protected route after logout', async ({
    page,
  }) => {
    await login(page, SALARIE_EMAIL, SALARIE_PASSWORD);
    await Promise.all([
      page.waitForURL('**/login'),
      page.getByTestId('logout-button').click(),
    ]);

    await page.goto('/releves');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    expect(page.url()).toContain('callbackUrl=%2Freleves');
  });

  test('should expose the logout button with accessible attributes (keyboard + aria)', async ({
    page,
  }) => {
    await login(page, SALARIE_EMAIL, SALARIE_PASSWORD);

    const logoutButton = page.getByTestId('logout-button');
    await expect(logoutButton).toHaveAttribute('aria-label', 'Se deconnecter');
    await expect(logoutButton).toHaveAttribute('type', 'submit');

    // Keyboard : focus + Enter declenche la deconnexion.
    await logoutButton.focus();
    await expect(logoutButton).toBeFocused();
    await Promise.all([
      page.waitForURL('**/login', { timeout: 10_000 }),
      page.keyboard.press('Enter'),
    ]);

    expect(page.url()).toContain('/login');
  });
});
