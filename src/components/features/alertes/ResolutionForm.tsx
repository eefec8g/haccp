'use client';

import { useActionState, useId, useState } from 'react';
import { resolveAlerteAction } from '@/app/actions/alerte';
import {
  INITIAL_ALERTE_RESOLVE_STATE,
  type AlerteFieldErrors,
  type AlerteResolveActionState,
} from '@/app/actions/alerte.types';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { FormField } from '@/components/features/admin/FormField';
import {
  COMMENTAIRE_MAX_CHARS,
  COMMENTAIRE_MIN_CHARS,
} from '@/lib/constants/releve';
import {
  ERROR_BOX_CLASSES,
  INPUT_CLASSES,
  SUBMIT_CLASSES,
} from '@/components/features/ui/form-styles';

/**
 * Formulaire de resolution d'une alerte (US-ALE-002).
 *
 * - `'use client'` : utilise `useActionState` (etat de l'action) +
 *   `useState` (compteur de caracteres). Pas de fetch ; toute la
 *   mutation passe par la Server Action.
 * - Affiche en lecture seule les donnees de l'alerte au-dessus du form
 *   (mode Pop-up de validation : on confirme ce qu'on resout).
 * - Hidden `alerteId` injecte depuis la prop (jamais editable cote
 *   client : reverifie cote action + service).
 * - Textarea `commentaireResolution` avec compteur borne par
 *   `COMMENTAIRE_MIN_CHARS` / `COMMENTAIRE_MAX_CHARS` (constants
 *   canoniques du domaine, cf. `@/lib/constants/releve`).
 *
 * a11y :
 *   - Labels lies via FormField.
 *   - `aria-invalid` / `aria-describedby` quand erreur.
 *   - `role="alert"` + `aria-live="polite"` sur l'erreur globale.
 *   - `aria-busy` sur le bouton submit pendant la transition.
 */

const COUNTER_CLASSES =
  'mt-1 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/50';

const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a resoudre cette alerte.";
const NOT_FOUND_MESSAGE =
  'Cette alerte est introuvable ou hors de votre perimetre.';
const ALREADY_RESOLVED_MESSAGE = 'Cette alerte est deja resolue.';
const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

interface ResolutionFormProps {
  readonly alerteId: string;
  readonly summary: {
    readonly equipementNom: string;
    readonly boutiqueNom: string;
    readonly temperature: number;
    readonly seuilMin: number;
    readonly seuilMax: number;
  };
}

function getGlobalErrorMessage(state: AlerteResolveActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'FORBIDDEN') {
    return FORBIDDEN_MESSAGE;
  }
  if (state.code === 'NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
  }
  if (state.code === 'ALREADY_RESOLVED') {
    return ALREADY_RESOLVED_MESSAGE;
  }
  if (state.code === 'RATE_LIMITED') {
    return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

function firstError(
  fieldErrors: AlerteFieldErrors | undefined,
  field: keyof AlerteFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

export function ResolutionForm({ alerteId, summary }: ResolutionFormProps) {
  const [state, formAction, isPending] = useActionState(
    resolveAlerteAction,
    INITIAL_ALERTE_RESOLVE_STATE
  );
  const [commentaireLength, setCommentaireLength] = useState(0);

  const globalErrorId = useId();
  const globalError = getGlobalErrorMessage(state);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const commentaireError = firstError(fieldErrors, 'commentaireResolution');

  return (
    <form
      action={formAction}
      aria-label="Formulaire de resolution d'alerte"
      className="space-y-5"
      data-testid="alerte-resolution-form"
      noValidate
    >
      <input type="hidden" name="alerteId" value={alerteId} />

      <dl
        className="grid grid-cols-1 gap-4 border border-mg-noir/10 bg-mg-ivoire/40 p-5 sm:grid-cols-2"
        data-testid="alerte-resolution-summary"
      >
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60">
            Equipement
          </dt>
          <dd className="mt-1 text-sm font-light text-mg-noir">
            {summary.equipementNom}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60">
            Boutique
          </dt>
          <dd className="mt-1 text-sm font-light text-mg-noir">
            {summary.boutiqueNom}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60">
            Temperature relevee
          </dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-mg-noir">
            {summary.temperature.toFixed(1)} degC
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60">
            Seuils HACCP
          </dt>
          <dd className="mt-1 text-sm font-light text-mg-noir">
            {summary.seuilMin.toFixed(1)} / {summary.seuilMax.toFixed(1)} degC
          </dd>
        </div>
      </dl>

      <FormField
        label="Commentaire de resolution"
        name="commentaireResolution"
        required
        error={commentaireError ?? null}
        hint={`Indiquez la cause + action corrective (${COMMENTAIRE_MIN_CHARS} a ${COMMENTAIRE_MAX_CHARS} caracteres).`}
      >
        <textarea
          id="commentaireResolution"
          name="commentaireResolution"
          required
          rows={5}
          minLength={COMMENTAIRE_MIN_CHARS}
          maxLength={COMMENTAIRE_MAX_CHARS}
          autoFocus
          placeholder="Ex : porte ouverte trop longtemps, refermee, controle 1h plus tard OK."
          aria-invalid={!!commentaireError}
          aria-describedby={
            commentaireError ? 'commentaireResolution-error' : undefined
          }
          className={INPUT_CLASSES}
          data-testid="alerte-resolution-commentaire"
          onChange={(event) => setCommentaireLength(event.target.value.length)}
        />
        <p
          className={COUNTER_CLASSES}
          data-testid="alerte-resolution-counter"
          aria-live="polite"
        >
          {commentaireLength} / {COMMENTAIRE_MAX_CHARS}
        </p>
      </FormField>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="alerte-resolution-error"
      >
        {globalError}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={SUBMIT_CLASSES}
          data-testid="alerte-resolution-submit"
        >
          {isPending ? 'Enregistrement...' : 'Marquer comme resolue'}
        </button>
      </div>
    </form>
  );
}
