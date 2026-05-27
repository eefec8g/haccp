/**
 * Mapping centralise des codes d'erreur Signature -> messages utilisateur FR
 * (US-SIG-001).
 *
 * Centralise pour eviter la duplication entre `SignatureUploadForm` (Phase 2)
 * et toute autre UI consommant les Server Actions Signature (Clean Code DRY).
 *
 * Le type cle est `string` (et non l'union stricte) afin que
 * `resolveSignatureErrorMessage` accepte n'importe quel code stringifie
 * remonte par les actions sans cast, avec un fallback explicite sur
 * `INTERNAL` (Clean Code #7 : gestion d'erreur defensive).
 */

const FALLBACK_INTERNAL_MESSAGE =
  'Une erreur interne est survenue. Reessayez plus tard.';

export const SIGNATURE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  FORBIDDEN: "Vous n'avez pas la permission de signer ce registre.",
  VALIDATION: 'Donnees invalides.',
  INVALID_FILE: 'Fichier signature requis.',
  BOUTIQUE_NOT_FOUND: 'Boutique introuvable ou hors perimetre.',
  SIGNATURE_NOT_FOUND: 'Aucune signature trouvee pour ce registre.',
  SIGNATURE_ALREADY_EXISTS: 'Ce registre a deja ete signe pour cette journee.',
  INVALID_MIME:
    'Format de fichier non supporte (PNG uniquement pour les signatures).',
  TOO_LARGE: 'Le fichier signature est trop volumineux (200 Ko maximum).',
  MAGIC_BYTES_FAIL: 'Le fichier ne correspond pas a une signature PNG valide.',
  STORAGE_FAILURE: 'Erreur de stockage. Reessayez dans quelques instants.',
  RATE_LIMITED: 'Trop de tentatives. Reessayez plus tard.',
  INTERNAL: FALLBACK_INTERNAL_MESSAGE,
};

/**
 * Resout le message utilisateur FR pour un code d'erreur Signature.
 * Retourne le message `INTERNAL` si le code est `undefined` ou inconnu
 * (fallback defensif pour ne jamais afficher de chaine vide).
 *
 * Note : avec `noUncheckedIndexedAccess` actif, l'acces a un Record par
 * index retourne `T | undefined`. On centralise donc le fallback via
 * `FALLBACK_INTERNAL_MESSAGE` qui est garanti `string`.
 */
export function resolveSignatureErrorMessage(code: string | undefined): string {
  if (!code) {
    return FALLBACK_INTERNAL_MESSAGE;
  }
  return SIGNATURE_ERROR_MESSAGES[code] ?? FALLBACK_INTERNAL_MESSAGE;
}
