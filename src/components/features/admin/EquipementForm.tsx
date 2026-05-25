'use client';

import { useActionState, useId } from 'react';
import type { Equipement } from '@prisma/client';
import { TypeEquipement } from '@prisma/client';
import {
  createEquipementAction,
  updateEquipementAction,
  INITIAL_EQUIPEMENT_ACTION_STATE,
  type EquipementActionState,
  type EquipementActionFieldErrors,
} from '@/app/actions/admin-equipement';
import {
  EQUIPEMENT_NOM_MAX,
  SEUIL_TEMP_MAX,
  SEUIL_TEMP_MIN,
} from '@/lib/constants/admin';
import { FormField } from './FormField';

type EquipementFormMode = 'create' | 'edit';

export interface EquipementBoutiqueOption {
  readonly id: string;
  readonly nom: string;
  readonly ville?: string | null;
}

interface EquipementFormProps {
  readonly mode: EquipementFormMode;
  readonly equipement?: Equipement;
  readonly boutiques: readonly EquipementBoutiqueOption[];
  readonly defaultBoutiqueId?: string;
}

const INPUT_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const SUBMIT_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const ERROR_BOX_CLASSES =
  'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]';

const DUPLICATE_MESSAGE =
  'Un equipement avec ce nom existe deja dans cette boutique.';
const NOT_FOUND_MESSAGE = 'Cet equipement est introuvable ou a ete supprime.';
const BOUTIQUE_NOT_FOUND_MESSAGE =
  'La boutique selectionnee est introuvable ou desactivee.';
const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a effectuer cette action.";
const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const TYPE_LABELS: Readonly<Record<TypeEquipement, string>> = {
  CONGELATEUR: 'Congelateur',
  VITRINE: 'Vitrine refrigeree',
  CHAMBRE_FROIDE: 'Chambre froide',
  AUTRE: 'Autre',
} as const;

const TYPE_OPTIONS: readonly TypeEquipement[] = [
  TypeEquipement.CONGELATEUR,
  TypeEquipement.VITRINE,
  TypeEquipement.CHAMBRE_FROIDE,
  TypeEquipement.AUTRE,
] as const;

function getGlobalErrorMessage(state: EquipementActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'DUPLICATE') {
    return DUPLICATE_MESSAGE;
  }
  if (state.code === 'NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
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
  return GENERIC_ERROR_MESSAGE;
}

function firstError(
  fieldErrors: EquipementActionFieldErrors | undefined,
  field: keyof EquipementActionFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

function formatBoutiqueOption(boutique: EquipementBoutiqueOption): string {
  if (boutique.ville && boutique.ville.length > 0) {
    return `${boutique.nom} - ${boutique.ville}`;
  }
  return boutique.nom;
}

/**
 * Formulaire de creation/edition d'un equipement.
 *
 * - `'use client'` : useActionState + useId pour la liaison aria.
 * - Une seule Server Action est cablee selon le `mode` (DRY).
 * - Seuils obligatoires (decision Epic ADMIN #4) : le Zod refuse si
 *   manquants, un hint indique les valeurs conseillees mais sans les
 *   pre-remplir.
 * - a11y : labels lies, aria-invalid/aria-describedby quand erreur,
 *   role="alert" + aria-live polite sur la zone d'erreur globale,
 *   aria-busy sur le bouton submit.
 */
export function EquipementForm({
  mode,
  equipement,
  boutiques,
  defaultBoutiqueId,
}: EquipementFormProps) {
  const action =
    mode === 'create' ? createEquipementAction : updateEquipementAction;
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_EQUIPEMENT_ACTION_STATE
  );

  const globalErrorId = useId();
  const globalError = getGlobalErrorMessage(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  const nomError = firstError(fieldErrors, 'nom');
  const typeError = firstError(fieldErrors, 'type');
  const boutiqueError = firstError(fieldErrors, 'boutiqueId');
  const seuilMinError = firstError(fieldErrors, 'seuilMin');
  const seuilMaxError = firstError(fieldErrors, 'seuilMax');

  const initialBoutiqueId = equipement?.boutiqueId ?? defaultBoutiqueId ?? '';
  const initialType = equipement?.type ?? '';
  const initialSeuilMin =
    equipement?.seuilMin !== undefined
      ? String(Number(equipement.seuilMin))
      : '';
  const initialSeuilMax =
    equipement?.seuilMax !== undefined
      ? String(Number(equipement.seuilMax))
      : '';

  return (
    <form
      action={formAction}
      aria-label={
        mode === 'create'
          ? "Formulaire de creation d'equipement"
          : "Formulaire de modification d'equipement"
      }
      className="space-y-5"
      data-testid="equipement-form"
      noValidate
    >
      {mode === 'edit' && equipement ? (
        <input type="hidden" name="id" value={equipement.id} />
      ) : null}

      <FormField label="Nom" name="nom" required error={nomError ?? null}>
        <input
          id="nom"
          name="nom"
          type="text"
          required
          autoComplete="off"
          autoFocus={mode === 'create'}
          maxLength={EQUIPEMENT_NOM_MAX}
          defaultValue={equipement?.nom ?? ''}
          placeholder="Congelateur principal"
          aria-invalid={!!nomError}
          aria-describedby={nomError ? 'nom-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="equipement-nom"
        />
      </FormField>

      <FormField label="Type" name="type" required error={typeError ?? null}>
        <select
          id="type"
          name="type"
          required
          defaultValue={initialType}
          aria-invalid={!!typeError}
          aria-describedby={typeError ? 'type-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="equipement-type"
        >
          <option value="" disabled>
            Choisir un type
          </option>
          {TYPE_OPTIONS.map((typeOption) => (
            <option key={typeOption} value={typeOption}>
              {TYPE_LABELS[typeOption]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Boutique"
        name="boutiqueId"
        required
        error={boutiqueError ?? null}
      >
        <select
          id="boutiqueId"
          name="boutiqueId"
          required
          defaultValue={initialBoutiqueId}
          aria-invalid={!!boutiqueError}
          aria-describedby={boutiqueError ? 'boutiqueId-error' : undefined}
          className={INPUT_CLASSES}
          data-testid="equipement-boutique"
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label="Seuil minimum (°C)"
          name="seuilMin"
          required
          error={seuilMinError ?? null}
        >
          <input
            id="seuilMin"
            name="seuilMin"
            type="number"
            step="0.1"
            min={SEUIL_TEMP_MIN}
            max={SEUIL_TEMP_MAX}
            required
            defaultValue={initialSeuilMin}
            placeholder="-25"
            aria-invalid={!!seuilMinError}
            aria-describedby={seuilMinError ? 'seuilMin-error' : undefined}
            className={INPUT_CLASSES}
            data-testid="equipement-seuil-min"
          />
        </FormField>

        <FormField
          label="Seuil maximum (°C)"
          name="seuilMax"
          required
          error={seuilMaxError ?? null}
        >
          <input
            id="seuilMax"
            name="seuilMax"
            type="number"
            step="0.1"
            min={SEUIL_TEMP_MIN}
            max={SEUIL_TEMP_MAX}
            required
            defaultValue={initialSeuilMax}
            placeholder="-18"
            aria-invalid={!!seuilMaxError}
            aria-describedby={seuilMaxError ? 'seuilMax-error' : undefined}
            className={INPUT_CLASSES}
            data-testid="equipement-seuil-max"
          />
        </FormField>
      </div>

      <p className="rounded-[7px] border border-[#5D87FF]/20 bg-[#ECF2FF] px-4 py-3 text-xs text-[#3B5BB8]">
        Reperes conseilles : Congelateur -25°C / -18°C, Vitrine refrigeree -18°C
        / -10°C, Chambre froide 0°C / 4°C. Ces seuils doivent etre saisis
        manuellement (aucune valeur par defaut).
      </p>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="equipement-error"
      >
        {globalError}
      </div>

      {mode === 'edit' && state.status === 'success' ? (
        <p
          className="rounded-[7px] border border-[#13DEB9]/30 bg-[#E6FBF6] px-4 py-3 text-sm text-[#0F9F86]"
          role="status"
          aria-live="polite"
          data-testid="equipement-success"
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
          data-testid="equipement-submit"
        >
          {isPending
            ? 'Enregistrement...'
            : mode === 'create'
              ? "Creer l'equipement"
              : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
