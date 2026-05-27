'use client';

import { useMemo, useState } from 'react';
import {
  ERROR_BOX_CLASSES,
  INPUT_CLASSES,
  LABEL_CLASSES,
  SUBMIT_CLASSES,
} from '@/components/features/ui/form-styles';

/**
 * Formulaire d'export partage entre US-EXP-001 (CSV) et US-EXP-002 (PDF).
 *
 * Pattern : HTML form GET vers un Route Handler. Le browser gere le
 * download natif via `Content-Disposition: attachment`. Pas de Server
 * Action ici car la response est binaire (CSV / PDF) - les Server
 * Actions sont concues pour retourner des donnees serialisables, pas
 * des bytes.
 *
 * Modes :
 *   - `csv` : range (dateFrom + dateTo) + boutique optionnelle + equipement
 *     optionnel (filtre client par boutique selectionnee).
 *   - `pdf` : date unique (registre journalier 1 jour) + boutique requise.
 *
 * Erreur eventuelle (range trop large, scope invalide) : le Route Handler
 * redirige vers la page form avec un parametre `?error=<code>` que la
 * page lit et passe en prop `errorMessage`. Pas de gestion d'etat client
 * complexe pour rester compatible UX boutique low-tech.
 */

export interface ExportFormBoutique {
  readonly id: string;
  readonly nom: string;
}

export interface ExportFormEquipement {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
}

interface ExportFormProps {
  readonly mode: 'csv' | 'pdf';
  readonly actionUrl: string;
  readonly boutiques: readonly ExportFormBoutique[];
  readonly equipements?: readonly ExportFormEquipement[];
  readonly submitLabel?: string;
  readonly errorMessage?: string;
  readonly defaultDateISO: string;
}

export function ExportForm({
  mode,
  actionUrl,
  boutiques,
  equipements,
  submitLabel,
  errorMessage,
  defaultDateISO,
}: ExportFormProps): React.ReactElement {
  const [selectedBoutique, setSelectedBoutique] = useState<string>('');
  const filteredEquipements = useMemo(() => {
    if (!equipements) {
      return [];
    }
    if (!selectedBoutique) {
      return equipements;
    }
    return equipements.filter((eq) => eq.boutiqueId === selectedBoutique);
  }, [equipements, selectedBoutique]);

  const computedSubmitLabel =
    submitLabel ??
    (mode === 'csv' ? 'Telecharger le CSV' : 'Telecharger le PDF');

  const errorElementId = 'export-form-error';

  return (
    <form
      action={actionUrl}
      method="get"
      className="space-y-6"
      data-testid="export-form"
      noValidate
      aria-describedby={errorMessage ? errorElementId : undefined}
    >
      {mode === 'csv' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="export-date-from" className={LABEL_CLASSES}>
              Du
            </label>
            <input
              id="export-date-from"
              name="dateFrom"
              type="date"
              required
              aria-required="true"
              max={defaultDateISO}
              defaultValue={defaultDateISO}
              className={INPUT_CLASSES}
              data-testid="export-form-date-from"
            />
          </div>
          <div>
            <label htmlFor="export-date-to" className={LABEL_CLASSES}>
              Au
            </label>
            <input
              id="export-date-to"
              name="dateTo"
              type="date"
              required
              aria-required="true"
              max={defaultDateISO}
              defaultValue={defaultDateISO}
              className={INPUT_CLASSES}
              data-testid="export-form-date-to"
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="export-date" className={LABEL_CLASSES}>
            Date du registre
          </label>
          <input
            id="export-date"
            name="date"
            type="date"
            required
            aria-required="true"
            max={defaultDateISO}
            defaultValue={defaultDateISO}
            className={INPUT_CLASSES}
            data-testid="export-form-date"
          />
        </div>
      )}

      <div>
        <label htmlFor="export-boutique" className={LABEL_CLASSES}>
          Boutique
          {mode === 'pdf' ? (
            <>
              {' '}
              <abbr
                title="champ obligatoire"
                aria-label="champ obligatoire"
                className="text-mg-noir/70"
              >
                *
              </abbr>
            </>
          ) : (
            ' (toutes par defaut)'
          )}
        </label>
        <select
          id="export-boutique"
          name="boutiqueId"
          required={mode === 'pdf'}
          aria-required={mode === 'pdf' ? 'true' : undefined}
          value={selectedBoutique}
          onChange={(e) => setSelectedBoutique(e.target.value)}
          className={INPUT_CLASSES}
          data-testid="export-form-boutique"
        >
          <option value="">
            {mode === 'pdf'
              ? 'Selectionner une boutique'
              : 'Toutes les boutiques accessibles'}
          </option>
          {boutiques.map((boutique) => (
            <option key={boutique.id} value={boutique.id}>
              {boutique.nom}
            </option>
          ))}
        </select>
      </div>

      {mode === 'csv' && equipements && equipements.length > 0 ? (
        <div>
          <label htmlFor="export-equipement" className={LABEL_CLASSES}>
            Equipement (optionnel)
          </label>
          <select
            id="export-equipement"
            name="equipementId"
            className={INPUT_CLASSES}
            data-testid="export-form-equipement"
          >
            <option value="">Tous les equipements</option>
            {filteredEquipements.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nom}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          id={errorElementId}
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid="export-form-error"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        className={SUBMIT_CLASSES}
        data-testid="export-form-submit"
      >
        {computedSubmitLabel}
      </button>
    </form>
  );
}
