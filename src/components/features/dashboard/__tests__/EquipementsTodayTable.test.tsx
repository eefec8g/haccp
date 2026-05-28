import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Creneau } from '@prisma/client';
import type {
  EquipementsTodayCell,
  EquipementsTodayRow,
} from '@/types/dashboard';

// `next/link` est stubbe pour produire un <a> SSR-friendly verifiable
// par `renderToStaticMarkup` (pas de runtime client requis).
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
    'aria-label': ariaLabel,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
    readonly 'aria-label'?: string;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestid}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

import { EquipementsTodayTable } from '../EquipementsTodayTable';

function buildCell(
  overrides: Partial<EquipementsTodayCell> = {}
): EquipementsTodayCell {
  return {
    statut: overrides.statut ?? 'MANQUANT',
    temperature: overrides.temperature ?? null,
    releveId: overrides.releveId ?? null,
    creneau: overrides.creneau ?? 'MATIN',
  };
}

function buildRow(
  overrides: Partial<EquipementsTodayRow> = {}
): EquipementsTodayRow {
  const cells: Record<Creneau, EquipementsTodayCell> = overrides.cells ?? {
    MATIN: buildCell({ creneau: 'MATIN' }),
    MIDI: buildCell({ creneau: 'MIDI' }),
    SOIR: buildCell({ creneau: 'SOIR' }),
  };
  return {
    equipementId: overrides.equipementId ?? 'eq-1',
    equipementNom: overrides.equipementNom ?? 'Congelateur A',
    boutiqueId: overrides.boutiqueId ?? 'b-1',
    boutiqueNom: overrides.boutiqueNom ?? 'MG Paris 11',
    seuilMin: overrides.seuilMin ?? -25,
    seuilMax: overrides.seuilMax ?? -18,
    cells,
  };
}

describe('[Dashboard] EquipementsTodayTable', () => {
  it('should render the empty state when there is no row', () => {
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={[]} />);
    expect(html).toContain('data-testid="equipements-today-table-empty"');
    expect(html).toContain('Aucun equipement actif.');
    expect(html).not.toContain('<table');
  });

  it('should render one row per equipement with a cell per creneau', () => {
    const rows = [
      buildRow({ equipementId: 'eq-1', equipementNom: 'Congelateur A' }),
      buildRow({ equipementId: 'eq-2', equipementNom: 'Vitrine B' }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain('<table');
    expect(html).toContain('data-testid="equipements-today-table-row-eq-1"');
    expect(html).toContain('data-testid="equipements-today-table-row-eq-2"');
    expect(html).toContain(
      'data-testid="equipements-today-table-cell-eq-1-MATIN"'
    );
    expect(html).toContain(
      'data-testid="equipements-today-table-cell-eq-1-MIDI"'
    );
    expect(html).toContain(
      'data-testid="equipements-today-table-cell-eq-1-SOIR"'
    );
    expect(html).toContain('Congelateur A');
    expect(html).toContain('Vitrine B');
  });

  it('should render a Saisir link pointing to the correct URL for MANQUANT cells', () => {
    const rows = [
      buildRow({
        equipementId: 'eq-9',
        cells: {
          MATIN: buildCell({ creneau: 'MATIN', statut: 'MANQUANT' }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain(
      'data-testid="equipements-today-table-saisir-eq-9-MATIN"'
    );
    expect(html).toContain('href="/releves/saisie/eq-9/MATIN"');
    expect(html).toContain('href="/releves/saisie/eq-9/MIDI"');
    expect(html).toContain('href="/releves/saisie/eq-9/SOIR"');
    expect(html).toContain(
      'aria-label="Saisir le releve Matin de Congelateur A"'
    );
  });

  it('should render the temperature badge for SAISI cells (no Saisir link)', () => {
    const rows = [
      buildRow({
        equipementId: 'eq-3',
        cells: {
          MATIN: buildCell({
            creneau: 'MATIN',
            statut: 'SAISI',
            temperature: -20,
            releveId: 'r-1',
          }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain('-20.0 degC');
    expect(html).not.toContain(
      'data-testid="equipements-today-table-saisir-eq-3-MATIN"'
    );
  });

  it('should render an ALERTE badge variant when the cell is ALERTE', () => {
    const rows = [
      buildRow({
        equipementId: 'eq-4',
        cells: {
          MATIN: buildCell({
            creneau: 'MATIN',
            statut: 'ALERTE',
            temperature: -10,
            releveId: 'r-2',
          }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain('-10.0 degC');
    // ALERTE -> badge avec bg-mg-or (charte alerte)
    expect(html).toContain('bg-mg-or');
    expect(html).toContain('Matin - alerte');
  });

  it('should use a custom testId when provided', () => {
    const rows = [buildRow({ equipementId: 'eq-5' })];
    const html = renderToStaticMarkup(
      <EquipementsTodayTable rows={rows} testId="custom-board" />
    );
    expect(html).toContain('data-testid="custom-board"');
    expect(html).toContain('data-testid="custom-board-row-eq-5"');
    expect(html).toContain('data-testid="custom-board-saisir-eq-5-MATIN"');
  });
});
