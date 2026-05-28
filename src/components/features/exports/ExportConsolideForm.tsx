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
import {
  computeDateRangeValidation,
  isDateRangeFieldInvalid,
} from '@/lib/utils/date-range-validation';

/**
 * Formulaire d'export "Registre journalier consolide" (Epic REGISTRE
 * US-REG-001).
 *
 * Pattern : HTML form GET avec DEUX boutons submit qui ciblent deux
 * Route Handlers distincts via `formAction` (HTML5) :
 *   - PDF -> `actionUrl` (= `/api/exports/registre-consolide`),
 *     parametres natifs `dateStart` / `dateEnd` ;
 *   - CSV -> `csvActionUrl` (= `/api/exports/csv`), parametres
 *     `dateFrom` / `dateTo` (alimentes via deux `<input type="hidden">`
 *     synchronizes sur l'etat des inputs visibles).
 *
 * Pourquoi cette fusion (fix/csv-in-consolide) : eliminer la page
 * `/releves/export` dediee au CSV au profit d'un seul ecran d'export.
 * Le compromis accepte par le PO : pas de filtre `equipement` cote CSV
 * (le schema Zod `exportCsvQuerySchema` le tolere via `.optional()`),
 * periode max 31 jours (suffisant pour audit DDPP).
 *
 * Validation cote client (UX uniquement) :
 *   - `dateStart <= dateEnd` ;
 *   - `dateEnd <= today` ;
 *   - periode <= `maxPeriodeDays` jours inclus.
 *
 * Validation reelle (defense en profondeur) cote API : Zod
 * `exportConsolideQuerySchema` + `exportCsvQuerySchema` + services. Le
 * client ne fait que pre-bloquer le submit pour eviter un aller-retour
 * visible : les DEUX boutons sont desactives ensemble si la validation
 * echoue (semantique "un seul etat de validite par form").
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
  readonly csvActionUrl: string;
  readonly boutiques: readonly ExportConsolideFormBoutique[];
  readonly defaultDateStart: string;
  readonly defaultDateEnd: string;
  readonly maxDate: string;
  readonly maxPeriodeDays: number;
  readonly errorMessage?: string;
}

const DASHBOARD_PATH = '/dashboard' as Route;

export function ExportConsolideForm({
  actionUrl,
  csvActionUrl,
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
    () =>
      computeDateRangeValidation({
        dateStart,
        dateEnd,
        maxDate,
        maxPeriodeDays,
      }),
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

  const submitDisabled = !validation.valid;

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
            aria-invalid={isDateRangeFieldInvalid(validation, 'dateStart')}
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
            aria-invalid={isDateRangeFieldInvalid(validation, 'dateEnd')}
            max={maxDate}
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="consolide-date-end"
          />
        </div>
      </div>

      {/*
        Inputs hidden synchronizes : la route CSV attend `dateFrom`
        et `dateTo` (cf. `exportCsvQuerySchema`). On les alimente
        ici a partir des memes states React que les inputs visibles
        pour eviter une duplication d'UI tout en restant compatible
        avec le contrat existant du Route Handler `/api/exports/csv`.
      */}
      <input type="hidden" name="dateFrom" value={dateStart} readOnly />
      <input type="hidden" name="dateTo" value={dateEnd} readOnly />

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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          className={SUBMIT_CLASSES}
          disabled={submitDisabled}
          aria-label="Telecharger le registre PDF"
          data-testid="consolide-submit-pdf"
        >
          Telecharger le PDF
        </button>
        <button
          type="submit"
          formAction={csvActionUrl}
          className={SUBMIT_CLASSES}
          disabled={submitDisabled}
          aria-label="Telecharger le registre CSV"
          data-testid="consolide-submit-csv"
        >
          Telecharger le CSV
        </button>
        <Link
          href={DASHBOARD_PATH}
          className={SUBMIT_DESTRUCTIVE_CLASSES}
          data-testid="consolide-cancel"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
