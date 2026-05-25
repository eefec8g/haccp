'use client';

import { useActionState, useId } from 'react';
import type { Boutique } from '@prisma/client';
import {
  createBoutiqueAction,
  updateBoutiqueAction,
  INITIAL_BOUTIQUE_ACTION_STATE,
  type BoutiqueActionState,
  type BoutiqueActionFieldErrors,
} from '@/app/actions/admin-boutique';
import {
  BOUTIQUE_NOM_MAX,
  BOUTIQUE_ADRESSE_MAX,
  BOUTIQUE_VILLE_MAX,
} from '@/lib/constants/admin';
import { FormField } from './FormField';

type BoutiqueFormMode = 'create' | 'edit';

interface BoutiqueFormProps {
  readonly mode: BoutiqueFormMode;
  readonly boutique?: Boutique;
}

const INPUT_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const SUBMIT_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const ERROR_BOX_CLASSES =
  'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]';

const DUPLICATE_MESSAGE =
  'Une boutique avec ce nom et cette ville existe deja.';
const NOT_FOUND_MESSAGE = 'Cette boutique est introuvable ou a ete supprimee.';
const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a effectuer cette action.";
const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

function getGlobalErrorMessage(state: BoutiqueActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'DUPLICATE') {
    return DUPLICATE_MESSAGE;
  }
  if (state.code === 'NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
  }
  if (state.code === 'FORBIDDEN') {
    return FORBIDDEN_MESSAGE;
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

function firstError(
  fieldErrors: BoutiqueActionFieldErrors | undefined,
  field: keyof BoutiqueActionFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

/**
 * Formulaire de creation/edition d'une boutique.
 *
 * - `'use client'` : useActionState + useId pour la liaison aria.
 * - Une seule Server Action est cablee selon le `mode` (DRY).
 * - Les erreurs serveur retournent un Result type, mappe vers des
 *   messages utilisateur i18n cote client (pas de leak server-side).
 * - a11y : labels lies, aria-invalid/aria-describedby quand erreur,
 *   role="alert" + aria-live polite sur la zone d'erreur globale,
 *   aria-busy sur le bouton submit.
 */
export function BoutiqueForm({ mode, boutique }: BoutiqueFormProps) {
  const action =
    mode === 'create' ? createBoutiqueAction : updateBoutiqueAction;
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_BOUTIQUE_ACTION_STATE
  );

  const globalErrorId = useId();
  const globalError = getGlobalErrorMessage(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  const nomError = firstError(fieldErrors, 'nom');
  const adresseError = firstError(fieldErrors, 'adresse');
  const villeError = firstError(fieldErrors, 'ville');

  return (
    <form
      action={formAction}
      aria-label={
        mode === 'create'
          ? 'Formulaire de creation de boutique'
          : 'Formulaire de modification de boutique'
      }
      className="space-y-5"
      data-testid="boutique-form"
      noValidate
    >
      {mode === 'edit' && boutique ? (
        <input type="hidden" name="id" value={boutique.id} />
      ) : null}

      <FormField label="Nom" name="nom" required error={nomError ?? null}>
        <input
          id="nom"
          name="nom"
          type="text"
          required
          autoComplete="off"
          autoFocus={mode === 'create'}
          maxLength={BOUTIQUE_NOM_MAX}
          defaultValue={boutique?.nom ?? ''}
          placeholder="MG Paris 11"
          aria-invalid={!!nomError}
          aria-describedby={nomError ? 'nom-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="boutique-nom"
        />
      </FormField>

      <FormField
        label="Adresse"
        name="adresse"
        hint="Optionnel. 200 caracteres maximum."
        error={adresseError ?? null}
      >
        <input
          id="adresse"
          name="adresse"
          type="text"
          autoComplete="street-address"
          maxLength={BOUTIQUE_ADRESSE_MAX}
          defaultValue={boutique?.adresse ?? ''}
          placeholder="12 rue de la Paix"
          aria-invalid={!!adresseError}
          aria-describedby={adresseError ? 'adresse-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="boutique-adresse"
        />
      </FormField>

      <FormField
        label="Ville"
        name="ville"
        hint="Optionnel. 100 caracteres maximum."
        error={villeError ?? null}
      >
        <input
          id="ville"
          name="ville"
          type="text"
          autoComplete="address-level2"
          maxLength={BOUTIQUE_VILLE_MAX}
          defaultValue={boutique?.ville ?? ''}
          placeholder="Paris"
          aria-invalid={!!villeError}
          aria-describedby={villeError ? 'ville-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="boutique-ville"
        />
      </FormField>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="boutique-error"
      >
        {globalError}
      </div>

      {mode === 'edit' && state.status === 'success' ? (
        <p
          className="rounded-[7px] border border-[#13DEB9]/30 bg-[#E6FBF6] px-4 py-3 text-sm text-[#0F9F86]"
          role="status"
          aria-live="polite"
          data-testid="boutique-success"
        >
          Modifications enregistrees.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={SUBMIT_CLASSES}
          data-testid="boutique-submit"
        >
          {isPending
            ? 'Enregistrement...'
            : mode === 'create'
              ? 'Creer la boutique'
              : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
