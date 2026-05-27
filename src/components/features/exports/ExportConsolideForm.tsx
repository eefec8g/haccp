'use client';

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import {
  ERROR_BOX_CLASSES,
  INPUT_CLASSES,
  LABEL_CLASSES,
  SUBMIT_CLASSES,
  SUBMIT_DESTRUCTIVE_CLASSES,
} from '@/components/features/ui/form-styles';
import { MILLIS_PER_DAY } from '@/lib/constants/time';

/**
 * Formulaire d'export "Registre journalier consolide" (Epic REGISTRE
 * US-REG-001).
 *
 * Pattern : HTML form GET vers le Route Handler `/api/exports/registre-
 * consolide`. Le browser gere le download natif via
 * `Content-Disposition: attachment`. Aucune Server Action ici (la
 * response est binaire PDF).
 *
 * Validation cote client (UX uniquement) :
 *   - `dateStart <= dateEnd` ;
 *   - `dateEnd <= today` ;
 *   - periode <= `maxPeriodeDays` jours inclus.
 *
 * Validation reelle (defense en profondeur) cote API : Zod
 * `exportConsolideQuerySchema` + service `validatePeriode`. Le client
 * ne fait que pre-bloquer le submit pour eviter un aller-retour visible.
 *
 * Granularite `aria-invalid` (CC-7) : marque uniquement le(s) champ(s)
 * en cause -- `dateEnd` pour les erreurs de longueur/futur, les deux
 * pour `start > end`.
 */

export interface ExportConsolideFormBoutique {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

interface ExportConsolideFormProps {
  readonly actionUrl: string;
  readonly boutiques: readonly ExportConsolideFormBoutique[];
  readonly defaultDateStart: string;
  readonly defaultDateEnd: string;
  readonly maxDate: string;
  readonly maxPeriodeDays: number;
  readonly errorMessage?: string;
}

const RELEVES_PATH = '/releves' as Route;

function diffInDaysInclusive(dateStart: string, dateEnd: string): number {
  const startMs = new Date(dateStart).getTime();
  const endMs = new Date(dateEnd).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.floor((endMs - startMs) / MILLIS_PER_DAY) + 1;
}

/**
 * Sous-ensembles de champs concernes par une erreur de validation.
 *
 * Permet de marquer `aria-invalid` uniquement sur le ou les champs en
 * cause (CC-7) : pour "dateEnd > maxDate", seul `dateEnd` est en
 * cause ; pour "dateStart > dateEnd", les deux participent.
 */
type InvalidField = 'dateStart' | 'dateEnd';

interface ValidationState {
  readonly valid: boolean;
  readonly message: string | null;
  readonly invalidFields: readonly InvalidField[];
}

const VALID_STATE: ValidationState = {
  valid: true,
  message: null,
  invalidFields: [],
};

interface ValidationArgs {
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly maxDate: string;
  readonly maxPeriodeDays: number;
}

function validateEmpty({
  dateStart,
  dateEnd,
}: ValidationArgs): ValidationState | null {
  if (dateStart && dateEnd) {
    return null;
  }
  return {
    valid: false,
    message: 'Selectionnez une date de debut et de fin.',
    invalidFields: dateStart ? ['dateEnd'] : ['dateStart'],
  };
}

function validateDateOrder({
  dateStart,
  dateEnd,
}: ValidationArgs): ValidationState | null {
  if (dateEnd >= dateStart) {
    return null;
  }
  return {
    valid: false,
    message: 'La date de fin doit etre superieure ou egale a la date de debut.',
    invalidFields: ['dateStart', 'dateEnd'],
  };
}

function validateFuture({
  dateEnd,
  maxDate,
}: ValidationArgs): ValidationState | null {
  if (dateEnd <= maxDate) {
    return null;
  }
  return {
    valid: false,
    message: 'La date de fin ne peut pas etre dans le futur.',
    invalidFields: ['dateEnd'],
  };
}

function validatePeriodeLength(args: ValidationArgs): ValidationState | null {
  const days = diffInDaysInclusive(args.dateStart, args.dateEnd);
  if (days <= args.maxPeriodeDays) {
    return null;
  }
  return {
    valid: false,
    message: `La periode doit etre inferieure ou egale a ${args.maxPeriodeDays} jours.`,
    invalidFields: ['dateEnd'],
  };
}

const VALIDATORS: readonly ((
  args: ValidationArgs
) => ValidationState | null)[] = [
  validateEmpty,
  validateDateOrder,
  validateFuture,
  validatePeriodeLength,
];

function computeValidation(args: ValidationArgs): ValidationState {
  for (const validator of VALIDATORS) {
    const result = validator(args);
    if (result) {
      return result;
    }
  }
  return VALID_STATE;
}

function isFieldInvalid(
  validation: ValidationState,
  field: InvalidField
): 'true' | undefined {
  return validation.invalidFields.includes(field) ? 'true' : undefined;
}

export function ExportConsolideForm({
  actionUrl,
  boutiques,
  defaultDateStart,
  defaultDateEnd,
  maxDate,
  maxPeriodeDays,
  errorMessage,
}: ExportConsolideFormProps): React.ReactElement {
  const [boutiqueId, setBoutiqueId] = useState<string>('');
  const [dateStart, setDateStart] = useState<string>(defaultDateStart);
  const [dateEnd, setDateEnd] = useState<string>(defaultDateEnd);

  const validation = useMemo(
    () => computeValidation({ dateStart, dateEnd, maxDate, maxPeriodeDays }),
    [dateStart, dateEnd, maxDate, maxPeriodeDays]
  );

  const serverErrorId = 'consolide-form-server-error';
  const clientErrorId = 'consolide-form-client-error';
  const describedBy =
    [
      errorMessage ? serverErrorId : null,
      validation.message ? clientErrorId : null,
    ]
      .filter((id): id is string => id !== null)
      .join(' ') || undefined;

  return (
    <form
      action={actionUrl}
      method="get"
      className="space-y-6"
      data-testid="consolide-form"
      noValidate
      aria-describedby={describedBy}
    >
      <div>
        <label htmlFor="consolide-boutique" className={LABEL_CLASSES}>
          Boutique (toutes par defaut)
        </label>
        <select
          id="consolide-boutique"
          name="boutiqueId"
          value={boutiqueId}
          onChange={(e) => setBoutiqueId(e.target.value)}
          className={INPUT_CLASSES}
          data-testid="consolide-boutique"
        >
          <option value="">Toutes mes boutiques</option>
          {boutiques.map((boutique) => (
            <option key={boutique.id} value={boutique.id}>
              {boutique.ville
                ? `${boutique.nom} (${boutique.ville})`
                : boutique.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="consolide-date-start" className={LABEL_CLASSES}>
            Date de debut
          </label>
          <input
            id="consolide-date-start"
            name="dateStart"
            type="date"
            required
            aria-required="true"
            aria-invalid={isFieldInvalid(validation, 'dateStart')}
            max={maxDate}
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="consolide-date-start"
          />
        </div>
        <div>
          <label htmlFor="consolide-date-end" className={LABEL_CLASSES}>
            Date de fin
          </label>
          <input
            id="consolide-date-end"
            name="dateEnd"
            type="date"
            required
            aria-required="true"
            aria-invalid={isFieldInvalid(validation, 'dateEnd')}
            max={maxDate}
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="consolide-date-end"
          />
        </div>
      </div>

      {errorMessage ? (
        <div
          id={serverErrorId}
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid="consolide-form-error"
        >
          {errorMessage}
        </div>
      ) : null}

      {validation.message ? (
        <div
          id={clientErrorId}
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid="consolide-form-client-error"
        >
          {validation.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={SUBMIT_CLASSES}
          disabled={!validation.valid}
          data-testid="consolide-submit"
        >
          Telecharger le PDF
        </button>
        <Link
          href={RELEVES_PATH}
          className={SUBMIT_DESTRUCTIVE_CLASSES}
          data-testid="consolide-cancel"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
