import Link from 'next/link';
import type { Route } from 'next';

interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  /**
   * Base URL avec query string sans le param `page`. Exemple :
   *   `/admin/boutiques` ou `/admin/equipements?boutiqueId=xxx`.
   * Le composant ajoute `&page=N` ou `?page=N` selon le cas.
   */
  readonly baseHref: string;
}

const NAV_CLASSES = 'mt-4 flex items-center justify-between';
const LINK_BASE =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#2A3547] transition-colors hover:bg-[#ECF2FF] hover:text-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const LINK_DISABLED =
  'pointer-events-none cursor-not-allowed opacity-40 select-none';
const STATUS_CLASSES = 'text-sm text-[#5A6A85]';

function buildHref(baseHref: string, page: number): Route {
  const separator = baseHref.includes('?') ? '&' : '?';
  return `${baseHref}${separator}page=${page}` as Route;
}

/**
 * Pagination simple (Server Component) avec liens `<Link>` natifs.
 *
 * a11y :
 *   - `<nav aria-label="Pagination">`.
 *   - Bouton precedent/suivant desactives signales par `aria-disabled`.
 *   - Status visible "Page N sur M" pour le screen reader.
 */
export function Pagination({
  currentPage,
  totalPages,
  baseHref,
}: PaginationProps) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className={NAV_CLASSES}
      data-testid="admin-pagination"
    >
      <p className={STATUS_CLASSES} aria-live="polite">
        Page <strong>{currentPage}</strong> sur <strong>{totalPages}</strong>
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(baseHref, currentPage - 1)}
            className={LINK_BASE}
            rel="prev"
            data-testid="admin-pagination-prev"
          >
            Precedent
          </Link>
        ) : (
          <span
            className={`${LINK_BASE} ${LINK_DISABLED}`}
            aria-disabled="true"
          >
            Precedent
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(baseHref, currentPage + 1)}
            className={LINK_BASE}
            rel="next"
            data-testid="admin-pagination-next"
          >
            Suivant
          </Link>
        ) : (
          <span
            className={`${LINK_BASE} ${LINK_DISABLED}`}
            aria-disabled="true"
          >
            Suivant
          </span>
        )}
      </div>
    </nav>
  );
}
