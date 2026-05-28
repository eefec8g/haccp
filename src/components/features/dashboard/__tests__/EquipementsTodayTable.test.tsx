import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Creneau } from '@prisma/client';
import type {
  EquipementsTodayCell,
  EquipementsTodayRow,
} from '@/types/dashboard';

import { EquipementsTodayTable } from '../EquipementsTodayTable';

/**
 * Tests EquipementsTodayTable.
 *
 * Depuis feat/tournee-guidee, le tableau est READ-ONLY : plus de
 * boutons "Saisir" inline. Les cellules manquantes affichent "Non saisi"
 * en italique. La saisie passe par la tournee guidee (TourneeButtons).
 */

function buildCell(
  overrides: Partial<EquipementsTodayCell> = {}
): EquipementsTodayCell {
  return {
    statut: overrides.statut ?? 'MANQUANT',
    temperature: overrides.temperature ?? null,
    releveId: overrides.releveId ?? null,
    creneau: overrides.creneau ?? 'MATIN',
    saisiAt: overrides.saisiAt ?? null,
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

  it('should render a "Non saisi" placeholder for MANQUANT cells (no Saisir links)', () => {
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
    expect(html).not.toContain('data-testid="equipements-today-table-saisir');
    expect(html).not.toContain('href="/releves/saisie/');
    expect(html).toContain('Non saisi');
    expect(html).toContain('Matin - non saisi');
  });

  it('should render the temperature badge and the saisie time for SAISI cells', () => {
    // 06:42 UTC = 08:42 Paris en mai (UTC+2)
    const saisiAt = new Date('2026-05-26T06:42:00.000Z');
    const rows = [
      buildRow({
        equipementId: 'eq-3',
        cells: {
          MATIN: buildCell({
            creneau: 'MATIN',
            statut: 'SAISI',
            temperature: -20,
            releveId: 'r-1',
            saisiAt,
          }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain('-20.0 degC');
    expect(html).toContain(
      'data-testid="equipements-today-table-cell-eq-3-MATIN-time"'
    );
    expect(html).toContain('08:42');
  });

  it('should not render a time element for MANQUANT cells', () => {
    const rows = [
      buildRow({
        equipementId: 'eq-empty',
        cells: {
          MATIN: buildCell({ creneau: 'MATIN', statut: 'MANQUANT' }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).not.toContain(
      'data-testid="equipements-today-table-cell-eq-empty-MATIN-time"'
    );
  });

  it('should render an ALERTE badge variant and the saisie time when the cell is ALERTE', () => {
    // 11:05 UTC = 13:05 Paris en mai
    const saisiAt = new Date('2026-05-26T11:05:00.000Z');
    const rows = [
      buildRow({
        equipementId: 'eq-4',
        cells: {
          MATIN: buildCell({
            creneau: 'MATIN',
            statut: 'ALERTE',
            temperature: -10,
            releveId: 'r-2',
            saisiAt,
          }),
          MIDI: buildCell({ creneau: 'MIDI', statut: 'MANQUANT' }),
          SOIR: buildCell({ creneau: 'SOIR', statut: 'MANQUANT' }),
        },
      }),
    ];
    const html = renderToStaticMarkup(<EquipementsTodayTable rows={rows} />);
    expect(html).toContain('-10.0 degC');
    expect(html).toContain('bg-mg-or');
    expect(html).toContain('Matin - alerte');
    expect(html).toContain(
      'data-testid="equipements-today-table-cell-eq-4-MATIN-time"'
    );
    expect(html).toContain('13:05');
  });

  it('should use a custom testId when provided', () => {
    const rows = [buildRow({ equipementId: 'eq-5' })];
    const html = renderToStaticMarkup(
      <EquipementsTodayTable rows={rows} testId="custom-board" />
    );
    expect(html).toContain('data-testid="custom-board"');
    expect(html).toContain('data-testid="custom-board-row-eq-5"');
  });
});
