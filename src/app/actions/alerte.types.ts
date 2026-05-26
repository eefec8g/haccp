/**
 * Types et constantes exportes pour les Server Actions Alerte
 * (US-ALE-002).
 *
 * Ce fichier est sciemment SEPARE de `alerte.ts` (qui porte la directive
 * `'use server'`) car Next.js 15 enforce strictement que les fichiers
 * `'use server'` n'exportent QUE des fonctions async.
 */

export type AlerteActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'ALREADY_RESOLVED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface AlerteFieldErrors {
  readonly alerteId?: readonly string[];
  readonly commentaireResolution?: readonly string[];
}

/**
 * Etat de l'action `resolveAlerteAction` modelise comme une union
 * discriminee sur `status` :
 *   - idle    : etat initial (pas encore soumis).
 *   - success : alerte resolue, embarque `redirectTo` pour l'UI.
 *               L'action elle-meme effectue le `redirect()` mais on
 *               garde la cible dans l'etat pour les tests/observabilite.
 *   - error   : code (+ fieldErrors si VALIDATION, retryAfterSeconds
 *               si RATE_LIMITED).
 */
export type AlerteResolveActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly redirectTo: string;
    }
  | {
      readonly status: 'error';
      readonly code: AlerteActionErrorCode;
      readonly fieldErrors?: AlerteFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_ALERTE_RESOLVE_STATE: AlerteResolveActionState = {
  status: 'idle',
};
