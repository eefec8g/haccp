import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MissingReleveEntry } from '@/types/dashboard';
import { MissingReleveTable } from '../MissingReleveTable';

function buildEntry(
  overrides: Partial<MissingReleveEntry> = {}
): MissingReleveEntry {
  return {
    equipementId: overrides.equipementId ?? 'eq-1',
    equipementNom: overrides.equipementNom ?? 'Congelateur A',
    boutiqueId: overrides.boutiqueId ?? 'b-1',
    boutiqueNom: overrides.boutiqueNom ?? 'MG Paris 11',
    creneauxManquants: overrides.creneauxManquants ?? ['MIDI', 'SOIR'],
  };
}

describe('[Dashboard] MissingReleveTable', () => {
  it('should render the empty state when entries is empty', () => {
    const html = renderToStaticMarkup(<MissingReleveTable entries={[]} />);
    expect(html).toContain('data-testid="missing-releve-table-empty"');
    expect(html).toContain('Toutes les saisies sont a jour.');
    expect(html).not.toContain('<table');
  });

  it('should render a table row per missing entry', () => {
    const entries = [
      buildEntry({ equipementId: 'eq-1', equipementNom: 'Congelateur A' }),
      buildEntry({ equipementId: 'eq-2', equipementNom: 'Vitrine B' }),
    ];
    const html = renderToStaticMarkup(<MissingReleveTable entries={entries} />);
    expect(html).toContain('<table');
    expect(html).toContain('data-testid="missing-releve-table-row-eq-1"');
    expect(html).toContain('data-testid="missing-releve-table-row-eq-2"');
    expect(html).toContain('Congelateur A');
    expect(html).toContain('Vitrine B');
  });

  it('should expose a CreneauBadge per missing creneau', () => {
    const entries = [
      buildEntry({
        equipementId: 'eq-1',
        creneauxManquants: ['MATIN', 'MIDI', 'SOIR'],
      }),
    ];
    const html = renderToStaticMarkup(<MissingReleveTable entries={entries} />);
    expect(html).toContain('data-testid="missing-releve-table-eq-1-MATIN"');
    expect(html).toContain('data-testid="missing-releve-table-eq-1-MIDI"');
    expect(html).toContain('data-testid="missing-releve-table-eq-1-SOIR"');
  });

  it('should render boutique nom in the second column', () => {
    const entries = [buildEntry({ boutiqueNom: 'MG Lyon Bellecour' })];
    const html = renderToStaticMarkup(<MissingReleveTable entries={entries} />);
    expect(html).toContain('MG Lyon Bellecour');
  });

  it('should use a custom testId prefix when provided', () => {
    const html = renderToStaticMarkup(
      <MissingReleveTable
        entries={[buildEntry({ equipementId: 'eq-9' })]}
        testId="missing-custom"
      />
    );
    expect(html).toContain('data-testid="missing-custom"');
    expect(html).toContain('data-testid="missing-custom-row-eq-9"');
  });
});
