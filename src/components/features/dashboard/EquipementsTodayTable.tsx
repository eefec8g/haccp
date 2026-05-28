import type {
  EquipementsTodayCell,
  EquipementsTodayRow,
} from '@/types/dashboard';
import { CRENEAU_LABELS, CRENEAU_ORDER } from '@/lib/constants/releve';
import { formatTemperature } from '@/lib/utils/format-temperature';
import { formatTimeShort } from '@/lib/utils/dates';
import {
  getTemperatureBand,
  type TemperatureBand,
} from '@/lib/utils/temperature-band';

/**
 * EquipementsTodayTable - Tableau "Releves du jour" du dashboard accueil
 * (Server Component, feat/tournee-guidee).
 *
 * Read-only depuis feat/tournee-guidee : les anciens boutons "Saisir"
 * inline ont ete supprimes au profit de la tournee guidee (voir
 * `<TourneeButtons>`). Chaque cellule affiche desormais :
 *   - SAISI    : badge contour or + temperature.
 *   - ALERTE   : badge or plein + temperature.
 *   - MANQUANT : libelle "Non saisi" en italique (lecture seule).
 *
 * a11y :
 *   - `<table>` semantique + `<caption>` lisible.
 *   - `<th scope="col">` sur chaque entete.
 *
 * data-testid :
 *   - `equipements-today-table`             : wrapper
 *   - `equipements-today-empty`             : empty state
 *   - `equipements-today-row-{eqId}`        : ligne
 *   - `equipements-today-cell-{eqId}-{cre}` : cellule
 */

interface EquipementsTodayTableProps {
  readonly rows: readonly EquipementsTodayRow[];
  /** `data-testid` du wrapper (defaut : equipements-today-table). */
  readonly testId?: string;
  /** Caption accessible (defaut : "Releves du jour"). */
  readonly caption?: string;
}

const WRAPPER_CLASSES =
  'overflow-hidden rounded-lg border border-mg-noir/10 bg-white';
const TABLE_CLASSES = 'min-w-full text-sm text-mg-noir';
const HEAD_CLASSES =
  'bg-mg-ivoire/60 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const TH_CLASSES = 'px-6 py-3 text-left';
const ROW_CLASSES = 'border-t border-mg-noir/5 font-light';
const TD_CLASSES = 'px-6 py-4 align-middle';
const CELL_CONTAINER_CLASSES = 'flex flex-col items-start gap-0';
const BADGE_BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide';

/**
 * Code couleur par plage de temperature (repere visuel terrain) :
 *   - COLD   (< 0 degC)   : bleu (regime froid normal)
 *   - NORMAL (0 a 20 degC) : neutre noir
 *   - HIGH   (> 20 degC)  : rouge (anormalement chaud)
 */
const BADGE_BAND_CLASSES: Readonly<Record<TemperatureBand, string>> = {
  COLD: `${BADGE_BASE_CLASSES} border border-blue-400/50 bg-blue-50 text-blue-700`,
  NORMAL: `${BADGE_BASE_CLASSES} border border-mg-noir/20 bg-transparent text-mg-noir`,
  HIGH: `${BADGE_BASE_CLASSES} border border-red-400/50 bg-red-50 text-red-700`,
};
const MISSING_TEXT_CLASSES = 'text-sm font-light italic text-mg-noir/40';
const CELL_TIME_CLASSES = 'mt-1 text-[10px] tracking-wide text-mg-noir/50';
const EMPTY_CLASSES =
  'flex flex-col items-center gap-2 rounded-lg border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-6 py-10 text-center';
const EMPTY_EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const EMPTY_TEXT_CLASSES = 'text-sm font-light text-mg-noir/70';

const MISSING_LABEL = 'Non saisi';

interface CellViewProps {
  readonly cell: EquipementsTodayCell;
  readonly equipementId: string;
  readonly testIdPrefix: string;
}

function CellView({ cell, equipementId, testIdPrefix }: CellViewProps) {
  const creneauLabel = CRENEAU_LABELS[cell.creneau];
  if (cell.statut === 'MANQUANT') {
    return (
      <div
        className={CELL_CONTAINER_CLASSES}
        data-testid={`${testIdPrefix}-cell-${equipementId}-${cell.creneau}`}
      >
        <span
          className={MISSING_TEXT_CLASSES}
          aria-label={`${creneauLabel} - non saisi`}
        >
          {MISSING_LABEL}
        </span>
      </div>
    );
  }
  const band = getTemperatureBand(cell.temperature) ?? 'NORMAL';
  const badgeClasses = BADGE_BAND_CLASSES[band];
  const statusLabel = cell.statut === 'ALERTE' ? 'alerte' : 'saisi';
  const heureLabel = cell.saisiAt ? formatTimeShort(cell.saisiAt) : null;
  return (
    <div
      className={CELL_CONTAINER_CLASSES}
      data-testid={`${testIdPrefix}-cell-${equipementId}-${cell.creneau}`}
    >
      <span
        className={badgeClasses}
        role="status"
        aria-label={`${creneauLabel} - ${statusLabel} - ${formatTemperature(cell.temperature)}${heureLabel ? ` a ${heureLabel}` : ''}`}
      >
        {formatTemperature(cell.temperature)}
      </span>
      {heureLabel ? (
        <span
          className={CELL_TIME_CLASSES}
          data-testid={`${testIdPrefix}-cell-${equipementId}-${cell.creneau}-time`}
        >
          {heureLabel}
        </span>
      ) : null}
    </div>
  );
}

export function EquipementsTodayTable({
  rows,
  testId,
  caption,
}: EquipementsTodayTableProps) {
  const dataTestId = testId ?? 'equipements-today-table';
  const tableCaption = caption ?? 'Releves du jour';
  if (rows.length === 0) {
    return (
      <div
        className={EMPTY_CLASSES}
        data-testid={`${dataTestId}-empty`}
        role="status"
      >
        <p className={EMPTY_EYEBROW_CLASSES}>Aucun equipement</p>
        <p className={EMPTY_TEXT_CLASSES}>Aucun equipement actif.</p>
      </div>
    );
  }
  return (
    <div className={WRAPPER_CLASSES} data-testid={dataTestId}>
      <table className={TABLE_CLASSES}>
        <caption className="sr-only">{tableCaption}</caption>
        <thead className={HEAD_CLASSES}>
          <tr>
            <th scope="col" className={TH_CLASSES}>
              Equipement
            </th>
            <th scope="col" className={TH_CLASSES}>
              Boutique
            </th>
            {CRENEAU_ORDER.map((creneau) => (
              <th key={creneau} scope="col" className={TH_CLASSES}>
                {CRENEAU_LABELS[creneau]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.equipementId}
              className={ROW_CLASSES}
              data-testid={`${dataTestId}-row-${row.equipementId}`}
            >
              <td className={TD_CLASSES}>{row.equipementNom}</td>
              <td className={TD_CLASSES}>{row.boutiqueNom}</td>
              {CRENEAU_ORDER.map((creneau) => (
                <td key={creneau} className={TD_CLASSES}>
                  <CellView
                    cell={row.cells[creneau]}
                    equipementId={row.equipementId}
                    testIdPrefix={dataTestId}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
