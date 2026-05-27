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

const NAV_CLASSES = 'mt-8 flex items-center justify-between';
/**
 * `min-h-touch` (44px) garantit la cible tactile minimale WCAG 2.1 AA.
 * Sans ce min-height, `py-1.5` + text-[10px] produisait ~26px (trop fin
 * pour un usage en boutique avec gants).
 */
const LINK_BASE =
  'inline-flex min-h-touch items-center justify-center px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:text-mg-or focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const LINK_DISABLED =
  'pointer-events-none cursor-not-allowed text-mg-noir/30 select-none';
const STATUS_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.25em] text-mg-noir/60';
const STATUS_STRONG_CLASSES = 'font-medium text-mg-or';

function buildHref(baseHref: string, page: number): Route {
  const separator = baseHref.includes('?') ? '&' : '?';
  return `${baseHref}${separator}page=${page}` as Route;
}

/**
 * Pagination simple (Server Component) avec liens `<Link>` natifs.
 *
 * Charte Maison Givre : style sobre, liens en capitales espacees gris,
 * hover or, page courante mise en valeur via l'or dans le compteur.
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
        Page <strong className={STATUS_STRONG_CLASSES}>{currentPage}</strong>{' '}
        sur <strong className={STATUS_STRONG_CLASSES}>{totalPages}</strong>
      </p>
      <div className="flex items-center gap-4">
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
