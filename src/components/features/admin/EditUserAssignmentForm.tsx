'use client';

import { useActionState, useId, useState } from 'react';
import type { UserRole } from '@prisma/client';
import { updateUserAssignmentAction } from '@/app/actions/admin-user';
import {
  INITIAL_UPDATE_USER_ASSIGNMENT_STATE,
  type UpdateUserAssignmentActionState,
  type UserActionFieldErrors,
} from '@/app/actions/admin-user.types';
import { USER_ROLE_LABELS } from '@/lib/constants/user-labels';
import { ASSIGNABLE_ROLES } from '@/lib/constants/admin';
import {
  INPUT_CLASSES,
  SUBMIT_CLASSES,
  ERROR_BOX_CLASSES,
} from '@/components/features/ui/form-styles';
import { FormField } from './FormField';

export interface EditUserBoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville?: string | null;
}

interface EditUserAssignmentFormProps {
  readonly userId: string;
  readonly initialRole: UserRole;
  readonly initialBoutiqueSalarieId: string | null;
  readonly initialBoutiqueIdsResponsable: readonly string[];
  readonly boutiques: readonly EditUserBoutiqueOption[];
}

const CHECKBOX_GROUP_CLASSES =
  'space-y-2 border border-mg-noir/15 bg-mg-ivoire p-4';
const SUCCESS_BOX_CLASSES =
  'border border-mg-or/40 bg-mg-or/5 px-4 py-3 text-xs font-light uppercase tracking-[0.15em] text-mg-noir';

const SUCCESS_MESSAGE = 'Les rattachements ont ete mis a jour.';
const NOT_FOUND_MESSAGE = "Cet utilisateur n'existe plus.";
const BOUTIQUE_INVALID_MESSAGE =
  'Une des boutiques selectionnees est introuvable ou desactivee.';
const LAST_ADMIN_MESSAGE =
  'Impossible de retrograder le dernier administrateur actif. ' +
  'Promouvez un autre administrateur au prealable.';
const INVALID_ASSIGNMENT_MESSAGE =
  'Le rattachement de boutique est incompatible avec le role choisi.';
const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a effectuer cette action.";
const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

function getGlobalErrorMessage(
  state: UpdateUserAssignmentActionState
): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
  }
  if (state.code === 'BOUTIQUE_NOT_FOUND') {
    return BOUTIQUE_INVALID_MESSAGE;
  }
  if (state.code === 'LAST_ADMIN') {
    return LAST_ADMIN_MESSAGE;
  }
  if (state.code === 'INVALID_ASSIGNMENT') {
    return INVALID_ASSIGNMENT_MESSAGE;
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
  fieldErrors: UserActionFieldErrors | undefined,
  field: keyof UserActionFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

function formatBoutiqueOption(boutique: EditUserBoutiqueOption): string {
  if (boutique.ville && boutique.ville.length > 0) {
    return `${boutique.nom} - ${boutique.ville}`;
  }
  return boutique.nom;
}

/**
 * Formulaire d'edition des rattachements d'un user existant (US-ADM-006).
 *
 * Calque `UserInviteForm` : le selecteur de boutique change selon le role
 *   - SALARIE      : <select> requis (1 boutique)
 *   - RESPONSABLE  : checkboxes multi-select (>= 1 boutique)
 *   - ADMIN        : aucun selecteur (acces a toutes)
 *
 * Pre-rempli avec l'etat courant (role + boutiques). Le role pilote le
 * rendu conditionnel via `useState` ; les boutiques sont uncontrolled
 * (defaultValue/defaultChecked) pour preserver la saisie en cas d'erreur.
 *
 * a11y : labels lies (FormField), aria-invalid/aria-describedby sur les
 * champs en erreur, role="alert" + aria-live sur erreur ET succes,
 * aria-busy sur le submit. Cibles tactiles min-h-touch (charte MG).
 */
export function EditUserAssignmentForm({
  userId,
  initialRole,
  initialBoutiqueSalarieId,
  initialBoutiqueIdsResponsable,
  boutiques,
}: EditUserAssignmentFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateUserAssignmentAction,
    INITIAL_UPDATE_USER_ASSIGNMENT_STATE
  );

  const [role, setRole] = useState<UserRole>(initialRole);

  const globalErrorId = useId();
  const successId = useId();
  const globalError = getGlobalErrorMessage(state);
  const isSuccess = state.status === 'success';
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  const roleError = firstError(fieldErrors, 'role');
  const boutiqueSalarieError = firstError(fieldErrors, 'boutiqueSalarieId');
  const boutiquesResponsableError = firstError(
    fieldErrors,
    'boutiquesResponsable'
  );

  const responsableSet = new Set(initialBoutiqueIdsResponsable);

  return (
    <form
      action={formAction}
      aria-label="Formulaire de modification des rattachements"
      className="space-y-5"
      data-testid="edit-user-form"
      noValidate
    >
      <input type="hidden" name="userId" value={userId} />

      <FormField label="Role" name="role" required error={roleError ?? null}>
        <select
          id="role"
          name="role"
          required
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          aria-invalid={!!roleError}
          aria-describedby={roleError ? 'role-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="edit-user-role"
        >
          {ASSIGNABLE_ROLES.map((opt) => (
            <option key={opt} value={opt}>
              {USER_ROLE_LABELS[opt]}
            </option>
          ))}
        </select>
      </FormField>

      {role === 'SALARIE' ? (
        <FormField
          label="Boutique"
          name="boutiqueSalarieId"
          required
          error={boutiqueSalarieError ?? null}
        >
          <select
            id="boutiqueSalarieId"
            name="boutiqueSalarieId"
            required
            defaultValue={initialBoutiqueSalarieId ?? ''}
            aria-invalid={!!boutiqueSalarieError}
            aria-describedby={
              boutiqueSalarieError ? 'boutiqueSalarieId-error' : undefined
            }
            className={INPUT_CLASSES}
            data-testid="edit-user-boutique-salarie"
          >
            <option value="" disabled>
              Choisir une boutique
            </option>
            {boutiques.map((boutique) => (
              <option key={boutique.id} value={boutique.id}>
                {formatBoutiqueOption(boutique)}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      {role === 'RESPONSABLE' ? (
        <FormField
          label="Boutiques (au moins une)"
          name="boutiquesResponsable"
          required
          error={boutiquesResponsableError ?? null}
        >
          <fieldset
            className={CHECKBOX_GROUP_CLASSES}
            aria-invalid={!!boutiquesResponsableError}
            aria-describedby={
              boutiquesResponsableError
                ? 'boutiquesResponsable-error'
                : undefined
            }
            data-testid="edit-user-boutiques-responsable"
          >
            <legend className="sr-only">Boutiques accessibles</legend>
            {boutiques.map((boutique) => (
              <label
                key={boutique.id}
                className="flex items-center gap-3 text-sm font-light text-mg-noir"
              >
                <input
                  type="checkbox"
                  name="boutiquesResponsable"
                  value={boutique.id}
                  defaultChecked={responsableSet.has(boutique.id)}
                  className="h-4 w-4 rounded-none border-mg-noir/30 bg-mg-ivoire text-mg-or focus:ring-1 focus:ring-mg-or"
                  data-testid={`edit-user-boutique-responsable-${boutique.id}`}
                />
                {formatBoutiqueOption(boutique)}
              </label>
            ))}
          </fieldset>
        </FormField>
      ) : null}

      {role === 'ADMIN' ? (
        <p
          className="border-l border-mg-or/40 bg-mg-or/5 px-4 py-3 text-xs font-light italic text-mg-noir/60"
          data-testid="edit-user-admin-hint"
        >
          Un administrateur a acces a toutes les boutiques. Aucune affectation
          de boutique requise.
        </p>
      ) : null}

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="edit-user-error"
      >
        {globalError}
      </div>

      <div
        id={successId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={isSuccess ? SUCCESS_BOX_CLASSES : 'sr-only'}
        data-testid="edit-user-success"
      >
        {isSuccess ? SUCCESS_MESSAGE : null}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={SUBMIT_CLASSES}
          data-testid="edit-user-submit"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}
