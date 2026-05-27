import type { ReactNode } from 'react';
import { AdminDataTable, type AdminDataTableColumn } from './AdminDataTable';

/**
 * Variante responsive de `AdminDataTable` (Server Component).
 *
 * Comportement :
 *   - `md+` (>= 768px) : rendu identique a `AdminDataTable` (table HTML
 *     classique, sortable visuel, accessible). On delegue pour ne pas
 *     dupliquer la logique d'entete/empty state/cellules.
 *   - `< md` (mobile) : pile verticale de cartes, une par row. Chaque
 *     carte affiche les couples `label / valeur` empilees, beaucoup plus
 *     lisibles qu'un scroll horizontal de table sur un ecran etroit.
 *
 * Pas de `'use client'` : le toggle desktop/mobile est purement CSS
 * (`hidden md:block` / `md:hidden`). Aucun hook, aucun event handler.
 *
 * Pourquoi pas un `useMediaQuery` ?
 *   - SSR friendly : pas de "flash of wrong layout" a l'hydratation.
 *   - Pas de hook -> Server Component eligible -> bundle JS plus leger.
 *   - Imprimable / SEO : le navigateur choisit selon le viewport.
 *
 * a11y :
 *   - Mobile : `<section aria-label>` pour chaque carte, headings
 *     visuels en uppercase mais portee semantique inchangee.
 *   - Desktop : delegue les regles a `AdminDataTable` (caption, scope,
 *     role table).
 *
 * Migration : pour reutiliser sur une page admin existante, remplacer
 * `<AdminDataTable ... />` par `<ResponsiveDataTable ... />`. Les
 * `columns` typees `AdminDataTableColumn<T>` sont compatibles 1:1.
 */

interface ResponsiveDataTableProps<T> {
  readonly name: string;
  readonly columns: readonly AdminDataTableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowId: (row: T) => string;
  readonly empty?: ReactNode;
  readonly caption?: string;
}

const MOBILE_LIST_CLASSES = 'flex flex-col gap-3 md:hidden';
const MOBILE_CARD_CLASSES =
  'flex flex-col gap-3 border border-mg-noir/10 bg-mg-ivoire p-4';
const MOBILE_ROW_CLASSES =
  'flex flex-col gap-1 border-b border-mg-noir/5 pb-2 last:border-b-0 last:pb-0';
const MOBILE_LABEL_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/50';
const MOBILE_VALUE_CLASSES = 'text-sm font-light text-mg-noir';
const DESKTOP_WRAPPER_CLASSES = 'hidden md:block';
const EMPTY_CLASSES =
  'border border-mg-noir/10 bg-mg-ivoire px-6 py-12 text-center md:hidden';
const EMPTY_DOT_CLASSES = 'inline-block h-px w-10 bg-mg-or';
const EMPTY_TEXT_CLASSES =
  'mt-4 text-sm font-light tracking-wide text-mg-noir/50';

function renderCellValue<T>(
  row: T,
  column: AdminDataTableColumn<T>
): ReactNode {
  if (column.render) {
    return column.render(row);
  }
  const value = (row as unknown as Record<string, unknown>)[column.key];
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
}

export function ResponsiveDataTable<T>({
  name,
  columns,
  rows,
  getRowId,
  empty,
  caption,
}: ResponsiveDataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <>
        <div className={DESKTOP_WRAPPER_CLASSES}>
          <AdminDataTable
            name={name}
            columns={columns}
            rows={rows}
            getRowId={getRowId}
            empty={empty}
            caption={caption}
          />
        </div>
        <div
          className={EMPTY_CLASSES}
          data-testid={`responsive-table-${name}-empty`}
          role="status"
        >
          <span aria-hidden="true" className={EMPTY_DOT_CLASSES} />
          <p className={EMPTY_TEXT_CLASSES}>
            {empty ?? 'Aucun element a afficher pour le moment.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={DESKTOP_WRAPPER_CLASSES}>
        <AdminDataTable
          name={name}
          columns={columns}
          rows={rows}
          getRowId={getRowId}
          empty={empty}
          caption={caption}
        />
      </div>
      <ul
        className={MOBILE_LIST_CLASSES}
        data-testid={`responsive-table-${name}-cards`}
        aria-label={caption ?? `${name} - liste mobile`}
      >
        {rows.map((row) => {
          const id = getRowId(row);
          return (
            <li
              key={id}
              className={MOBILE_CARD_CLASSES}
              data-testid={`responsive-table-${name}-card-${id}`}
            >
              {columns.map((column) => (
                <div key={column.key} className={MOBILE_ROW_CLASSES}>
                  <span className={MOBILE_LABEL_CLASSES}>{column.label}</span>
                  <span className={MOBILE_VALUE_CLASSES}>
                    {renderCellValue(row, column)}
                  </span>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </>
  );
}
