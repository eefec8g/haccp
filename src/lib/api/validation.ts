import type { ZodError } from 'zod';

/**
 * Helpers d'extraction de messages Zod pour les API routes.
 *
 * Le client n'a pas besoin du detail JSON-path / code Zod, il veut
 * un message FR clair affichable directement. On expose donc le
 * `message` de la PREMIERE issue (l'ordre Zod = ordre de declaration
 * du schema, ce qui est intuitif pour l'utilisateur).
 */

const DEFAULT_VALIDATION_MESSAGE = 'Donnees invalides';

/**
 * Extrait le message du premier `ZodIssue` rencontre. Si le ZodError est
 * vide (cas degenere defensif), retourne un message generique FR.
 */
export function extractFirstValidationError(error: ZodError): string {
  return error.issues[0]?.message ?? DEFAULT_VALIDATION_MESSAGE;
}
