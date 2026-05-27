import Link from 'next/link';
import type { Route } from 'next';
import type { AdminDataTableColumn } from '@/components/features/admin/AdminDataTable';
import { ResponsiveDataTable } from '@/components/features/admin/ResponsiveDataTable';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { STATUT_COLORS, STATUT_LABELS } from '@/lib/constants/releve-listing';
import { formatDateShort } from '@/lib/utils/dates';
import { formatTemperature } from '@/lib/utils/format-temperature';
import type { ReleveListingItem } from '@/types/releve-listing';

/**
 * Tableau responsive des items du listing releves multi-jours (Epic
 * LISTING, Phase 2). Server Component.
 *
 * Reutilise `ResponsiveDataTable` (Epic ADMIN) pour la mise en page
 * desktop/mobile :
 *   - >= md : table HTML classique, headers noirs sur ivoire.
 *   - <  md : pile de cards "label / value" empilees.
 *
 * Colonnes :
 *   1. Date            : `JJ/MM/AAAA` via `formatDateShort`.
 *   2. Creneau         : libelle FR (`CRENEAU_LABELS`).
 *   3. Boutique        : nom.
 *   4. Equipement      : nom.
 *   5. Temperature     : `XX.X degC` ou `--` si MANQUANT (cf. RG-LIST-001).
 *   6. Statut          : badge colore selon `STATUT_COLORS` + label
 *                        `STATUT_LABELS`.
 *   7. Salarie         : nom ou `--` (MANQUANT).
 *   8. Motif annulation: motif ANNULE ou `--`.
 *   9. Actions         : lien "Voir" vers le registre de la journee
 *                        (`/boutiques/[boutiqueId]/registre/[dateISO]`).
 *
 * a11y : `getRowId` retourne un id stable (`id` du releve, ou cle
 * synthetique pour les items MANQUANTS qui n'ont pas d'`id`).
 */

interface ReleveListingTableProps {
  readonly items: readonly ReleveListingItem[];
}

const EMPTY_PLACEHOLDER = '—';
const EMPTY_MESSAGE =
  'Aucun releve sur la periode et les filtres selectionnes.';
const ACTION_LINK_CLASSES =
  'inline-flex min-h-touch items-center justify-center px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:text-mg-or focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

function formatNullable(value: string | null): string {
  if (value === null || value.length === 0) {
    return EMPTY_PLACEHOLDER;
  }
  return value;
}

function buildRegistreHref(boutiqueId: string, dateISO: string): Route {
  return `/boutiques/${boutiqueId}/registre/${dateISO}` as Route;
}

function itemRowId(item: ReleveListingItem): string {
  if (item.id !== null) {
    return `${item.statut.toLowerCase()}-${item.id}`;
  }
  return `manquant-${item.dateISO}-${item.equipementId}-${item.creneau}`;
}

function renderDate(row: ReleveListingItem): React.ReactNode {
  return formatDateShort(row.dateISO);
}

function renderCreneau(row: ReleveListingItem): React.ReactNode {
  return CRENEAU_LABELS[row.creneau];
}

function renderTemperature(row: ReleveListingItem): React.ReactNode {
  return (
    <span className="tabular-nums">{formatTemperature(row.temperature)}</span>
  );
}

function renderStatut(row: ReleveListingItem): React.ReactNode {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-[0.2em] ${STATUT_COLORS[row.statut]}`}
      data-testid={`listing-row-${itemRowId(row)}-statut`}
    >
      {STATUT_LABELS[row.statut]}
    </span>
  );
}

function renderSalarie(row: ReleveListingItem): React.ReactNode {
  return formatNullable(row.salarieNom);
}

function renderMotif(row: ReleveListingItem): React.ReactNode {
  return formatNullable(row.motifAnnulation);
}

function renderAction(row: ReleveListingItem): React.ReactNode {
  return (
    <Link
      href={buildRegistreHref(row.boutiqueId, row.dateISO)}
      className={ACTION_LINK_CLASSES}
      data-testid={`listing-row-${itemRowId(row)}-action`}
      aria-label={`Voir le registre du ${formatDateShort(row.dateISO)} pour ${row.equipementNom}`}
    >
      Voir
    </Link>
  );
}

const COLUMNS: readonly AdminDataTableColumn<ReleveListingItem>[] = [
  { key: 'date', label: 'Date', render: renderDate },
  { key: 'creneau', label: 'Creneau', render: renderCreneau },
  { key: 'boutiqueNom', label: 'Boutique' },
  { key: 'equipementNom', label: 'Equipement' },
  {
    key: 'temperature',
    label: 'Temperature',
    render: renderTemperature,
    align: 'right',
  },
  { key: 'statut', label: 'Statut', render: renderStatut },
  { key: 'salarieNom', label: 'Salarie', render: renderSalarie },
  { key: 'motifAnnulation', label: 'Motif', render: renderMotif },
  {
    key: 'action',
    label: 'Action',
    render: renderAction,
    align: 'right',
  },
];

export function ReleveListingTable({
  items,
}: ReleveListingTableProps): React.ReactElement {
  return (
    <ResponsiveDataTable
      name="releve-listing"
      columns={COLUMNS}
      rows={items}
      getRowId={itemRowId}
      empty={EMPTY_MESSAGE}
      caption="Liste des releves de la periode selectionnee"
    />
  );
}
