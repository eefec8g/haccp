/**
 * Types de la Server Action `tournee-saisie` (feat/tournee-guidee).
 *
 * Volontairement separe du fichier `'use server'` : Next.js 15 enforce
 * strictement qu'un fichier avec directive `'use server'` n'exporte
 * QUE des fonctions async.
 *
 * La difference avec `releve-create` :
 *   - Pas de redirect : le client recoit `status: 'success'` et passe
 *     au step suivant sans navigation.
 *   - Renvoie `releve` (id + alerte) pour que le client puisse mettre a
 *     jour son cache local immediatement.
 */

export type TourneeSaisieErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'EQUIPEMENT_NOT_FOUND'
  | 'EQUIPEMENT_INACTIVE'
  | 'BOUTIQUE_FORBIDDEN'
  | 'ALREADY_EXISTS'
  | 'COMMENTAIRE_REQUIRED'
  | 'INTERNAL';

export interface TourneeSaisieFieldErrors {
  readonly equipementId?: readonly string[];
  readonly creneau?: readonly string[];
  readonly temperature?: readonly string[];
  readonly commentaire?: readonly string[];
}

export interface TourneeSaisieSuccessReleve {
  readonly id: string;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  /**
   * Instant exact de saisie (`Releve.createdAt`) au format ISO 8601.
   *
   * Serialise en string pour rester compatible avec le boundary
   * Server Action -> client (Next.js 15 serialise les Date en JSON brut
   * sans reviver). Le client convertit en `Date` au moment d'updater
   * `localReleves` pour preserver le type `TourneeReleve.saisiAt`.
   */
  readonly saisiAt: string;
}

export type TourneeSaisieActionState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'success';
      readonly equipementId: string;
      readonly releve: TourneeSaisieSuccessReleve;
    }
  | {
      readonly status: 'error';
      readonly code: TourneeSaisieErrorCode;
      readonly fieldErrors?: TourneeSaisieFieldErrors;
      readonly retryAfterSeconds?: number;
    };

export const INITIAL_TOURNEE_SAISIE_STATE: TourneeSaisieActionState = {
  status: 'idle',
};
