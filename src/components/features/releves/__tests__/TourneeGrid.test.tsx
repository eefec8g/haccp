import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TourneeEquipementCard } from '@/types/releve';
import { TourneeGrid } from '../TourneeGrid';

/**
 * Tests TourneeGrid (US-REL-001) :
 *   - empty state si liste vide
 *   - render N cards
 *   - propagation correcte du currentCreneau aux cartes
 *
 * Server Component pur : on rend en static markup et on assert sur le
 * HTML genere (data-testid + ARIA). Pas de @testing-library requis.
 */

function buildCard(
  overrides: Partial<TourneeEquipementCard> = {}
): TourneeEquipementCard {
  return {
    equipementId: 'eq-1',
    equipementNom: 'Congelateur A',
    type: 'CONGELATEUR',
    seuilMin: -25,
    seuilMax: -18,
    boutiqueId: 'b-1',
    boutiqueNom: 'MG Paris 11',
    creneaux: [
      {
        creneau: 'MATIN',
        status: 'DONE',
        releveId: 'r-1',
        temperature: -20,
        alerte: false,
      },
      {
        creneau: 'MIDI',
        status: 'MISSING',
        releveId: null,
        temperature: null,
        alerte: false,
      },
      {
        creneau: 'SOIR',
        status: 'MISSING',
        releveId: null,
        temperature: null,
        alerte: false,
      },
    ],
    ...overrides,
  };
}

describe('[Releves] TourneeGrid', () => {
  it('should render empty state when no cards', () => {
    const html = renderToStaticMarkup(
      <TourneeGrid cards={[]} currentCreneau="MIDI" />
    );
    expect(html).toContain('data-testid="tournee-grid-empty"');
    expect(html).toContain(
      'Aucun equipement actif pour cette boutique aujourd&#x27;hui'
    );
    expect(html).not.toContain('data-testid="tournee-grid"');
  });

  it('should render one li per card when cards provided', () => {
    const cards = [
      buildCard({ equipementId: 'eq-1' }),
      buildCard({ equipementId: 'eq-2' }),
      buildCard({ equipementId: 'eq-3' }),
    ];
    const html = renderToStaticMarkup(
      <TourneeGrid cards={cards} currentCreneau="MIDI" />
    );
    expect(html).toContain('data-testid="tournee-grid"');
    expect(html).toContain('data-testid="tournee-card-eq-1"');
    expect(html).toContain('data-testid="tournee-card-eq-2"');
    expect(html).toContain('data-testid="tournee-card-eq-3"');
  });

  it('should propagate currentCreneau="MIDI" to display "Maintenant" on missing MIDI', () => {
    const cards = [buildCard()];
    const html = renderToStaticMarkup(
      <TourneeGrid cards={cards} currentCreneau="MIDI" />
    );
    expect(html).toContain('data-testid="tournee-creneau-eq-1-MIDI"');
    expect(html).toContain('Maintenant');
  });

  it('should not display "Maintenant" when currentCreneau is null (hors plages)', () => {
    const cards = [buildCard()];
    const html = renderToStaticMarkup(
      <TourneeGrid cards={cards} currentCreneau={null} />
    );
    expect(html).not.toContain('Maintenant');
  });

  it('should display the temperature on DONE creneaux', () => {
    const cards = [buildCard()];
    const html = renderToStaticMarkup(
      <TourneeGrid cards={cards} currentCreneau="MIDI" />
    );
    expect(html).toContain('-20.0 degC');
  });
});
