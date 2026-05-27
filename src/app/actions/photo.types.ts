/**
 * Types et constantes exportes pour les Server Actions Photo
 * (US-PHO-001).
 *
 * Separe de `photo.ts` (qui porte la directive `'use server'`) car
 * Next.js 15 enforce strictement que les fichiers `'use server'`
 * n'exportent QUE des fonctions async.
 */

export type PhotoUploadActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'INVALID_FILE'
  | 'TOO_LARGE'
  | 'INVALID_MIME'
  | 'QUOTA_EXCEEDED'
  | 'ALERTE_NOT_FOUND'
  | 'STORAGE_FAILURE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface PhotoUploadFieldErrors {
  readonly alerteId?: readonly string[];
  readonly file?: readonly string[];
}

/**
 * Etat de l'action `uploadPhotoAction` :
 *   - idle    : pas encore soumis.
 *   - success : retour de la photo creee (id + imageUrl), utile pour
 *     l'UI optimistic update.
 *   - error   : code (+ fieldErrors si VALIDATION, retryAfterSeconds
 *     si RATE_LIMITED).
 */
export type PhotoUploadActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly photoId: string;
      readonly imageUrl: string;
    }
  | {
      readonly status: 'error';
      readonly code: PhotoUploadActionErrorCode;
      readonly fieldErrors?: PhotoUploadFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_PHOTO_UPLOAD_STATE: PhotoUploadActionState = {
  status: 'idle',
};

export type PhotoDeleteActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'ALERTE_NOT_FOUND'
  | 'INTERNAL';

export type PhotoDeleteActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: PhotoDeleteActionErrorCode;
    };

export const INITIAL_PHOTO_DELETE_STATE: PhotoDeleteActionState = {
  status: 'idle',
};
