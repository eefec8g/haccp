'use client';

import { useActionState, useId, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { ReleveListItem } from '@/types/releve';
import { annulerReleveAction } from '@/app/actions/releve-correction';
import {
  INITIAL_RELEVE_CORRECTION_STATE,
  type ReleveCorrectionActionState,
  type ReleveCorrectionFieldErrors,
} from '@/app/actions/releve-correction.types';
import {
  CRENEAU_LABELS,
  MOTIF_ANNULATION_MAX_CHARS,
  MOTIF_ANNULATION_MIN_CHARS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  COMMENTAIRE_MAX_CHARS,
} from '@/lib/constants/releve';
import { EQUIPEMENT_TYPE_LABELS } from '@/lib/constants/equipement-labels';
import { formatDateShort, todayParisISO } from '@/lib/utils/dates';
import {
  ERROR_BOX_CLASSES,
  INPUT_CLASSES,
  LABEL_CLASSES,
  SUBMIT_DESTRUCTIVE_CLASSES,
} from '@/components/features/ui/form-styles';

/**
 * Formulaire d'annulation/correction d'un releve (US-REL-004).
 *
 * Client Component ('use client') car :
 *   - `useActionState` pour le pipeline Server Action + pending,
 *   - compteur de caracteres sur le motif (live),
 *   - toggle UI pour saisir une valeur de remplacement.
 *
 * Pas d'API client : tout passe par la Server Action `annulerReleveAction`
 * qui delegue au service (transaction atomique RG-IMMU-001).
 *
 * a11y :
 *   - labels lies, aria-invalid + aria-describedby sur les champs en
 *     erreur, aria-live="polite" sur la zone d'erreur globale,
 *   - aria-busy + disabled sur le bouton submit pendant l'action,
 *   - bouton primaire annonce explicitement l'action destructive.
 *
 * Charte Maison Givre : ivoire/noir/or (mg-* tokens). Pas de rouge : le
 * mg-or sature joue le role d'accent "danger" pour rester dans la palette.
 */

const SECTION_CLASSES =
  'rounded-lg border border-mg-noir/10 bg-white p-8 space-y-6';
const TEXTAREA_CLASSES = `${INPUT_CLASSES} min-h-[7rem] resize-y`;
const FIELD_HINT_CLASSES =
  'mt-1 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/40';
const FIELD_HINT_WARN_CLASSES =
  'mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-mg-or';
const FIELD_ERROR_CLASSES =
  'mt-1 text-[11px] font-light uppercase tracking-[0.15em] text-mg-or';
const SUMMARY_GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2';
const SUMMARY_KEY_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/50';
const SUMMARY_VALUE_CLASSES = 'mt-1 text-sm font-light text-mg-noir';
const TOGGLE_LABEL_CLASSES =
  'inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir cursor-pointer';
const REPLACEMENT_BLOCK_CLASSES =
  'space-y-4 border-l-2 border-mg-or/50 bg-mg-ivoire/40 px-5 py-4';
const CANCEL_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-6 py-3 text-[11px] font-light uppercase tracking-[0.3em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or';

const VALIDATION_MESSAGE = 'Veuillez corriger les champs en erreur.';
const FORBIDDEN_MESSAGE = "Vous n'etes pas autorise a annuler ce releve.";
const NOT_FOUND_MESSAGE = 'Ce releve est introuvable ou a ete supprime.';
const ALREADY_CANCELLED_MESSAGE = 'Ce releve a deja ete annule.';
const RATE_LIMITED_MESSAGE =
  'Trop de tentatives. Reessayez dans quelques minutes.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

interface AnnulerReleveFormProps {
  readonly releve: ReleveListItem;
  readonly cancelHref: Route;
}

function deriveErrorMessage(state: ReleveCorrectionActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_MESSAGE;
  }
  if (state.code === 'FORBIDDEN') {
    return FORBIDDEN_MESSAGE;
  }
  if (state.code === 'NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
  }
  if (state.code === 'ALREADY_CANCELLED') {
    return ALREADY_CANCELLED_MESSAGE;
  }
  if (state.code === 'RATE_LIMITED') {
    return RATE_LIMITED_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

function firstError(
  fieldErrors: ReleveCorrectionFieldErrors | undefined,
  field: keyof ReleveCorrectionFieldErrors
): string | undefined {
  return fieldErrors?.[field]?.[0];
}

/**
 * Convertit la `Date` du releve (stockee UTC midnight cf. parseISODateUtc)
 * en chaine YYYY-MM-DD a passer a `formatDateShort`. Utilise
 * `todayParisISO` (fonction generique deja existante du module dates).
 */
function toDateISO(date: Date): string {
  return todayParisISO(date);
}

export function AnnulerReleveForm({
  releve,
  cancelHref,
}: AnnulerReleveFormProps) {
  const [state, formAction, isPending] = useActionState(
    annulerReleveAction,
    INITIAL_RELEVE_CORRECTION_STATE
  );
  const [motif, setMotif] = useState('');
  const [showReplacement, setShowReplacement] = useState(false);

  const motifId = useId();
  const motifHintId = useId();
  const motifErrorId = useId();
  const replacementTempId = useId();
  const replacementCommentId = useId();
  const globalErrorId = useId();

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const motifError = firstError(fieldErrors, 'motif');
  const replacementTempError = firstError(
    fieldErrors,
    'replacementTemperature'
  );
  const replacementCommentError = firstError(
    fieldErrors,
    'replacementCommentaire'
  );
  const globalError = deriveErrorMessage(state);

  const motifLength = motif.trim().length;
  const motifTooShort = motifLength < MOTIF_ANNULATION_MIN_CHARS;
  const dateDisplay = formatDateShort(toDateISO(releve.date));

  return (
    <form
      action={formAction}
      aria-label="Formulaire d'annulation d'un releve"
      className="mx-auto max-w-2xl space-y-6"
      data-testid="annuler-releve-form"
      noValidate
    >
      <input type="hidden" name="releveId" value={releve.id} />

      <section
        className={SECTION_CLASSES}
        aria-label="Releve a annuler"
        data-testid="annuler-releve-summary"
      >
        <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-mg-or">
          Releve concerne
        </h2>
        <div className={SUMMARY_GRID_CLASSES}>
          <div>
            <p className={SUMMARY_KEY_CLASSES}>Equipement</p>
            <p
              className={SUMMARY_VALUE_CLASSES}
              data-testid="annuler-releve-equipement"
            >
              {releve.equipementNom}
            </p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/40">
              {EQUIPEMENT_TYPE_LABELS[releve.equipementType]} -{' '}
              {releve.boutiqueNom}
            </p>
          </div>
          <div>
            <p className={SUMMARY_KEY_CLASSES}>Date / Creneau</p>
            <p
              className={SUMMARY_VALUE_CLASSES}
              data-testid="annuler-releve-date"
            >
              {dateDisplay} - {CRENEAU_LABELS[releve.creneau]}
            </p>
          </div>
          <div>
            <p className={SUMMARY_KEY_CLASSES}>Temperature actuelle</p>
            <p
              className={`${SUMMARY_VALUE_CLASSES} tabular-nums`}
              data-testid="annuler-releve-temperature"
            >
              {releve.temperature.toFixed(1)} degC
            </p>
          </div>
        </div>
      </section>

      <section className={SECTION_CLASSES} aria-label="Motif d'annulation">
        <div>
          <label htmlFor={motifId} className={LABEL_CLASSES}>
            Motif d&apos;annulation
            <span aria-hidden="true" className="ml-1 text-mg-or">
              *
            </span>
          </label>
          <textarea
            id={motifId}
            name="motif"
            required
            minLength={MOTIF_ANNULATION_MIN_CHARS}
            maxLength={MOTIF_ANNULATION_MAX_CHARS}
            value={motif}
            onChange={(event) => setMotif(event.target.value)}
            placeholder="Erreur de saisie, vraie valeur -22 degC..."
            aria-invalid={!!motifError}
            aria-describedby={`${motifHintId}${motifError ? ` ${motifErrorId}` : ''}`}
            className={TEXTAREA_CLASSES}
            data-testid="annuler-releve-motif"
          />
          <p
            id={motifHintId}
            className={
              motifTooShort && motifLength > 0
                ? FIELD_HINT_WARN_CLASSES
                : FIELD_HINT_CLASSES
            }
            data-testid="annuler-releve-motif-counter"
            aria-live="polite"
          >
            {motifLength} / {MOTIF_ANNULATION_MAX_CHARS} caracteres
            {motifTooShort ? (
              <> - minimum {MOTIF_ANNULATION_MIN_CHARS}</>
            ) : null}
          </p>
          {motifError ? (
            <p
              id={motifErrorId}
              className={FIELD_ERROR_CLASSES}
              data-testid="annuler-releve-motif-error"
            >
              {motifError}
            </p>
          ) : null}
        </div>

        <label
          className={TOGGLE_LABEL_CLASSES}
          data-testid="annuler-releve-toggle-replacement-label"
        >
          <input
            type="checkbox"
            checked={showReplacement}
            onChange={(event) => setShowReplacement(event.target.checked)}
            className="h-4 w-4 accent-mg-or"
            data-testid="annuler-releve-toggle-replacement"
          />
          Saisir une valeur correcte de remplacement
        </label>

        {showReplacement ? (
          <div
            className={REPLACEMENT_BLOCK_CLASSES}
            data-testid="annuler-releve-replacement-block"
          >
            <div>
              <label htmlFor={replacementTempId} className={LABEL_CLASSES}>
                Temperature correcte (degC)
              </label>
              <input
                id={replacementTempId}
                name="replacementTemperature"
                type="number"
                step="0.1"
                min={TEMPERATURE_MIN}
                max={TEMPERATURE_MAX}
                inputMode="decimal"
                placeholder="-22.0"
                aria-invalid={!!replacementTempError}
                aria-describedby={
                  replacementTempError
                    ? `${replacementTempId}-error`
                    : undefined
                }
                className={INPUT_CLASSES}
                data-testid="annuler-releve-replacement-temperature"
              />
              {replacementTempError ? (
                <p
                  id={`${replacementTempId}-error`}
                  className={FIELD_ERROR_CLASSES}
                  data-testid="annuler-releve-replacement-temperature-error"
                >
                  {replacementTempError}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor={replacementCommentId} className={LABEL_CLASSES}>
                Commentaire (optionnel)
              </label>
              <textarea
                id={replacementCommentId}
                name="replacementCommentaire"
                maxLength={COMMENTAIRE_MAX_CHARS}
                placeholder="Contexte du remplacement..."
                aria-invalid={!!replacementCommentError}
                aria-describedby={
                  replacementCommentError
                    ? `${replacementCommentId}-error`
                    : undefined
                }
                className={TEXTAREA_CLASSES}
                data-testid="annuler-releve-replacement-commentaire"
              />
              {replacementCommentError ? (
                <p
                  id={`${replacementCommentId}-error`}
                  className={FIELD_ERROR_CLASSES}
                  data-testid="annuler-releve-replacement-commentaire-error"
                >
                  {replacementCommentError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div
        id={globalErrorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="annuler-releve-error"
      >
        {globalError}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className={CANCEL_CLASSES}
          data-testid="annuler-releve-cancel"
        >
          Retour
        </Link>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className={SUBMIT_DESTRUCTIVE_CLASSES}
          data-testid="annuler-releve-submit"
        >
          {isPending ? 'Annulation en cours...' : 'Annuler le releve'}
        </button>
      </div>
    </form>
  );
}
