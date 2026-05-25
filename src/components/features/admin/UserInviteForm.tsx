'use client';

import { useActionState, useId, useState } from 'react';
import type { UserRole } from '@prisma/client';
import {
  inviteUserAction,
  INITIAL_USER_INVITE_STATE,
  type UserActionFieldErrors,
  type UserInviteActionState,
} from '@/app/actions/admin-user';
import { USER_NOM_MAX, EMAIL_MAX } from '@/lib/constants/admin';
import { FormField } from './FormField';

export interface UserInviteBoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville?: string | null;
}

interface UserInviteFormProps {
  readonly boutiques: readonly UserInviteBoutiqueOption[];
}

const INPUT_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const SUBMIT_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const ERROR_BOX_CLASSES =
  'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]';
const CHECKBOX_GROUP_CLASSES =
  'space-y-2 rounded-[7px] border border-[#DFE5EF] bg-white p-3';

const EMAIL_EXISTS_MESSAGE =
  'Cet email correspond a un compte existant (actif ou desactive). ' +
  'Reactivez le compte ou utilisez un autre email.';
const BOUTIQUE_NOT_FOUND_MESSAGE =
  'La boutique selectionnee est introuvable ou desactivee.';
const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a effectuer cette action.";
const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const RATE_LIMITED_MESSAGE =
  "Trop d'invitations envoyees recemment. Reessayez plus tard.";
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  SALARIE: 'Salarie',
  RESPONSABLE: 'Responsable',
  ADMIN: 'Administrateur',
} as const;

const ROLE_OPTIONS: readonly UserRole[] = [
  'SALARIE',
  'RESPONSABLE',
  'ADMIN',
] as const;

function getGlobalErrorMessage(state: UserInviteActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'EMAIL_ALREADY_EXISTS') {
    return EMAIL_EXISTS_MESSAGE;
  }
  if (state.code === 'BOUTIQUE_NOT_FOUND') {
    return BOUTIQUE_NOT_FOUND_MESSAGE;
  }
  if (state.code === 'FORBIDDEN') {
    return FORBIDDEN_MESSAGE;
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_MESSAGE;
  }
  if (state.code === 'RATE_LIMITED') {
    return RATE_LIMITED_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

function firstError(
  fieldErrors: UserActionFieldErrors | undefined,
  field: keyof UserActionFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

function formatBoutiqueOption(boutique: UserInviteBoutiqueOption): string {
  if (boutique.ville && boutique.ville.length > 0) {
    return `${boutique.nom} - ${boutique.ville}`;
  }
  return boutique.nom;
}

/**
 * Formulaire d'invitation utilisateur (US-ADM-003).
 *
 * Adaptation du selecteur boutiques selon le role :
 *   - SALARIE      : <select> requis (1 boutique)
 *   - RESPONSABLE  : checkboxes multi-select (>= 1 boutique)
 *   - ADMIN        : aucun selecteur (boutique non requise)
 *
 * a11y : labels lies, aria-invalid/aria-describedby sur les champs en
 * erreur, role="alert" + aria-live polite sur la zone d'erreur globale,
 * aria-busy sur le submit. Le toggle de role utilise un useState pur
 * pour le rendu conditionnel ; les valeurs des autres champs sont
 * uncontrolled (defaultValue) pour preserver la saisie en cas d'erreur.
 */
export function UserInviteForm({ boutiques }: UserInviteFormProps) {
  const [state, formAction, isPending] = useActionState(
    inviteUserAction,
    INITIAL_USER_INVITE_STATE
  );

  const [role, setRole] = useState<UserRole>('SALARIE');

  const globalErrorId = useId();
  const globalError = getGlobalErrorMessage(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  const emailError = firstError(fieldErrors, 'email');
  const nameError = firstError(fieldErrors, 'name');
  const roleError = firstError(fieldErrors, 'role');
  const boutiqueSalarieError = firstError(fieldErrors, 'boutiqueSalarieId');
  const boutiquesResponsableError = firstError(
    fieldErrors,
    'boutiquesResponsable'
  );

  return (
    <form
      action={formAction}
      aria-label="Formulaire d'invitation utilisateur"
      className="space-y-5"
      data-testid="invite-form"
      noValidate
    >
      <FormField label="Email" name="email" required error={emailError ?? null}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          maxLength={EMAIL_MAX}
          placeholder="jane@maison-givre.fr"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="invite-email"
        />
      </FormField>

      <FormField label="Nom" name="name" required error={nameError ?? null}>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          maxLength={USER_NOM_MAX}
          placeholder="Jane Dupont"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="invite-nom"
        />
      </FormField>

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
          data-testid="invite-role"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {ROLE_LABELS[opt]}
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
            defaultValue=""
            aria-invalid={!!boutiqueSalarieError}
            aria-describedby={
              boutiqueSalarieError ? 'boutiqueSalarieId-error' : undefined
            }
            className={INPUT_CLASSES}
            data-testid="invite-boutique-salarie"
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
            data-testid="invite-boutiques-responsable"
          >
            <legend className="sr-only">Boutiques accessibles</legend>
            {boutiques.map((boutique) => (
              <label
                key={boutique.id}
                className="flex items-center gap-2 text-sm text-[#2A3547]"
              >
                <input
                  type="checkbox"
                  name="boutiquesResponsable"
                  value={boutique.id}
                  className="h-4 w-4 rounded border-[#DFE5EF] text-[#5D87FF] focus:ring-[#5D87FF]"
                  data-testid={`invite-boutique-responsable-${boutique.id}`}
                />
                {formatBoutiqueOption(boutique)}
              </label>
            ))}
          </fieldset>
        </FormField>
      ) : null}

      {role === 'ADMIN' ? (
        <p
          className="rounded-[7px] border border-[#5D87FF]/20 bg-[#ECF2FF] px-4 py-3 text-xs text-[#3B5BB8]"
          data-testid="invite-admin-hint"
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
        data-testid="invite-error"
      >
        {globalError}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={SUBMIT_CLASSES}
          data-testid="invite-submit"
        >
          {isPending ? 'Envoi en cours...' : "Envoyer l'invitation"}
        </button>
      </div>
    </form>
  );
}
