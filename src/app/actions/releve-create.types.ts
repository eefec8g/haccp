/**
 * Types et constantes exportes pour la Server Action createReleve (US-REL-002).
 *
 * Ce fichier est sciemment SEPARE de `releve-create.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async.
 */

export type ReleveCreateActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'EQUIPEMENT_NOT_FOUND'
  | 'EQUIPEMENT_INACTIVE'
  | 'BOUTIQUE_FORBIDDEN'
  | 'ALREADY_EXISTS'
  | 'COMMENTAIRE_REQUIRED'
  | 'INTERNAL';

export interface ReleveCreateActionFieldErrors {
  readonly equipementId?: readonly string[];
  readonly creneau?: readonly string[];
  readonly temperature?: readonly string[];
  readonly commentaire?: readonly string[];
}

export type ReleveCreateActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: ReleveCreateActionErrorCode;
      readonly fieldErrors?: ReleveCreateActionFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_RELEVE_CREATE_STATE: ReleveCreateActionState = {
  status: 'idle',
};
