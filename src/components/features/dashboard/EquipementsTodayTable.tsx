import Link from 'next/link';
import type { Route } from 'next';
import type { Creneau } from '@prisma/client';
import type {
  EquipementsTodayCell,
  EquipementsTodayRow,
} from '@/types/dashboard';
import { CRENEAU_LABELS, CRENEAU_ORDER } from '@/lib/constants/releve';
import { formatTemperature } from '@/lib/utils/format-temperature';

/**
 * EquipementsTodayTable - Tableau "Releves du jour" du dashboard accueil
 * (Server Component, feat/dashboard-as-home).
 *
 * Affiche une ligne par equipement actif accessible au viewer, avec 3
 * cellules creneaux (matin / midi / soir). Chaque cellule affiche :
 *   - SAISI    : badge contour or + temperature (ex: "-18.5 degC").
 *   - ALERTE   : badge or plein + temperature (charte HACCP alerte).
 *   - MANQUANT : bouton "Saisir" pointant sur la page de saisie.
 *
 * a11y :
 *   - `<table>` semantique + `<caption>` lisible aux lecteurs d'ecran.
 *   - `<th scope="col">` sur chaque entete.
 *   - `aria-label` sur le CTA "Saisir" pour expliciter equipement+creneau.
 *   - Focus visible (ring or) sur les liens "Saisir".
 *
 * data-testid :
 *   - `equipements-today-table`             : wrapper
 *   - `equipements-today-empty`             : empty state
 *   - `equipements-today-row-{eqId}`        : ligne
 *   - `equipements-today-cell-{eqId}-{cre}` : cellule
 *   - `equipements-today-saisir-{eqId}-{cre}` : CTA "Saisir"
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
const CELL_CONTAINER_CLASSES = 'flex items-center gap-2';
const BADGE_BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium tracking-wide';
const BADGE_SAISI_CLASSES = `${BADGE_BASE_CLASSES} border border-mg-or/40 bg-transparent text-mg-or`;
const BADGE_ALERTE_CLASSES = `${BADGE_BASE_CLASSES} border border-mg-or bg-mg-or text-mg-noir`;
const SAISIR_LINK_CLASSES =
  'inline-flex min-h-[44px] items-center justify-center gap-2 border border-mg-noir/20 bg-transparent px-4 py-2 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const EMPTY_CLASSES =
  'flex flex-col items-center gap-2 rounded-lg border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-6 py-10 text-center';
const EMPTY_EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const EMPTY_TEXT_CLASSES = 'text-sm font-light text-mg-noir/70';

function buildSaisirHref(equipementId: string, creneau: Creneau): Route {
  return `/releves/saisie/${equipementId}/${creneau}` as Route;
}

interface CellViewProps {
  readonly cell: EquipementsTodayCell;
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly testIdPrefix: string;
}

function CellView({
  cell,
  equipementId,
  equipementNom,
  testIdPrefix,
}: CellViewProps) {
  const creneauLabel = CRENEAU_LABELS[cell.creneau];
  if (cell.statut === 'MANQUANT') {
    return (
      <div
        className={CELL_CONTAINER_CLASSES}
        data-testid={`${testIdPrefix}-cell-${equipementId}-${cell.creneau}`}
      >
        <Link
          href={buildSaisirHref(equipementId, cell.creneau)}
          className={SAISIR_LINK_CLASSES}
          data-testid={`${testIdPrefix}-saisir-${equipementId}-${cell.creneau}`}
          aria-label={`Saisir le releve ${creneauLabel} de ${equipementNom}`}
        >
          Saisir
        </Link>
      </div>
    );
  }
  const badgeClasses =
    cell.statut === 'ALERTE' ? BADGE_ALERTE_CLASSES : BADGE_SAISI_CLASSES;
  const statusLabel = cell.statut === 'ALERTE' ? 'alerte' : 'saisi';
  return (
    <div
      className={CELL_CONTAINER_CLASSES}
      data-testid={`${testIdPrefix}-cell-${equipementId}-${cell.creneau}`}
    >
      <span
        className={badgeClasses}
        role="status"
        aria-label={`${creneauLabel} - ${statusLabel} - ${formatTemperature(cell.temperature)}`}
      >
        {formatTemperature(cell.temperature)}
      </span>
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
                    equipementNom={row.equipementNom}
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
