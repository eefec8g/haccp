/**
 * Types et constantes exportes pour la Server Action d'annulation/
 * correction d'un releve (US-REL-004).
 *
 * Fichier sciemment SEPARE de `releve-correction.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async. Meme
 * pattern que `admin-user.types.ts` / `admin-boutique.types.ts`.
 */

export type ReleveCorrectionActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'COMMENTAIRE_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ReleveCorrectionFieldErrors {
  readonly releveId?: readonly string[];
  readonly motif?: readonly string[];
  readonly replacementTemperature?: readonly string[];
  readonly replacementCommentaire?: readonly string[];
}

export type ReleveCorrectionActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly redirectTo: string }
  | {
      readonly status: 'error';
      readonly code: ReleveCorrectionActionErrorCode;
      readonly fieldErrors?: ReleveCorrectionFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_RELEVE_CORRECTION_STATE: ReleveCorrectionActionState = {
  status: 'idle',
};
