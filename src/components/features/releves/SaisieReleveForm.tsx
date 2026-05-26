'use client';

import { useActionState, useId, useState } from 'react';
import { createReleveAction } from '@/app/actions/releve-create';
import {
  INITIAL_RELEVE_CREATE_STATE,
  type ReleveCreateActionFieldErrors,
  type ReleveCreateActionState,
} from '@/app/actions/releve-create.types';
import { CRENEAU_LABELS, COMMENTAIRE_MIN_CHARS } from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import type { SaisieContext } from '@/types/releve';
import { FormField } from '@/components/features/admin/FormField';
import {
  ERROR_BOX_CLASSES,
  INPUT_LARGE_CLASSES,
  SUBMIT_LARGE_CLASSES,
  TEXTAREA_CLASSES,
} from '@/components/features/ui/form-styles';

/**
 * Formulaire de saisie d'un releve de temperature (US-REL-002).
 *
 * - `'use client'` : besoin de `useActionState` + interactions (toggle
 *   commentaire conditionnel selon temperature).
 * - L'UX "commentaire obligatoire" cote client est UNE AIDE : la verite
 *   reste serveur (`createReleve` retourne `COMMENTAIRE_REQUIRED` si la
 *   regle metier n'est pas respectee, peu importe ce qu'affiche l'UI).
 * - Inputs gros (h-14 / px-6) pour usage tablette en environnement froid
 *   (gants, ecran tactile).
 *
 * Pas de useEffect "redirect fallback" : la Server Action utilise
 * `redirect()` Next.js cote serveur, ce qui termine la requete avant
 * meme qu'un state `'success'` ne soit propage au client. Un fallback
 * `window.location.assign` casserait le cache RSC sans benefice.
 *
 * a11y :
 *   - `aria-live="polite"` sur zone erreur globale + erreurs champs.
 *   - `aria-busy` sur le submit pendant `isPending`.
 *   - `aria-describedby` lie input <-> erreur.
 */

interface SaisieReleveFormProps {
  readonly context: SaisieContext;
}

const TEMPERATURE_INPUT_CLASSES = `${INPUT_LARGE_CLASSES} text-center text-3xl font-light tracking-wider`;
const ALERTE_HINT_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-medium uppercase tracking-[0.15em] text-mg-or';

const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const FORBIDDEN_MESSAGE =
  "Vous n'etes pas autorise a saisir un releve sur cet equipement.";
const EQUIPEMENT_NOT_FOUND_MESSAGE = 'Equipement introuvable.';
const EQUIPEMENT_INACTIVE_MESSAGE = 'Cet equipement est desactive.';
const ALREADY_EXISTS_MESSAGE =
  'Un releve existe deja pour ce creneau. Utilisez la correction.';
const COMMENTAIRE_REQUIRED_MESSAGE =
  'Le commentaire est obligatoire pour une temperature hors seuils.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

function deriveGlobalError(state: ReleveCreateActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  switch (state.code) {
    case 'VALIDATION':
      return VALIDATION_MESSAGE;
    case 'RATE_LIMITED':
      return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
    case 'FORBIDDEN':
    case 'BOUTIQUE_FORBIDDEN':
      return FORBIDDEN_MESSAGE;
    case 'EQUIPEMENT_NOT_FOUND':
      return EQUIPEMENT_NOT_FOUND_MESSAGE;
    case 'EQUIPEMENT_INACTIVE':
      return EQUIPEMENT_INACTIVE_MESSAGE;
    case 'ALREADY_EXISTS':
      return ALREADY_EXISTS_MESSAGE;
    case 'COMMENTAIRE_REQUIRED':
      return COMMENTAIRE_REQUIRED_MESSAGE;
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

function firstFieldError(
  fieldErrors: ReleveCreateActionFieldErrors | undefined,
  key: keyof ReleveCreateActionFieldErrors
): string | undefined {
  return fieldErrors?.[key]?.[0];
}

function parseTemperatureInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function isHorsSeuils(
  value: number | null,
  seuilMin: number,
  seuilMax: number
): boolean {
  if (value === null) {
    return false;
  }
  return value < seuilMin || value > seuilMax;
}

export function SaisieReleveForm({ context }: SaisieReleveFormProps) {
  const [state, formAction, isPending] = useActionState(
    createReleveAction,
    INITIAL_RELEVE_CREATE_STATE
  );

  const [temperatureRaw, setTemperatureRaw] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const globalErrorId = useId();
  const globalError = deriveGlobalError(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const temperatureError = firstFieldError(fieldErrors, 'temperature');
  const commentaireError = firstFieldError(fieldErrors, 'commentaire');

  const { equipement, creneau, dateISO } = context;
  const temperatureValue = parseTemperatureInput(temperatureRaw);
  const horsSeuilsClient = isHorsSeuils(
    temperatureValue,
    equipement.seuilMin,
    equipement.seuilMax
  );
  const commentaireRequiredUx = horsSeuilsClient;
  const commentaireTooShort =
    commentaireRequiredUx && commentaire.trim().length < COMMENTAIRE_MIN_CHARS;
  const submitDisabled =
    isPending || temperatureValue === null || commentaireTooShort;

  return (
    <form
      action={formAction}
      aria-label={`Saisie releve ${equipement.nom} ${CRENEAU_LABELS[creneau]}`}
      className="space-y-6"
      data-testid="saisie-form"
      noValidate
    >
      <input type="hidden" name="equipementId" value={equipement.id} />
      <input type="hidden" name="creneau" value={creneau} />

      <section
        className="border border-mg-noir/10 bg-white px-6 py-5"
        data-testid="saisie-summary"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or">
          {EQUIPEMENT_TYPE_LABELS[equipement.type]} &middot;{' '}
          {CRENEAU_LABELS[creneau]}
        </p>
        <h2 className="mt-1 text-xl font-light tracking-wide text-mg-noir">
          {equipement.nom}
        </h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-mg-noir/50">
          {equipement.boutiqueNom} &middot; Seuils{' '}
          {equipement.seuilMin.toFixed(1)} / {equipement.seuilMax.toFixed(1)}{' '}
          degC &middot; {dateISO}
        </p>
      </section>

      <FormField
        label="Temperature (degC)"
        name="temperature"
        required
        error={temperatureError ?? null}
      >
        <input
          id="temperature"
          name="temperature"
          type="number"
          step="0.1"
          required
          inputMode="decimal"
          autoFocus
          value={temperatureRaw}
          onChange={(event) => setTemperatureRaw(event.target.value)}
          aria-invalid={!!temperatureError}
          aria-describedby={temperatureError ? 'temperature-error' : undefined}
          className={TEMPERATURE_INPUT_CLASSES}
          data-testid="saisie-temperature"
        />
      </FormField>

      {commentaireRequiredUx ? (
        <p
          className={ALERTE_HINT_CLASSES}
          role="status"
          aria-live="polite"
          data-testid="saisie-alerte-hint"
        >
          Temperature hors seuils &middot; commentaire obligatoire (min{' '}
          {COMMENTAIRE_MIN_CHARS} caracteres)
        </p>
      ) : null}

      <FormField
        label="Commentaire"
        name="commentaire"
        required={commentaireRequiredUx}
        hint={
          !commentaireRequiredUx
            ? 'Optionnel hors alerte temperature'
            : undefined
        }
        error={commentaireError ?? null}
      >
        <textarea
          id="commentaire"
          name="commentaire"
          rows={4}
          required={commentaireRequiredUx}
          value={commentaire}
          onChange={(event) => setCommentaire(event.target.value)}
          aria-invalid={!!commentaireError}
          aria-describedby={commentaireError ? 'commentaire-error' : undefined}
          className={TEXTAREA_CLASSES}
          data-testid="saisie-commentaire"
          placeholder={
            commentaireRequiredUx
              ? 'Cause + action corrective (porte ouverte, panne...)'
              : ''
          }
        />
      </FormField>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="saisie-error"
      >
        {globalError}
      </div>

      <button
        type="submit"
        disabled={submitDisabled}
        aria-busy={isPending}
        className={SUBMIT_LARGE_CLASSES}
        data-testid="saisie-submit"
      >
        {isPending ? 'Enregistrement...' : 'Enregistrer le releve'}
      </button>
    </form>
  );
}
