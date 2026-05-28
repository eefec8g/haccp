import { resolveErrorFromTable } from '@/lib/utils/error-messages-resolver';

/**
 * Messages d'erreur partages entre les pages d'export (Epic EXPORT).
 *
 * Avant cette extraction, chaque page d'export dupliquait sa table
 * `ERROR_MESSAGES` + sa fonction `resolveErrorMessage`.
 * Les deux versions divergeaient sur 1-2 cles (range_too_large CSV-only,
 * libelles "registre" vs "export") avec un risque de drift.
 *
 * Strategie : table UNION (toutes les cles connues, libelles generiques),
 * une seule fonction `resolveExportErrorMessage`. Si une page a besoin
 * d'un libelle specifique (mode CSV vs PDF), elle peut soit overrider
 * via prop, soit accepter le libelle generique (les keys non-affichees
 * dans son contexte n'apparaitront simplement jamais).
 *
 * Code source d'erreur : ces strings sont les codes URL `?error=<code>`
 * emis par les Route Handlers `/api/exports/{csv,pdf}`. Ajouter une
 * nouvelle erreur Route Handler -> ajouter sa traduction ici.
 *
 * Resolution : delegue a `resolveErrorFromTable` (DRY avec
 * `export-consolide-error-messages.ts`).
 */

const RATE_LIMITED_CODE = 'rate_limited';

type ExportErrorCode =
  | 'validation'
  | 'boutique_not_found'
  | 'range_too_large'
  | 'rate_limited'
  | 'forbidden'
  | 'no_data'
  | 'internal';

export const EXPORT_ERROR_MESSAGES: Readonly<Record<ExportErrorCode, string>> =
  {
    validation:
      'Les parametres sont invalides. Verifiez le format des dates et la periode (90 jours max).',
    boutique_not_found:
      'La boutique selectionnee est introuvable ou hors de votre perimetre.',
    range_too_large:
      'La periode contient trop de releves (> 10 000). Reduisez la plage de dates.',
    rate_limited: "Trop d'exports recents. Reessayez dans quelques minutes.",
    forbidden: "Vous n'avez pas la permission de declencher cet export.",
    no_data: 'Aucun releve disponible sur la periode demandee.',
    internal: 'Une erreur interne est survenue. Reessayez plus tard.',
  };

/**
 * Resout le message a afficher pour un code d'erreur URL.
 *
 * @param error code emis par le Route Handler (`?error=...`)
 * @param retry duree d'attente facultative (`?retry=2m`) pour `rate_limited`
 * @returns message FR pret a afficher, ou `undefined` si pas d'erreur
 */
export function resolveExportErrorMessage(
  error: string | undefined,
  retry: string | undefined
): string | undefined {
  return resolveErrorFromTable(
    EXPORT_ERROR_MESSAGES,
    error,
    retry,
    RATE_LIMITED_CODE
  );
}
