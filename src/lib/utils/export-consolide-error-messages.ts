import { MAX_PERIODE_DAYS } from '@/lib/constants/export-consolide';
import { resolveErrorFromTable } from '@/lib/utils/error-messages-resolver';

/**
 * Messages d'erreur dedies a la page `/exports/registre-consolide` (Epic
 * REGISTRE US-REG-001 puis fix/csv-in-consolide).
 *
 * Cette page recoit desormais les redirects 303 de DEUX Route Handlers :
 *   - `/api/exports/registre-consolide` (PDF) : codes `periode_*`,
 *     `validation`, `boutique_not_found`, `rate_limited`, `forbidden`,
 *     `internal`.
 *   - `/api/exports/csv` : codes additionnels `range_too_large` (alias
 *     de `periode_too_large`, semantique identique pour l'utilisateur),
 *     `no_data` (CSV vide) -- les autres codes sont communs.
 *
 * Code source d'erreur : ces strings sont les codes URL `?error=<code>`
 * emis par les Route Handlers. Ajouter une nouvelle erreur -> ajouter
 * sa traduction ici.
 *
 * Resolution : delegue a `resolveErrorFromTable` (DRY avec
 * `export-error-messages.ts`).
 */

const RATE_LIMITED_CODE = 'rate_limited';

type ExportConsolideErrorCode =
  | 'validation'
  | 'periode_invalid'
  | 'periode_too_large'
  | 'periode_in_future'
  | 'boutique_not_found'
  | 'rate_limited'
  | 'forbidden'
  | 'range_too_large'
  | 'no_data'
  | 'internal';

export const EXPORT_CONSOLIDE_ERROR_MESSAGES: Readonly<
  Record<ExportConsolideErrorCode, string>
> = {
  validation:
    'Les parametres sont invalides. Verifiez le format des dates et la periode.',
  periode_invalid:
    'La date de fin doit etre superieure ou egale a la date de debut.',
  periode_too_large: `La periode doit etre inferieure ou egale a ${MAX_PERIODE_DAYS} jours.`,
  periode_in_future: 'La date de fin ne peut pas etre dans le futur.',
  boutique_not_found:
    'La boutique selectionnee est introuvable ou hors de votre perimetre.',
  rate_limited: "Trop d'exports recents. Reessayez dans quelques minutes.",
  forbidden: "Vous n'avez pas la permission de declencher cet export.",
  range_too_large: `La periode doit etre inferieure ou egale a ${MAX_PERIODE_DAYS} jours.`,
  no_data: 'Aucune donnee a exporter pour la periode selectionnee.',
  internal: 'Une erreur interne est survenue. Reessayez plus tard.',
};

/**
 * Resout le message a afficher pour un code d'erreur URL du registre
 * consolide. `retry` (optionnel) est concatene en suffixe humanise pour
 * `rate_limited`.
 */
export function resolveExportConsolideErrorMessage(
  error: string | undefined,
  retry: string | undefined
): string | undefined {
  return resolveErrorFromTable(
    EXPORT_CONSOLIDE_ERROR_MESSAGES,
    error,
    retry,
    RATE_LIMITED_CODE
  );
}
