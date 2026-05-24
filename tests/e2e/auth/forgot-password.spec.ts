import { test, expect } from '@playwright/test';

/**
 * Tests E2E US-AUTH-002 : Mot de passe oublie.
 *
 * Pre-requis (seed + Resend mock + Upstash) :
 *   - SALARIE actif : lea@maison-givre.fr (boutique rattachee)
 *
 * Les scenarios `@db-required` necessitent :
 *   1. La table PasswordResetToken accessible via le client Prisma de test,
 *      ou un endpoint admin de test pour inspecter / forger les tokens.
 *   2. Resend en mode mock (RESEND_API_KEY pointant vers un stub) OU
 *      simplement ne pas verifier l'envoi reel mais la presence du record DB.
 *   3. Upstash actif (rate-limit) ou stub avec keys reset entre les tests.
 *
 * Si l'infra de test n'est pas prete, ces scenarios echoueront sans masquer
 * un bug applicatif : la responsabilite incombe au pipeline CI.
 */

const EXISTING_EMAIL = 'lea@maison-givre.fr';
const UNKNOWN_EMAIL = 'ghost-unknown@example.com';
const GENERIC_SUCCESS_TEXT =
  'Si un compte existe pour cet email, un lien de reinitialisation';

test.describe('[US-AUTH-002] Forgot password - UI', () => {
  test('should render the forgot-password form with proper accessibility attributes', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    const form = page.getByTestId('forgot-form');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute(
      'aria-label',
      'Formulaire de demande de reinitialisation'
    );

    await expect(page.getByTestId('forgot-email')).toBeVisible();
    await expect(page.getByTestId('forgot-submit')).toBeEnabled();
    await expect(page.getByTestId('forgot-back-to-login')).toBeVisible();
  });

  test('should show a validation error when email is malformed', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    await page.getByTestId('forgot-email').fill('not-an-email');
    await page.getByTestId('forgot-submit').click();

    const message = page.getByTestId('forgot-message');
    await expect(message).toBeVisible();
    await expect(message).toHaveAttribute('role', 'alert');
    await expect(message).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByTestId('forgot-email')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });
});

test.describe('[US-AUTH-002] Forgot password - anti-enum @db-required', () => {
  test('should return the same generic success message for an existing email', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    await page.getByTestId('forgot-email').fill(EXISTING_EMAIL);
    await page.getByTestId('forgot-submit').click();

    const message = page.getByTestId('forgot-message');
    await expect(message).toBeVisible();
    await expect(message).toContainText(GENERIC_SUCCESS_TEXT);
  });

  test('should return the same generic success message for an unknown email (anti-enum)', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    await page.getByTestId('forgot-email').fill(UNKNOWN_EMAIL);
    await page.getByTestId('forgot-submit').click();

    const message = page.getByTestId('forgot-message');
    await expect(message).toBeVisible();
    await expect(message).toContainText(GENERIC_SUCCESS_TEXT);
  });
});

test.describe
  .serial('[US-AUTH-002] Forgot password - rate-limit @db-required', () => {
  test('should trigger rate-limit after 4 consecutive requests from the same IP', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    // 3 demandes autorisees : attendre l'affichage du message generique
    // (success ou erreur) avant le prochain submit pour eviter les sleeps flaky.
    for (let i = 0; i < 3; i += 1) {
      await page.getByTestId('forgot-email').fill(`spam+${i}@maison-givre.fr`);
      await page.getByTestId('forgot-submit').click();
      await expect(page.getByTestId('forgot-message')).toBeVisible();
      await expect(page.getByTestId('forgot-submit')).toBeEnabled();
    }

    // 4e demande : doit declencher le rate-limit.
    await page.getByTestId('forgot-email').fill('spam+final@maison-givre.fr');
    await page.getByTestId('forgot-submit').click();

    await expect(page.getByTestId('forgot-message')).toContainText(
      /trop de demandes|rate.?limit|patienter/i
    );
  });
});

test.describe('[US-AUTH-002] Reset password - UI', () => {
  test('should render the malformed-token screen for a too-short token', async ({
    page,
  }) => {
    await page.goto('/reset-password/short');

    await expect(page.getByTestId('reset-malformed')).toBeVisible();
    await expect(page.getByTestId('reset-request-new-link')).toBeVisible();
  });

  test('should render the reset form for a long-enough token (smoke)', async ({
    page,
  }) => {
    const fakeToken = 'a'.repeat(43);
    await page.goto(`/reset-password/${fakeToken}`);

    await expect(page.getByTestId('reset-form')).toBeVisible();
    await expect(page.getByTestId('reset-password')).toBeVisible();
    await expect(page.getByTestId('reset-confirm-password')).toBeVisible();
    await expect(page.getByTestId('reset-submit')).toBeEnabled();
  });

  test('should display the strength indicator live as the user types', async ({
    page,
  }) => {
    const fakeToken = 'a'.repeat(43);
    await page.goto(`/reset-password/${fakeToken}`);

    await page.getByTestId('reset-password').fill('Aa1!aaaaaaaaa');
    const okRules = page.getByTestId('password-rule-ok');
    await expect(okRules).toHaveCount(5);
  });

  test('should toggle password visibility and expose aria-pressed', async ({
    page,
  }) => {
    const fakeToken = 'a'.repeat(43);
    await page.goto(`/reset-password/${fakeToken}`);

    const toggle = page.getByTestId('reset-toggle-visibility');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('reset-password')).toHaveAttribute(
      'type',
      'text'
    );
  });
});

test.describe('[US-AUTH-002] Reset password - server validation @db-required', () => {
  test('should display a generic error for an invalid-or-expired token', async ({
    page,
  }) => {
    const unknownButLongToken = 'b'.repeat(43);
    await page.goto(`/reset-password/${unknownButLongToken}`);

    await page.getByTestId('reset-password').fill('StrongPass1!aaaaa');
    await page.getByTestId('reset-confirm-password').fill('StrongPass1!aaaaa');
    await page.getByTestId('reset-submit').click();

    const error = page.getByTestId('reset-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/invalide|expire/i);
  });

  test('should display a validation error when passwords do not match', async ({
    page,
  }) => {
    const fakeToken = 'c'.repeat(43);
    await page.goto(`/reset-password/${fakeToken}`);

    await page.getByTestId('reset-password').fill('StrongPass1!aaaaa');
    await page
      .getByTestId('reset-confirm-password')
      .fill('DifferentPass1!aaaaa');
    await page.getByTestId('reset-submit').click();

    const error = page.getByTestId('reset-error');
    await expect(error).toBeVisible();
  });
});
