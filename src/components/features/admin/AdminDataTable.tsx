import type { ReactNode } from 'react';

export interface AdminDataTableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly render?: (row: T) => ReactNode;
  readonly align?: 'left' | 'right' | 'center';
  readonly width?: string;
}

interface AdminDataTableProps<T> {
  readonly name: string;
  readonly columns: readonly AdminDataTableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowId: (row: T) => string;
  readonly empty?: ReactNode;
  readonly caption?: string;
}

const TH_BASE =
  'border-b border-mg-or/40 px-5 py-4 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-ivoire';
const TD_BASE =
  'border-b border-mg-noir/10 px-5 py-4 text-sm font-light text-mg-noir align-middle';

function alignClass(align: AdminDataTableColumn<unknown>['align']): string {
  if (align === 'right') {
    return 'text-right';
  }
  if (align === 'center') {
    return 'text-center';
  }
  return 'text-left';
}

function renderCell<T>(row: T, column: AdminDataTableColumn<T>): ReactNode {
  if (column.render) {
    return column.render(row);
  }
  // Best-effort : si la cle correspond a un champ string/number, on
  // l'affiche. Sinon -> vide (le caller doit fournir `render`).
  const value = (row as unknown as Record<string, unknown>)[column.key];
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return null;
}

/**
 * Table de donnees generique (Server Component).
 *
 * Charte Maison Givre : header noir profond, cellules d'entete en
 * capitales tres espacees ivoire, lignes ivoire avec hover noir tres
 * subtil, separateurs fins. Empty state minimaliste en gris clair.
 *
 * a11y :
 *   - `role="table"` explicite (deja implicite sur `<table>` mais
 *     defensif vs reset CSS).
 *   - `<th scope="col">` sur chaque entete.
 *   - `<caption>` masque par defaut, sert le screen reader.
 *
 * data-testid : `admin-table-{name}` + une row par id pour les E2E.
 */
export function AdminDataTable<T>({
  name,
  columns,
  rows,
  getRowId,
  empty,
  caption,
}: AdminDataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div
        className="border border-mg-noir/10 bg-mg-ivoire px-6 py-16 text-center"
        data-testid={`admin-table-${name}-empty`}
        role="status"
      >
        <span aria-hidden="true" className="inline-block h-px w-10 bg-mg-or" />
        <p className="mt-4 text-sm font-light tracking-wide text-mg-noir/50">
          {empty ?? 'Aucun element a afficher pour le moment.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-mg-noir/10 bg-mg-ivoire">
      <div className="overflow-x-auto">
        <table
          role="table"
          className="w-full border-collapse"
          data-testid={`admin-table-${name}`}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-mg-noir">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`${TH_BASE} ${alignClass(column.align)}`}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getRowId(row);
              return (
                <tr
                  key={id}
                  data-testid={`admin-table-${name}-row-${id}`}
                  className="transition-colors hover:bg-mg-noir/[0.03]"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${TD_BASE} ${alignClass(column.align)}`}
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
