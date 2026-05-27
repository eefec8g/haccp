import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KpisGrid } from '../KpisGrid';

/**
 * Tests KpisGrid (Epic DASHBOARD socle).
 *
 * - rend une <section> avec aria-label (defaut + custom),
 * - propage les enfants tels quels,
 * - applique les classes grid responsive.
 */

describe('[Dashboard] KpisGrid', () => {
  it('should render a section with default aria-label', () => {
    const html = renderToStaticMarkup(
      <KpisGrid>
        <span data-testid="child">Item</span>
      </KpisGrid>
    );
    expect(html).toContain('<section');
    expect(html).toContain('aria-label="Indicateurs cles"');
    expect(html).toContain('data-testid="kpis-grid"');
  });

  it('should override aria-label and testId when provided', () => {
    const html = renderToStaticMarkup(
      <KpisGrid ariaLabel="Stats admin" testId="grid-admin">
        <span>Item</span>
      </KpisGrid>
    );
    expect(html).toContain('aria-label="Stats admin"');
    expect(html).toContain('data-testid="grid-admin"');
  });

  it('should render the children inside the grid', () => {
    const html = renderToStaticMarkup(
      <KpisGrid>
        <span data-testid="first">A</span>
        <span data-testid="second">B</span>
      </KpisGrid>
    );
    expect(html).toContain('data-testid="first"');
    expect(html).toContain('data-testid="second"');
  });

  it('should apply responsive grid classes (1 / 2 / 4 columns)', () => {
    const html = renderToStaticMarkup(
      <KpisGrid>
        <span>Item</span>
      </KpisGrid>
    );
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('md:grid-cols-4');
  });
});
