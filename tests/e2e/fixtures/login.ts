import { type Page, expect } from '@playwright/test';

/**
 * Helper de connexion partage pour les tests E2E `@db-required`.
 *
 * Factorise le pattern `loginAs` historiquement duplique dans chaque
 * fichier (admin/*, auth/*) : remplissage du formulaire `/login` via les
 * `data-testid` stables, puis attente du redirect post-login.
 *
 * Comptes seedes (cf. prisma/seed.ts, idempotent) :
 *   - ADMIN       : admin@maison-givre.fr / AdminPass1!aaaa
 *   - RESPONSABLE : resp@maison-givre.fr  / RespPass1!aaaa
 *   - SALARIE     : lea@maison-givre.fr   / Secret123!aaaa
 *
 * Decision (feat/dashboard-as-home) : TOUS les roles sont rediriges vers
 * `/dashboard` apres connexion (POST_LOGIN_REDIRECT).
 */

export const ADMIN_EMAIL = 'admin@maison-givre.fr';
export const ADMIN_PASSWORD = 'AdminPass1!aaaa';
export const RESPONSABLE_EMAIL = 'resp@maison-givre.fr';
export const RESPONSABLE_PASSWORD = 'RespPass1!aaaa';
export const SALARIE_EMAIL = 'lea@maison-givre.fr';
export const SALARIE_PASSWORD = 'Secret123!aaaa';

/** Redirect post-login commun a tous les roles. */
export const DASHBOARD_PATH = /\/dashboard$/;

/**
 * Connecte un utilisateur via l'UI et attend le redirect `expectedPath`
 * (par defaut `/dashboard`, cible post-login de tous les roles).
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectedPath: RegExp = DASHBOARD_PATH
): Promise<void> {
  // Le `LoginForm` est un Client Component : son `onSubmit` (preventDefault
  // + signIn) n'intercepte le clic qu'APRES hydratation. Un clic premature
  // declenche le submit GET natif (`/login?email=...&password=...`), qui
  // n'authentifie pas. En dev (compile JIT au 1er hit), l'hydratation peut
  // arriver tard : on attend un signal d'hydratation, et on retente si le
  // fallback GET se produit malgre tout.
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await page.goto('/login');
    await waitForHydration(page);

    const submit = page.getByTestId('login-submit');
    await submit.waitFor({ state: 'visible' });
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await submit.click();

    try {
      // Le redirect post-login peut declencher une compilation JIT de la
      // page cible en dev (cold) : budget large.
      await page.waitForURL(expectedPath, { timeout: 20_000 });
      return;
    } catch (error) {
      // Submit GET natif (form non hydrate) : les credentials se retrouvent
      // en query string. On retente une fois le bundle (re)charge/hydrate.
      if (page.url().includes('password=') && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Attend un signal d'hydratation cote client : le runtime Next.js App
 * Router expose `window.__next_f` (flight payload) une fois le bundle
 * charge. Tolerant (timeout court non bloquant) : si le signal n'arrive
 * pas, le retry sur fallback GET prend le relais.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        Array.isArray((window as unknown as { __next_f?: unknown }).__next_f) &&
        (window as unknown as { __next_f: unknown[] }).__next_f.length > 0,
      undefined,
      { timeout: 15_000 }
    )
    .catch(() => {
      // Pas de signal dans le delai : on laisse le retry GET-fallback gerer.
    });
}

/** Raccourci : connecte l'ADMIN seede. */
export function loginAsAdmin(page: Page): Promise<void> {
  return loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Raccourci : connecte le RESPONSABLE seede. */
export function loginAsResponsable(page: Page): Promise<void> {
  return loginAs(page, RESPONSABLE_EMAIL, RESPONSABLE_PASSWORD);
}

/** Raccourci : connecte le SALARIE seede. */
export function loginAsSalarie(page: Page): Promise<void> {
  return loginAs(page, SALARIE_EMAIL, SALARIE_PASSWORD);
}

/** Verifie qu'une session NextAuth est bien posee apres connexion. */
export async function expectSessionCookie(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) =>
    c.name.includes('authjs.session-token')
  );
  expect(sessionCookie).toBeDefined();
}
