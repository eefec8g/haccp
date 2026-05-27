import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminDataTableColumn } from '../AdminDataTable';
import { ResponsiveDataTable } from '../ResponsiveDataTable';

/**
 * Tests `ResponsiveDataTable` (Epic RESPONSIVE).
 *
 * Couvre :
 *   - Render desktop : table HTML classique presente (delegue a
 *     `AdminDataTable`), masquee `md:hidden` sur mobile.
 *   - Render mobile : stack de Cards visibles avec label/value, masquees
 *     `hidden md:block` sur desktop.
 *   - Empty state : deux empty states (desktop et mobile) rendus pour
 *     que le user voie le placeholder quelle que soit la breakpoint.
 *   - Column.render : fallback automatique sur la valeur primitive.
 *
 * Approche : on rend en `renderToStaticMarkup` et on verifie la presence
 * des classes Tailwind (`hidden md:block`, `md:hidden`) qui pilotent la
 * visibilite responsive sans JS. Pas besoin de `matchMedia` ni de
 * react-dom/client puisque le toggle est CSS pur.
 */

interface DemoRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

const ROWS: readonly DemoRow[] = [
  { id: 'r1', name: 'Alice', role: 'ADMIN' },
  { id: 'r2', name: 'Bob', role: 'SALARIE' },
];

const COLUMNS: readonly AdminDataTableColumn<DemoRow>[] = [
  { key: 'name', label: 'Nom' },
  { key: 'role', label: 'Role' },
];

describe('[ResponsiveDataTable]', () => {
  it('should render both desktop table and mobile cards for non-empty rows', () => {
    const html = renderToStaticMarkup(
      <ResponsiveDataTable
        name="demo"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={(row) => row.id}
        caption="Demo"
      />
    );

    // Desktop : table existante (delegate AdminDataTable)
    expect(html).toContain('data-testid="admin-table-demo"');
    expect(html).toContain('hidden md:block');

    // Mobile : stack de cards
    expect(html).toContain('data-testid="responsive-table-demo-cards"');
    expect(html).toContain('data-testid="responsive-table-demo-card-r1"');
    expect(html).toContain('data-testid="responsive-table-demo-card-r2"');
    expect(html).toContain('md:hidden');

    // Les valeurs sont visibles sur mobile aussi (label + value)
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Nom');
    expect(html).toContain('Role');
  });

  it('should render empty state for both breakpoints when no rows', () => {
    const html = renderToStaticMarkup(
      <ResponsiveDataTable
        name="demo"
        columns={COLUMNS}
        rows={[]}
        getRowId={(row) => row.id}
        empty="Liste vide"
      />
    );

    // Desktop empty state (de AdminDataTable)
    expect(html).toContain('data-testid="admin-table-demo-empty"');
    expect(html).toContain('hidden md:block');

    // Mobile empty state propre
    expect(html).toContain('data-testid="responsive-table-demo-empty"');
    expect(html).toContain('Liste vide');
  });

  it('should support custom render function on a column', () => {
    const columns: readonly AdminDataTableColumn<DemoRow>[] = [
      { key: 'name', label: 'Nom' },
      {
        key: 'role',
        label: 'Role',
        render: (row) => (
          <strong data-testid={`role-${row.id}`}>{row.role}</strong>
        ),
      },
    ];

    const html = renderToStaticMarkup(
      <ResponsiveDataTable
        name="demo"
        columns={columns}
        rows={ROWS}
        getRowId={(row) => row.id}
      />
    );

    // Custom render present a la fois sur desktop et mobile
    expect(html).toContain('data-testid="role-r1"');
    expect(html).toContain('data-testid="role-r2"');
  });
});
