/**
 * Types et constantes exportes pour la Server Action Signature
 * (US-SIG-001).
 *
 * Separe de `signature.ts` (qui porte la directive `'use server'`) car
 * Next.js 15 enforce strictement que les fichiers `'use server'`
 * n'exportent QUE des fonctions async.
 */

export type SignatureUploadActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'INVALID_FILE'
  | 'TOO_LARGE'
  | 'INVALID_MIME'
  | 'MAGIC_BYTES_FAIL'
  | 'BOUTIQUE_NOT_FOUND'
  | 'SIGNATURE_ALREADY_EXISTS'
  | 'STORAGE_FAILURE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface SignatureUploadFieldErrors {
  readonly boutiqueId?: readonly string[];
  readonly dateISO?: readonly string[];
  readonly file?: readonly string[];
}

/**
 * Etat de l'action `signatureUploadAction` :
 *   - idle    : pas encore soumis.
 *   - success : retour de la signature creee (id + imageUrl + signedAt),
 *     utile pour l'UI optimistic update.
 *   - error   : code (+ fieldErrors si VALIDATION, retryAfterSeconds si
 *     RATE_LIMITED).
 */
export type SignatureUploadActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly signatureId: string;
      readonly imageUrl: string;
      readonly signedAt: string;
    }
  | {
      readonly status: 'error';
      readonly code: SignatureUploadActionErrorCode;
      readonly fieldErrors?: SignatureUploadFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_SIGNATURE_UPLOAD_STATE: SignatureUploadActionState = {
  status: 'idle',
};
