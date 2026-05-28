/**
 * Types exportes pour la Server Action de changement de mot de passe.
 *
 * Ce fichier est SEPARE de `change-password.ts` (qui porte la directive
 * `'use server'`) car Next.js 15 enforce strictement que les fichiers
 * `'use server'` n'exportent QUE des fonctions async.
 */

/**
 * Cles d'erreur cote UI. Le composant client mappe vers le message FR :
 *
 * - `VALIDATION` : echec Zod (complexite du nouveau MDP, confirmation).
 * - `INVALID_CURRENT_PASSWORD` : mot de passe actuel faux.
 * - `SAME_PASSWORD` : nouveau MDP identique a l'actuel.
 * - `USER_NOT_FOUND` : compte introuvable ou desactive (cas limite).
 * - `INTERNAL` : erreur inattendue.
 */
export type ChangePasswordErrorCode =
  | 'VALIDATION'
  | 'INVALID_CURRENT_PASSWORD'
  | 'SAME_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'INTERNAL';

export type ChangePasswordActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: ChangePasswordErrorCode;
    };

export const INITIAL_CHANGE_PASSWORD_STATE: ChangePasswordActionState = {
  status: 'idle',
};
