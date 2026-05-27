import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReleveListingStats } from '../ReleveListingStats';

/**
 * Tests `ReleveListingStats` (Epic LISTING Phase 2).
 *
 * 4 cards : Saisis, Alertes, Manquants, Annules. Test cases :
 *   - Render avec valeurs reelles + classes charte MG par statut.
 *   - Render avec zeros (cas listing vide).
 *   - a11y : role status + aria-live polite + aria-label par card.
 */

describe('[ReleveListingStats]', () => {
  it('should render the 4 stat cards with their values', () => {
    const html = renderToStaticMarkup(
      <ReleveListingStats
        stats={{
          totalSaisis: 123,
          totalAlertes: 4,
          totalManquants: 7,
          totalAnnules: 2,
        }}
      />
    );

    expect(html).toContain('data-testid="listing-stats"');
    expect(html).toContain('data-testid="listing-stats-saisis"');
    expect(html).toContain('data-testid="listing-stats-alertes"');
    expect(html).toContain('data-testid="listing-stats-manquants"');
    expect(html).toContain('data-testid="listing-stats-annules"');
    expect(html).toContain('123');
    expect(html).toContain('>4<');
    expect(html).toContain('>7<');
    expect(html).toContain('>2<');
  });

  it('should render zeros when listing is empty', () => {
    const html = renderToStaticMarkup(
      <ReleveListingStats
        stats={{
          totalSaisis: 0,
          totalAlertes: 0,
          totalManquants: 0,
          totalAnnules: 0,
        }}
      />
    );

    expect(html).toContain('data-testid="listing-stats-saisis-value"');
    expect(html).toContain('data-testid="listing-stats-alertes-value"');
    expect(html).toContain('data-testid="listing-stats-manquants-value"');
    expect(html).toContain('data-testid="listing-stats-annules-value"');
  });

  it('should expose role=status with aria-live polite for screen readers', () => {
    const html = renderToStaticMarkup(
      <ReleveListingStats
        stats={{
          totalSaisis: 1,
          totalAlertes: 0,
          totalManquants: 0,
          totalAnnules: 0,
        }}
      />
    );

    expect(html).toMatch(
      /role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/
    );
  });

  it('should compute aria-label per card with label + value', () => {
    const html = renderToStaticMarkup(
      <ReleveListingStats
        stats={{
          totalSaisis: 12,
          totalAlertes: 3,
          totalManquants: 0,
          totalAnnules: 1,
        }}
      />
    );

    expect(html).toContain('aria-label="Saisis : 12"');
    expect(html).toContain('aria-label="Alertes : 3"');
    expect(html).toContain('aria-label="Manquants : 0"');
    expect(html).toContain('aria-label="Annules : 1"');
  });

  it('should apply charte MG color classes per stat', () => {
    const html = renderToStaticMarkup(
      <ReleveListingStats
        stats={{
          totalSaisis: 0,
          totalAlertes: 0,
          totalManquants: 0,
          totalAnnules: 0,
        }}
      />
    );

    // React serialise les attributs dans l'ordre de declaration JSX :
    // `class` (de `className`) est rendu AVANT `data-testid` ici. On match
    // donc class -> testid.
    // Saisis: neutre noir (sans suffixe d'opacite).
    expect(html).toMatch(
      /class="[^"]*text-mg-noir"[^>]*data-testid="listing-stats-saisis-value"/
    );
    // Alertes: or.
    expect(html).toMatch(
      /class="[^"]*text-mg-or"[^>]*data-testid="listing-stats-alertes-value"/
    );
    // Manquants: noir/60.
    expect(html).toMatch(
      /class="[^"]*text-mg-noir\/60"[^>]*data-testid="listing-stats-manquants-value"/
    );
    // Annules: italic + noir/50.
    expect(html).toMatch(
      /class="[^"]*italic[^"]*text-mg-noir\/50"[^>]*data-testid="listing-stats-annules-value"/
    );
  });
});
