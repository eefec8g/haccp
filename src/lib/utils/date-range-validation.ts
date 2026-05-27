import { daysInclusive } from '@/lib/utils/dates';

/**
 * Validation cote client des plages de dates `[dateStart, dateEnd]`
 * partagee par les formulaires d'export et de listing (CC-4 DRY).
 *
 * Auparavant duplique dans `ReleveListingForm` et `ExportConsolideForm`
 * (~100 lignes par fichier). On factorise la logique pure ici ; chaque
 * formulaire conserve son rendu et sa specificite UI.
 *
 * Securite : il s'agit UNIQUEMENT d'UX (pre-bloque le submit avant un
 * aller-retour serveur). La validation reelle (defense en profondeur)
 * reste cote Zod + service serveur.
 *
 * Conventions :
 *   - Les messages sont en francais (alignes sur la charte HACCP).
 *   - `invalidFields` liste les champs concernes -> aria-invalid cible
 *     uniquement le ou les champs en cause (CC-10 accessibilite).
 *   - Aucune dependance React : helper pur, testable en isolation.
 */

export type InvalidDateRangeField = 'dateStart' | 'dateEnd';

export interface DateRangeValidationState {
  readonly valid: boolean;
  readonly message: string | null;
  readonly invalidFields: readonly InvalidDateRangeField[];
}

export const DATE_RANGE_VALID_STATE: DateRangeValidationState = {
  valid: true,
  message: null,
  invalidFields: [],
} as const;

export interface DateRangeValidationArgs {
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly maxDate: string;
  readonly maxPeriodeDays: number;
}

type Validator = (
  args: DateRangeValidationArgs
) => DateRangeValidationState | null;

function validateEmpty({
  dateStart,
  dateEnd,
}: DateRangeValidationArgs): DateRangeValidationState | null {
  if (dateStart && dateEnd) {
    return null;
  }
  return {
    valid: false,
    message: 'Selectionnez une date de debut et de fin.',
    invalidFields: dateStart ? ['dateEnd'] : ['dateStart'],
  };
}

function validateOrder({
  dateStart,
  dateEnd,
}: DateRangeValidationArgs): DateRangeValidationState | null {
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
}: DateRangeValidationArgs): DateRangeValidationState | null {
  if (dateEnd <= maxDate) {
    return null;
  }
  return {
    valid: false,
    message: 'La date de fin ne peut pas etre dans le futur.',
    invalidFields: ['dateEnd'],
  };
}

function validateLength(
  args: DateRangeValidationArgs
): DateRangeValidationState | null {
  const days = daysInclusive(args.dateStart, args.dateEnd);
  if (days <= args.maxPeriodeDays) {
    return null;
  }
  return {
    valid: false,
    message: `La periode doit etre inferieure ou egale a ${args.maxPeriodeDays} jours.`,
    invalidFields: ['dateEnd'],
  };
}

const VALIDATORS: readonly Validator[] = [
  validateEmpty,
  validateOrder,
  validateFuture,
  validateLength,
];

/**
 * Pipeline de validation. Court-circuite a la premiere erreur (ordre
 * "remplissage" -> "ordre" -> "futur" -> "longueur") pour produire un
 * message clair plutot qu'une liste melangee.
 */
export function computeDateRangeValidation(
  args: DateRangeValidationArgs
): DateRangeValidationState {
  for (const validator of VALIDATORS) {
    const result = validator(args);
    if (result) {
      return result;
    }
  }
  return DATE_RANGE_VALID_STATE;
}

/**
 * Helper UI : retourne `'true'` ou `undefined` (et pas un booleen) car
 * `aria-invalid` ne doit etre present que sur les champs invalides
 * (sinon les lecteurs d'ecran annoncent un faux positif).
 */
export function isDateRangeFieldInvalid(
  state: DateRangeValidationState,
  field: InvalidDateRangeField
): 'true' | undefined {
  return state.invalidFields.includes(field) ? 'true' : undefined;
}
