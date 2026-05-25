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
  'border-b border-[#DFE5EF] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#5A6A85]';
const TD_BASE =
  'border-b border-[#F1F4F9] px-4 py-3 text-sm text-[#2A3547] align-middle';

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
        className="rounded-[7px] border border-dashed border-[#DFE5EF] bg-white px-6 py-12 text-center text-sm text-[#5A6A85]"
        data-testid={`admin-table-${name}-empty`}
        role="status"
      >
        {empty ?? 'Aucun element a afficher pour le moment.'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[7px] border border-[#DFE5EF] bg-white">
      <div className="overflow-x-auto">
        <table
          role="table"
          className="w-full border-collapse"
          data-testid={`admin-table-${name}`}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-[#F6F9FC]">
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
                  className="hover:bg-[#F6F9FC]"
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
