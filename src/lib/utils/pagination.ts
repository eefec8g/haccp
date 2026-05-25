import type { PaginatedResult, PaginationQuery } from '@/types/admin';

/**
 * Construit un PaginatedResult<T> a partir des items, total et query.
 *
 * Factorise un pattern duplique par chaque service listant (boutique,
 * equipement, user, audit-log) - DRY (Clean Code #4).
 *
 * `totalPages` est borne a 1 minimum pour que l'UI puisse toujours
 * afficher "Page 1/1" meme quand la liste est vide.
 */
export function buildPaginated<T>(
  items: readonly T[],
  total: number,
  query: PaginationQuery
): PaginatedResult<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
