/**
 * Mapping centralise des codes d'erreur Photo -> messages utilisateur FR
 * (US-PHO-001).
 *
 * Centralise pour eviter la duplication entre PhotoUploadForm et
 * PhotoDeleteButton (Clean Code DRY). Les deux Server Actions Photo
 * partagent un sous-ensemble de codes (FORBIDDEN, VALIDATION,
 * ALERTE_NOT_FOUND, INTERNAL) plus des codes specifiques (TOO_LARGE,
 * QUOTA_EXCEEDED, RATE_LIMITED, ... pour l'upload ; PHOTO_NOT_FOUND
 * pour la suppression).
 *
 * Le type cle est `string` (et non l'union `PhotoUploadActionErrorCode |
 * PhotoDeleteActionErrorCode`) afin que `resolvePhotoErrorMessage`
 * accepte n'importe quel code stringifie remonte par les actions sans
 * cast, avec un fallback explicite sur `INTERNAL` (Clean Code #7 :
 * gestion d'erreur defensive).
 */

const FALLBACK_INTERNAL_MESSAGE =
  'Une erreur interne est survenue. Reessayez plus tard.';

export const PHOTO_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  FORBIDDEN: "Vous n'avez pas la permission d'effectuer cette action.",
  VALIDATION: 'Donnees invalides.',
  ALERTE_NOT_FOUND: 'Alerte introuvable ou hors perimetre.',
  INVALID_MIME:
    'Format de fichier non supporte (JPEG, PNG ou WebP uniquement).',
  TOO_LARGE: 'Le fichier est trop volumineux apres compression.',
  QUOTA_EXCEEDED: 'Quota de photos atteint sur cette alerte (3 maximum).',
  STORAGE_FAILURE: 'Erreur de stockage. Reessayez dans quelques instants.',
  RATE_LIMITED: 'Trop de tentatives. Reessayez plus tard.',
  PHOTO_NOT_FOUND: 'Photo introuvable ou deja supprimee.',
  INTERNAL: FALLBACK_INTERNAL_MESSAGE,
};

/**
 * Resout le message utilisateur FR pour un code d'erreur Photo. Retourne
 * le message `INTERNAL` si le code est `undefined` ou inconnu (fallback
 * defensif pour ne jamais afficher de chaine vide).
 *
 * Note : avec `noUncheckedIndexedAccess` actif, l'acces a un Record par
 * index retourne `T | undefined`. On centralise donc le fallback via
 * `FALLBACK_INTERNAL_MESSAGE` qui est garanti `string`.
 */
export function resolvePhotoErrorMessage(code: string | undefined): string {
  if (!code) {
    return FALLBACK_INTERNAL_MESSAGE;
  }
  return PHOTO_ERROR_MESSAGES[code] ?? FALLBACK_INTERNAL_MESSAGE;
}
