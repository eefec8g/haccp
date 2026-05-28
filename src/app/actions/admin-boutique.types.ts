/**
 * Types et constantes exportes pour les Server Actions admin Boutique.
 *
 * Ce fichier est sciemment SEPARE de `admin-boutique.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async.
 */

export type BoutiqueActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'INVALID'
  | 'INTERNAL';

export interface BoutiqueActionFieldErrors {
  readonly nom?: readonly string[];
  readonly adresse?: readonly string[];
  readonly ville?: readonly string[];
  readonly dateOuverture?: readonly string[];
  readonly id?: readonly string[];
}

export type BoutiqueActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: BoutiqueActionErrorCode;
      readonly fieldErrors?: BoutiqueActionFieldErrors;
    };

export const INITIAL_BOUTIQUE_ACTION_STATE: BoutiqueActionState = {
  status: 'idle',
};
