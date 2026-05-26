import type { AlerteListItem as AlerteListItemData } from '@/lib/services/alerte.service';
import { Pagination } from '@/components/features/admin/Pagination';
import { AlerteListItem } from './AlerteListItem';

/**
 * Liste des alertes ouvertes (US-ALE-001).
 *
 * Server Component pur :
 *   - Empty state sobre si aucune alerte (cas nominal : "tout est OK").
 *   - Sinon, liste de cartes `AlerteListItem` (1 par alerte).
 *   - Pagination liens `<Link>` en bas (server-side navigation).
 *
 * a11y :
 *   - `role="region"` + `aria-label` sur la section.
 *   - `aria-live="polite"` sur l'empty state pour l'annonce screen reader.
 */

interface AlerteListProps {
  readonly items: readonly AlerteListItemData[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

const SECTION_CLASSES = 'flex flex-col gap-4';
const EMPTY_CLASSES =
  'rounded-lg border border-mg-noir/10 bg-white px-6 py-16 text-center';
const EMPTY_TEXT_CLASSES = 'text-sm font-light italic text-mg-noir/60';
const PAGINATION_BASE_HREF = '/alertes';
const EMPTY_MESSAGE = 'Aucune alerte ouverte. Tout est en ordre.';

export function AlerteList({ items, pagination }: AlerteListProps) {
  if (items.length === 0) {
    return (
      <section
        className={EMPTY_CLASSES}
        data-testid="alerte-list-empty"
        aria-live="polite"
      >
        <p className={EMPTY_TEXT_CLASSES}>{EMPTY_MESSAGE}</p>
      </section>
    );
  }

  return (
    <section
      className={SECTION_CLASSES}
      data-testid="alerte-list"
      aria-label="Alertes ouvertes"
    >
      {items.map((alerte) => (
        <AlerteListItem key={alerte.id} alerte={alerte} />
      ))}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        baseHref={PAGINATION_BASE_HREF}
      />
    </section>
  );
}
