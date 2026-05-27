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
import { CRENEAU_LABELS, CRENEAU_ORDER } from '@/lib/constants/releve';
import {
  MAX_PERIODE_DAYS,
  STATUT_LABELS,
} from '@/lib/constants/releve-listing';
import {
  computeDateRangeValidation,
  isDateRangeFieldInvalid,
} from '@/lib/utils/date-range-validation';
import type { ReleveListingStatut } from '@/types/releve-listing';
import type { Creneau } from '@prisma/client';

/**
 * Formulaire de filtrage du listing des releves multi-jours (Epic
 * LISTING, Phase 2).
 *
 * Pattern : HTML form GET vers `/releves/listing`. Le navigateur recharge
 * la page Server Component avec les nouveaux query params (validation
 * Zod cote serveur via `releveListingQuerySchema` -- defense en
 * profondeur). Aucune Server Action ici : pas de mutation, juste un
 * changement d'URL.
 *
 * Validation cote client (UX uniquement) :
 *   - `dateStart <= dateEnd` ;
 *   - `dateEnd <= today` ;
 *   - periode <= `MAX_PERIODE_DAYS` jours.
 *
 * Le selecteur "equipement" est dependant du selecteur "boutique" : si
 * une boutique est selectionnee, on ne propose que ses equipements. Si
 * la boutique change, le filtre equipement est automatiquement reset
 * (eviter un equipementId orphelin qui ferait `EQUIPEMENT_NOT_FOUND`
 * cote service).
 *
 * Granularite `aria-invalid` (CC-7) : marque uniquement le(s) champ(s)
 * en cause -- `dateEnd` pour les erreurs de longueur/futur, les deux
 * pour `start > end`.
 */

export interface ReleveListingFormBoutique {
  readonly id: string;
  readonly nom: string;
}

export interface ReleveListingFormEquipement {
  readonly id: string;
  readonly nom: string;
  readonly boutiqueId: string;
}

export interface ReleveListingFormCurrentQuery {
  readonly boutiqueId?: string;
  readonly equipementId?: string;
  readonly creneau?: Creneau;
  readonly statut?: ReleveListingStatut;
  readonly dateStart: string;
  readonly dateEnd: string;
}

interface ReleveListingFormProps {
  readonly boutiques: readonly ReleveListingFormBoutique[];
  readonly equipements: readonly ReleveListingFormEquipement[];
  readonly currentQuery: ReleveListingFormCurrentQuery;
  readonly maxDate: string;
  readonly errorMessage?: string;
}

const LISTING_PATH = '/releves/listing' as Route;
const ACTION_URL = '/releves/listing';

function filterEquipementsByBoutique(
  equipements: readonly ReleveListingFormEquipement[],
  boutiqueId: string
): readonly ReleveListingFormEquipement[] {
  if (!boutiqueId) {
    return equipements;
  }
  return equipements.filter((eq) => eq.boutiqueId === boutiqueId);
}

const STATUT_OPTIONS: readonly ReleveListingStatut[] = [
  'SAISI',
  'ALERTE',
  'MANQUANT',
  'ANNULE',
] as const;

export function ReleveListingForm({
  boutiques,
  equipements,
  currentQuery,
  maxDate,
  errorMessage,
}: ReleveListingFormProps): React.ReactElement {
  const [boutiqueId, setBoutiqueId] = useState<string>(
    currentQuery.boutiqueId ?? ''
  );
  const [equipementId, setEquipementId] = useState<string>(
    currentQuery.equipementId ?? ''
  );
  const [creneau, setCreneau] = useState<string>(currentQuery.creneau ?? '');
  const [statut, setStatut] = useState<string>(currentQuery.statut ?? '');
  const [dateStart, setDateStart] = useState<string>(currentQuery.dateStart);
  const [dateEnd, setDateEnd] = useState<string>(currentQuery.dateEnd);

  const visibleEquipements = useMemo(
    () => filterEquipementsByBoutique(equipements, boutiqueId),
    [equipements, boutiqueId]
  );

  const validation = useMemo(
    () =>
      computeDateRangeValidation({
        dateStart,
        dateEnd,
        maxDate,
        maxPeriodeDays: MAX_PERIODE_DAYS,
      }),
    [dateStart, dateEnd, maxDate]
  );

  const handleBoutiqueChange = (next: string): void => {
    setBoutiqueId(next);
    // Reset equipement filter if the previously selected equipement no
    // longer belongs to the newly selected boutique (defense vs
    // `EQUIPEMENT_NOT_FOUND` server-side).
    if (!next) {
      return;
    }
    const stillValid = equipements.some(
      (eq) => eq.id === equipementId && eq.boutiqueId === next
    );
    if (!stillValid) {
      setEquipementId('');
    }
  };

  const serverErrorId = 'listing-form-server-error';
  const clientErrorId = 'listing-form-client-error';
  const describedBy =
    [
      errorMessage ? serverErrorId : null,
      validation.message ? clientErrorId : null,
    ]
      .filter((id): id is string => id !== null)
      .join(' ') || undefined;

  return (
    <form
      action={ACTION_URL}
      method="get"
      className="space-y-6"
      data-testid="listing-form"
      noValidate
      aria-describedby={describedBy}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="listing-boutique" className={LABEL_CLASSES}>
            Boutique
          </label>
          <select
            id="listing-boutique"
            name="boutiqueId"
            value={boutiqueId}
            onChange={(e) => handleBoutiqueChange(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-boutique"
          >
            <option value="">Toutes mes boutiques</option>
            {boutiques.map((boutique) => (
              <option key={boutique.id} value={boutique.id}>
                {boutique.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="listing-equipement" className={LABEL_CLASSES}>
            Equipement
          </label>
          <select
            id="listing-equipement"
            name="equipementId"
            value={equipementId}
            onChange={(e) => setEquipementId(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-equipement"
          >
            <option value="">Tous les equipements</option>
            {visibleEquipements.map((equipement) => (
              <option key={equipement.id} value={equipement.id}>
                {equipement.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="listing-creneau" className={LABEL_CLASSES}>
            Creneau
          </label>
          <select
            id="listing-creneau"
            name="creneau"
            value={creneau}
            onChange={(e) => setCreneau(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-creneau"
          >
            <option value="">Tous</option>
            {CRENEAU_ORDER.map((value) => (
              <option key={value} value={value}>
                {CRENEAU_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="listing-statut" className={LABEL_CLASSES}>
            Statut
          </label>
          <select
            id="listing-statut"
            name="statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-statut"
          >
            <option value="">Tous</option>
            {STATUT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STATUT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="listing-date-start" className={LABEL_CLASSES}>
            Date de debut
          </label>
          <input
            id="listing-date-start"
            name="dateStart"
            type="date"
            required
            aria-required="true"
            aria-invalid={isDateRangeFieldInvalid(validation, 'dateStart')}
            max={maxDate}
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-date-start"
          />
        </div>
        <div>
          <label htmlFor="listing-date-end" className={LABEL_CLASSES}>
            Date de fin
          </label>
          <input
            id="listing-date-end"
            name="dateEnd"
            type="date"
            required
            aria-required="true"
            aria-invalid={isDateRangeFieldInvalid(validation, 'dateEnd')}
            max={maxDate}
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className={INPUT_CLASSES}
            data-testid="listing-date-end"
          />
        </div>
      </div>

      {errorMessage ? (
        <div
          id={serverErrorId}
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid="listing-form-error"
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
          data-testid="listing-form-client-error"
        >
          {validation.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={SUBMIT_CLASSES}
          disabled={!validation.valid}
          data-testid="listing-submit"
        >
          Appliquer les filtres
        </button>
        <Link
          href={LISTING_PATH}
          className={SUBMIT_DESTRUCTIVE_CLASSES}
          data-testid="listing-reset"
        >
          Reinitialiser
        </Link>
      </div>
    </form>
  );
}
