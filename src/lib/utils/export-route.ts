import { NextResponse, type NextRequest } from 'next/server';
import type { ExportError } from '@/types/export';

/**
 * Helpers partages entre `GET /api/exports/csv` et `GET /api/exports/pdf`.
 *
 * Pourquoi un module dedie ?
 *   - Les deux routes implementent le meme pipeline error-redirect /
 *     parse query / map ExportError -> code URL. Les dupliquer copierait
 *     aussi les bugs (DRY review M1).
 *   - Le code reste pur (pas de I/O), donc trivialement testable hors
 *     contexte Next.js.
 */

/**
 * Construit la redirect 303 vers la page form de l'export avec les
 * parametres d'erreur en query string. La page form lit `?error=`
 * et `?retry=` pour afficher un message d'erreur localise.
 */
export function buildExportErrorRedirect(
  request: NextRequest,
  formPath: string,
  errorCode: string,
  extra?: Record<string, string>
): NextResponse {
  const url = new URL(formPath, request.url);
  url.searchParams.set('error', errorCode);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(url, 303);
}

/**
 * Mappe un `ExportError` (sortie Result du service) vers le code court
 * utilise dans `?error=` (consomme cote page form pour l'i18n).
 */
export function mapExportErrorCode(error: ExportError): string {
  switch (error) {
    case 'FORBIDDEN':
      return 'forbidden';
    case 'BOUTIQUE_NOT_FOUND':
      return 'boutique_not_found';
    case 'RANGE_TOO_LARGE':
      return 'range_too_large';
    case 'NO_DATA':
      return 'no_data';
    default:
      return 'internal';
  }
}

/**
 * Extrait les query params utiles a la validation Zod : on retire les
 * cles techniques de retour d'erreur (`error`, `retry` que la page form
 * a pu rajouter sur le lien retour) et on supprime les valeurs vides
 * pour ne pas faire echouer un `.optional()` sur `''`.
 */
export function readExportQueryParams(
  request: NextRequest
): Record<string, string> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'error' || key === 'retry') {
      continue;
    }
    if (value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
