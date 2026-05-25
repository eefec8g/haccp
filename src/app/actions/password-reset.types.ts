/**
 * Types et constantes exportes pour les Server Actions password reset.
 *
 * Ce fichier est sciemment SEPARE de `password-reset.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async.
 */

/**
 * Cles d'erreur cote UI. Le composant client mappe vers le message
 * i18n pour eviter toute fuite d'info dans la reponse server.
 */
export type ForgotPasswordErrorCode = 'VALIDATION' | 'RATE_LIMITED';

export type ForgotPasswordActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: ForgotPasswordErrorCode;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_FORGOT_PASSWORD_STATE: ForgotPasswordActionState = {
  status: 'idle',
};

export type ResetPasswordErrorCode =
  | 'VALIDATION'
  | 'INVALID_OR_EXPIRED'
  | 'INTERNAL';

export type ResetPasswordActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: ResetPasswordErrorCode;
    };

export const INITIAL_RESET_PASSWORD_STATE: ResetPasswordActionState = {
  status: 'idle',
};
