/**
 * Types et constantes exportes pour les Server Actions admin Utilisateurs.
 *
 * Ce fichier est sciemment SEPARE de `admin-user.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async.
 */

export type UserActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'BOUTIQUE_NOT_FOUND'
  | 'LAST_ADMIN'
  | 'RATE_LIMITED'
  | 'INVALID'
  | 'INTERNAL';

export interface UserActionFieldErrors {
  readonly email?: readonly string[];
  readonly name?: readonly string[];
  readonly role?: readonly string[];
  readonly boutiqueSalarieId?: readonly string[];
  readonly boutiquesResponsable?: readonly string[];
  readonly token?: readonly string[];
  readonly password?: readonly string[];
  readonly confirmPassword?: readonly string[];
}

export type UserInviteActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: UserActionErrorCode;
      readonly fieldErrors?: UserActionFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export type AcceptInvitationActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: UserActionErrorCode;
      readonly fieldErrors?: UserActionFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_USER_INVITE_STATE: UserInviteActionState = {
  status: 'idle',
};

export const INITIAL_ACCEPT_INVITATION_STATE: AcceptInvitationActionState = {
  status: 'idle',
};
