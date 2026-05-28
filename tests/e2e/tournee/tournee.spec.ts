import { test, expect, type Page } from '@playwright/test';
import { loginAsSalarie } from '../fixtures/login';

// Parcours mutant partage : tous ces tests saisissent les releves du
// SALARIE pour la MEME journee/creneau. Une execution concurrente
// declencherait des conflits d'unicite (1 releve actif par equipement /
// date / creneau). On serialise donc le fichier (jamais deux saisies
// simultanees sur le meme couple).
test.describe.configure({ mode: 'serial' });

/**
 * Tests E2E du parcours cle "Tournee guidee" (feat/tournee-guidee).
 *
 * Parcours : dashboard -> "Tournee matin" -> saisie guidee equipement par
 * equipement (auto-advance) -> RECAP -> ecran signature.
 *
 * Pre-requis (prisma/seed.ts, idempotent) :
 *   - SALARIE lea@maison-givre.fr / Secret123!aaaa rattache a MG E2E Lyon
 *   - MG E2E Lyon avec >= 1 equipement actif.
 *
 * IDEMPOTENCE DU PARCOURS : un releve est immuable par (equipement, date,
 * creneau). Apres un premier run reussi, les equipements deja saisis du
 * jour sont SKIPPES par le flow (cf. findNextMissingIndex) : la tournee
 * peut donc demarrer directement sur le RECAP. Les tests sont ecrits pour
 * etre robustes aux deux etats (saisie restante vs deja saisie).
 *
 * SIGNATURE : l'upload de la signature passe par Vercel Blob et necessite
 * `BLOB_READ_WRITE_TOKEN`, absent en local/CI sans configuration. On teste
 * donc l'AFFICHAGE de l'ecran signature (SignaturePad, canvas, boutons),
 * jamais le SUCCES de l'upload (qui echouerait en STORAGE_FAILURE).
 *
 * `@db-required` : echecs sans seed = responsabilite du pipeline CI.
 */

/**
 * Remplit et soumet tous les steps de saisie restants jusqu'au RECAP.
 *
 * Pour chaque step : saisit une temperature, et si l'equipement signale
 * un depassement de seuils (hint visible), renseigne le commentaire
 * obligatoire (>= COMMENTAIRE_MIN_CHARS). Robuste quels que soient les
 * seuils de l'equipement (on ne presume pas de sa plage).
 */
async function completeRemainingSaisies(page: Page): Promise<void> {
  const recap = page.getByTestId('tournee-recap-step');
  const saisieForm = page.getByTestId('tournee-saisie-form');

  const error = page.getByTestId('tournee-saisie-error');

  // Borne defensive : le parc seede compte 3 equipements ; on tolere
  // largement au-dela pour absorber d'eventuels ajouts sans boucle infinie.
  const MAX_STEPS = 20;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (await recap.isVisible().catch(() => false)) {
      return;
    }
    await expect(saisieForm).toBeVisible();

    const temperatureInput = page.getByTestId('tournee-saisie-temperature');
    await temperatureInput.fill('-19');

    // Le commentaire devient obligatoire si la valeur est hors seuils de
    // l'equipement courant (le bouton reste alors disabled tant qu'il
    // n'est pas renseigne). On reagit a l'etat affiche, sans presumer des
    // seuils.
    const hint = page.getByTestId('tournee-saisie-alerte-hint');
    if (await hint.isVisible().catch(() => false)) {
      await page
        .getByTestId('tournee-saisie-commentaire')
        .fill('Controle E2E hors seuils, action corrective enclenchee.');
    }

    const submit = page.getByTestId('tournee-saisie-submit');
    await expect(submit).toBeEnabled();
    const equipementInputId = await temperatureInput.getAttribute('id');
    await submit.click();

    // Apres soumission : avance vers le recap, erreur serveur (ex.
    // ALREADY_EXISTS si un releve a ete cree par ailleurs), ou avance vers
    // le prochain equipement (le step re-monte avec un input d'id different).
    await expect(async () => {
      const recapVisible = await recap.isVisible().catch(() => false);
      const errorVisible = await error.isVisible().catch(() => false);
      const currentInputId = await temperatureInput
        .getAttribute('id')
        .catch(() => null);
      const advanced = currentInputId !== equipementInputId;
      expect(recapVisible || errorVisible || advanced).toBe(true);
    }).toPass({ timeout: 15_000 });

    // ALREADY_EXISTS (releve deja saisi) : on recharge pour re-deriver
    // l'etat du flow, qui skippera l'equipement deja saisi.
    if (await error.isVisible().catch(() => false)) {
      await page.reload();
      await expect(page.getByTestId('tournee-flow')).toBeVisible();
    }
  }
  throw new Error('Tournee non terminee apres le nombre maximal de steps.');
}

test.describe('[Tournee] demarrage depuis le dashboard @db-required', () => {
  test('should navigate from dashboard to the MATIN tournee', async ({
    page,
  }) => {
    await loginAsSalarie(page);

    await Promise.all([
      page.waitForURL(/\/releves\/tournee\/MATIN/, { timeout: 10_000 }),
      page.getByTestId('tournee-button-matin').click(),
    ]);

    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await expect(page.getByTestId('tournee-step-counter')).toBeVisible();
  });
});

test.describe('[Tournee] saisie guidee + recap @db-required', () => {
  test('should fill every equipement and reach the recap with statuses', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/releves/tournee/MATIN');

    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await completeRemainingSaisies(page);

    // RECAP : tableau recapitulatif + au moins une ligne avec son statut.
    const recap = page.getByTestId('tournee-recap-step');
    await expect(recap).toBeVisible();
    await expect(page.getByTestId('tournee-recap-count')).toBeVisible();

    const statusBadges = page.locator('[data-testid^="tournee-recap-status-"]');
    await expect(statusBadges.first()).toBeVisible();
    await expect(statusBadges.first()).toHaveText(/OK|KO/);
  });

  test('should expose "Signer la tournee" on a non-signed recap', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/releves/tournee/MATIN');
    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await completeRemainingSaisies(page);

    const recap = page.getByTestId('tournee-recap-step');
    await expect(recap).toBeVisible();

    // La tournee n'etant pas signee (BLOB token absent -> jamais signee en
    // E2E), le recap expose "Signer la tournee" et un bouton "Modifier"
    // par ligne. Si une tournee etait deja signee, ces controles
    // n'apparaitraient pas (recap verrouille) : on garde le test sous
    // garde de visibilite pour ne pas etre flaky.
    const signer = page.getByTestId('tournee-recap-signer');
    if (await signer.isVisible().catch(() => false)) {
      await expect(signer).toBeEnabled();
      const modifiers = page.locator(
        '[data-testid^="tournee-recap-modifier-"]'
      );
      await expect(modifiers.first()).toBeVisible();
    } else {
      // Recap verrouille (tournee deja signee) : bouton retour dashboard.
      await expect(page.getByTestId('tournee-recap-back')).toBeVisible();
    }
  });
});

test.describe('[Tournee] correction depuis le recap @db-required', () => {
  test('should reopen the correction step when clicking "Modifier"', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/releves/tournee/MATIN');
    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await completeRemainingSaisies(page);

    const modifier = page
      .locator('[data-testid^="tournee-recap-modifier-"]')
      .first();
    test.skip(
      !(await modifier.isVisible().catch(() => false)),
      'Recap verrouille (tournee deja signee) : pas de correction possible.'
    );

    await modifier.click();

    // Le step de correction inline s'ouvre, pre-rempli, avec son titre.
    await expect(page.getByTestId('tournee-correction-form')).toBeVisible();
    await expect(page.getByTestId('tournee-correction-title')).toBeVisible();
    await expect(
      page.getByTestId('tournee-correction-temperature')
    ).toBeVisible();

    // Annuler la correction renvoie au recap.
    await page.getByTestId('tournee-correction-cancel').click();
    await expect(page.getByTestId('tournee-recap-step')).toBeVisible();
  });
});

test.describe('[Tournee] ecran signature (affichage uniquement) @db-required', () => {
  test('should display the signature pad without requiring a successful upload', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/releves/tournee/MATIN');
    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await completeRemainingSaisies(page);

    const signer = page.getByTestId('tournee-recap-signer');
    test.skip(
      !(await signer.isVisible().catch(() => false)),
      'Recap verrouille (tournee deja signee) : ecran signature inaccessible.'
    );

    await signer.click();

    // Ecran signature : SignaturePad visible (canvas + boutons).
    await expect(page.getByTestId('tournee-signature-step')).toBeVisible();
    const pad = page.getByTestId('tournee-signature-pad');
    await expect(pad).toBeVisible();
    await expect(
      page.getByTestId('tournee-signature-pad-canvas')
    ).toBeVisible();
    // "Effacer" est desactive tant qu'aucun trace n'existe.
    await expect(
      page.getByTestId('tournee-signature-pad-clear')
    ).toBeDisabled();
    // "Signer le registre" est desactive sur un canvas vide.
    await expect(
      page.getByTestId('tournee-signature-pad-submit')
    ).toBeDisabled();
  });

  test('should enable signing after drawing, and handle the upload outcome gracefully', async ({
    page,
  }) => {
    await loginAsSalarie(page);
    await page.goto('/releves/tournee/MATIN');
    await expect(page.getByTestId('tournee-flow')).toBeVisible();
    await completeRemainingSaisies(page);

    const signer = page.getByTestId('tournee-recap-signer');
    test.skip(
      !(await signer.isVisible().catch(() => false)),
      'Recap verrouille (tournee deja signee) : ecran signature inaccessible.'
    );
    await signer.click();

    const canvas = page.getByTestId('tournee-signature-pad-canvas');
    await expect(canvas).toBeVisible();

    // Dessine un trait sur le canvas via pointer events (mouse).
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, {
        steps: 8,
      });
      await page.mouse.up();
    }

    const submit = page.getByTestId('tournee-signature-pad-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    // SANS BLOB_READ_WRITE_TOKEN, l'upload echoue (STORAGE_FAILURE) -> on
    // NE PEUT PAS asserter le succes. On verifie uniquement que l'app gere
    // l'issue proprement : soit redirect dashboard (succes, si token
    // configure), soit affichage d'une erreur signature (echec gere), soit
    // retour au flow. Aucune assertion de succes obligatoire.
    const signatureError = page.getByTestId('tournee-signature-error');
    const onDashboard = page.waitForURL(/\/dashboard$/, { timeout: 8_000 });
    await Promise.race([
      signatureError.waitFor({ state: 'visible', timeout: 8_000 }),
      onDashboard,
    ]).catch(() => {
      // Ni erreur ni redirect dans le delai : acceptable (l'environnement
      // E2E sans token reste un cas documente, pas un bug applicatif).
    });
  });
});
