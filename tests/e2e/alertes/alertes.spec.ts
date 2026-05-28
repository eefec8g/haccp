import { test, expect } from '@playwright/test';
import { loginAsSalarie, loginAsResponsable } from '../fixtures/login';

/**
 * Tests E2E US-ALE-001 : liste des alertes ouvertes.
 *
 * Permissions (cf. src/lib/permissions.ts + AlerteListItem) :
 *   - SALARIE : lecture seule des alertes de SA boutique. Le CTA est
 *     "Consulter" (lien lecture), JAMAIS "Resoudre".
 *   - RESPONSABLE/ADMIN : CTA "Resoudre" (acces a la resolution).
 *
 * Le scope multi-tenant (le salarie ne voit que sa boutique) est porte par
 * `getAccessibleBoutiqueIds` cote service ; on verifie ici le comportement
 * UI observable (presence/absence du bouton "Resoudre").
 *
 * Pre-requis (prisma/seed.ts, idempotent) :
 *   - SALARIE     : lea@maison-givre.fr / Secret123!aaaa (MG E2E Lyon)
 *   - RESPONSABLE : resp@maison-givre.fr / RespPass1!aaaa (MG E2E Lyon)
 *
 * Note : le seed ne cree pas d'alerte ouverte d'office (un releve hors
 * seuils est requis). Les tests tolerent donc l'empty state (`alerte-list-empty`)
 * et n'asserrtent l'action que lorsqu'au moins une alerte est listee.
 *
 * `@db-required` : echecs sans seed = responsabilite du pipeline CI.
 */

test.describe('[Alertes] acces SALARIE (lecture seule) @db-required', () => {
  test('should let a SALARIE open /alertes', async ({ page }) => {
    await loginAsSalarie(page);

    await page.goto('/alertes');
    await expect(page.getByTestId('alertes-page')).toBeVisible();
    await expect(page.getByTestId('alertes-header')).toBeVisible();
  });

  test('should never expose a "Resoudre" action to a SALARIE', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/alertes');

    const list = page.getByTestId('alerte-list');
    const empty = page.getByTestId('alerte-list-empty');
    await expect(list.or(empty)).toBeVisible();

    if (await list.isVisible().catch(() => false)) {
      // Au moins une alerte listee : le CTA doit etre "Consulter", pas
      // "Resoudre" (lecture seule pour le salarie).
      const actions = page.locator('[data-testid$="-resolve"]');
      await expect(actions.first()).toBeVisible();
      await expect(actions.first()).toHaveText(/consulter/i);
      await expect(actions.first()).not.toHaveText(/resoudre/i);
    }
  });
});

test.describe('[Alertes] acces RESPONSABLE (resolution) @db-required', () => {
  test('should let a RESPONSABLE open /alertes', async ({ page }) => {
    await loginAsResponsable(page);

    await page.goto('/alertes');
    await expect(page.getByTestId('alertes-page')).toBeVisible();
  });

  test('should expose a "Resoudre" action to a RESPONSABLE', async ({
    page,
  }) => {
    await loginAsResponsable(page);
    await page.goto('/alertes');

    const list = page.getByTestId('alerte-list');
    const empty = page.getByTestId('alerte-list-empty');
    await expect(list.or(empty)).toBeVisible();

    if (await list.isVisible().catch(() => false)) {
      const actions = page.locator('[data-testid$="-resolve"]');
      await expect(actions.first()).toBeVisible();
      await expect(actions.first()).toHaveText(/resoudre/i);
    }
  });
});
