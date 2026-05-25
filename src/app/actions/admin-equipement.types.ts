/**
 * Types et constantes exportes pour les Server Actions admin Equipement.
 *
 * Ce fichier est sciemment SEPARE de `admin-equipement.ts` (qui porte la
 * directive `'use server'`) car Next.js 15 enforce strictement que les
 * fichiers `'use server'` n'exportent QUE des fonctions async.
 */

export type EquipementActionErrorCode =
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'BOUTIQUE_NOT_FOUND'
  | 'INVALID'
  | 'INTERNAL';

export interface EquipementActionFieldErrors {
  readonly nom?: readonly string[];
  readonly type?: readonly string[];
  readonly boutiqueId?: readonly string[];
  readonly seuilMin?: readonly string[];
  readonly seuilMax?: readonly string[];
  readonly id?: readonly string[];
}

export type EquipementActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly code: EquipementActionErrorCode;
      readonly fieldErrors?: EquipementActionFieldErrors;
    };

export const INITIAL_EQUIPEMENT_ACTION_STATE: EquipementActionState = {
  status: 'idle',
};
