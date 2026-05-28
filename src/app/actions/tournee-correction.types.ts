/**
 * Types de la Server Action `tournee-correction`
 * (fix/signature-action-context).
 *
 * Volontairement separe du fichier `'use server'` : Next.js 15 enforce
 * strictement qu'un fichier avec directive `'use server'` n'exporte QUE
 * des fonctions async.
 *
 * Cette action permet au SALARIE de corriger SON PROPRE releve du jour
 * depuis le recap de la tournee guidee, AVANT signature. La correction
 * est une annulation tracee (motif auto) + un nouveau releve actif
 * (RG-IMMU-001), jamais un UPDATE/DELETE.
 *
 * Comme `tournee-saisie` :
 *   - Pas de redirect : le client recoit `status: 'success'` et revient
 *     au recap avec la valeur a jour.
 *   - Renvoie `releve` (id + temperature + alerte) pour que le client
 *     mette a jour son cache local immediatement.
 */

export type TourneeCorrectionErrorCode =
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'NOT_TODAY'
  | 'CRENEAU_MISMATCH'
  | 'ALREADY_CANCELLED'
  | 'TOURNEE_DEJA_SIGNEE'
  | 'COMMENTAIRE_REQUIRED'
  | 'INTERNAL';

export interface TourneeCorrectionFieldErrors {
  readonly releveId?: readonly string[];
  readonly equipementId?: readonly string[];
  readonly creneau?: readonly string[];
  readonly temperature?: readonly string[];
  readonly commentaire?: readonly string[];
}

export interface TourneeCorrectionSuccessReleve {
  readonly id: string;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  /**
   * Instant exact de saisie (`Releve.createdAt`) au format ISO 8601.
   * Serialise en string (boundary Server Action -> client). Le client
   * convertit en `Date` pour preserver `TourneeReleve.saisiAt`.
   */
  readonly saisiAt: string;
}

export type TourneeCorrectionActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly equipementId: string;
      readonly releve: TourneeCorrectionSuccessReleve;
    }
  | {
      readonly status: 'error';
      readonly code: TourneeCorrectionErrorCode;
      readonly fieldErrors?: TourneeCorrectionFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_TOURNEE_CORRECTION_STATE: TourneeCorrectionActionState = {
  status: 'idle',
};
