import type { ReleveListItem } from '@/types/releve';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import { CreneauBadge } from './CreneauBadge';
import { DateCourte } from './DateCourte';
import {
  ReleveStatusIndicator,
  type ReleveStatusVariant,
} from './ReleveStatusIndicator';
import { Pagination } from '@/components/features/admin/Pagination';

/**
 * Liste paginee des releves recents d'un salarie (US-REL-003).
 *
 * Server Component pur, charte Maison Givre. Rend :
 *   - un empty state sobre si `items` est vide,
 *   - sinon un tableau responsive (Date / Creneau / Equipement /
 *     Boutique / Temperature / Statut),
 *   - une pagination par liens `<Link>` (server-side navigation),
 *     masquee si `totalPages <= 1`.
 *
 * Les releves annules sont visuellement degrades (texte attenu +
 * barre) via la variante `ANNULE` du `ReleveStatusIndicator` et un
 * `aria-disabled` sur la ligne (lecture seule historique).
 *
 * a11y :
 *   - `role="region"` + `aria-label` sur la section,
 *   - `<table>` semantique + caption masquee,
 *   - `aria-live="polite"` sur l'empty state.
 */

const SECTION_CLASSES =
  'flex flex-col gap-6 rounded-lg border border-mg-noir/10 bg-white p-6';
const TABLE_CLASSES = 'w-full border-collapse text-left text-sm';
const TH_CLASSES =
  'border-b border-mg-noir/10 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-mg-noir/60';
const TD_CLASSES = 'border-b border-mg-noir/5 px-3 py-3 align-middle';
const ROW_BASE = 'transition-colors hover:bg-mg-ivoire/40';
const ROW_ANNULE = 'opacity-60 [&_td]:line-through';
const EMPTY_CLASSES =
  'rounded-lg border border-mg-noir/10 bg-white px-6 py-16 text-center';
const EMPTY_TEXT_CLASSES = 'text-sm font-light italic text-mg-noir/60';

const PAGINATION_BASE_HREF = '/releves/historique';
const EMPTY_MESSAGE = 'Aucun releve sur les 7 derniers jours.';

interface ReleveHistoryListProps {
  readonly items: readonly ReleveListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

function statusVariantFor(item: ReleveListItem): ReleveStatusVariant {
  if (item.annule) {
    return 'ANNULE';
  }
  if (item.alerteHorsSeuils) {
    return 'ALERTE';
  }
  return 'ACTIF';
}

interface ReleveRowProps {
  readonly item: ReleveListItem;
}

function ReleveRow({ item }: ReleveRowProps) {
  const variant = statusVariantFor(item);
  const rowClasses = item.annule ? `${ROW_BASE} ${ROW_ANNULE}` : ROW_BASE;
  return (
    <tr
      className={rowClasses}
      data-testid={`releve-row-${item.id}`}
      aria-disabled={item.annule ? 'true' : undefined}
    >
      <td className={TD_CLASSES}>
        <DateCourte
          value={item.date}
          className="font-light text-mg-noir"
          data-testid={`releve-row-${item.id}-date`}
        />
      </td>
      <td className={TD_CLASSES}>
        <CreneauBadge
          creneau={item.creneau}
          status={item.alerteHorsSeuils ? 'ALERTE' : 'DONE'}
          data-testid={`releve-row-${item.id}-creneau`}
        />
        <span className="sr-only">{CRENEAU_LABELS[item.creneau]}</span>
      </td>
      <td className={`${TD_CLASSES} font-light text-mg-noir`}>
        {item.equipementNom}
      </td>
      <td className={`${TD_CLASSES} font-light text-mg-noir/70`}>
        {item.boutiqueNom}
      </td>
      <td className={`${TD_CLASSES} font-medium tabular-nums text-mg-noir`}>
        {item.temperature.toFixed(1)} degC
      </td>
      <td className={TD_CLASSES}>
        <ReleveStatusIndicator
          variant={variant}
          data-testid={`releve-row-${item.id}-status`}
        />
      </td>
    </tr>
  );
}

export function ReleveHistoryList({
  items,
  pagination,
}: ReleveHistoryListProps) {
  if (items.length === 0) {
    return (
      <section
        className={EMPTY_CLASSES}
        data-testid="releve-history-empty"
        aria-live="polite"
      >
        <p className={EMPTY_TEXT_CLASSES}>{EMPTY_MESSAGE}</p>
      </section>
    );
  }

  return (
    <section
      className={SECTION_CLASSES}
      data-testid="releve-history-list"
      aria-label="Mes releves recents"
    >
      <div className="overflow-x-auto">
        <table className={TABLE_CLASSES}>
          <caption className="sr-only">
            Historique des releves des 7 derniers jours
          </caption>
          <thead>
            <tr>
              <th className={TH_CLASSES} scope="col">
                Date
              </th>
              <th className={TH_CLASSES} scope="col">
                Creneau
              </th>
              <th className={TH_CLASSES} scope="col">
                Equipement
              </th>
              <th className={TH_CLASSES} scope="col">
                Boutique
              </th>
              <th className={TH_CLASSES} scope="col">
                Temperature
              </th>
              <th className={TH_CLASSES} scope="col">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ReleveRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        baseHref={PAGINATION_BASE_HREF}
      />
    </section>
  );
}
