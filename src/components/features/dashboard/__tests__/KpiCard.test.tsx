import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

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

import { KpiCard } from '../KpiCard';

/**
 * Tests KpiCard (Epic DASHBOARD socle).
 *
 * - rendu titre + valeur + description,
 * - lien Link si `href` fourni, sinon article,
 * - data-testid personnalise propage sur le wrapper + suffixe -value.
 */

describe('[Dashboard] KpiCard', () => {
  it('should render the title and value', () => {
    const html = renderToStaticMarkup(
      <KpiCard title="Conformite jour" value="92%" />
    );
    expect(html).toContain('Conformite jour');
    expect(html).toContain('92%');
  });

  it('should render the description when provided', () => {
    const html = renderToStaticMarkup(
      <KpiCard
        title="Conformite jour"
        value={92}
        description="Sur 12 saisies attendues"
      />
    );
    expect(html).toContain('Sur 12 saisies attendues');
  });

  it('should wrap content in an anchor when href is provided', () => {
    const html = renderToStaticMarkup(
      <KpiCard title="Alertes ouvertes" value={3} href="/alertes" />
    );
    expect(html).toContain('<a ');
    expect(html).toContain('href="/alertes"');
  });

  it('should render an article when no href is provided', () => {
    const html = renderToStaticMarkup(<KpiCard title="Boutiques" value={2} />);
    expect(html).toContain('<article');
    expect(html).not.toContain('<a ');
  });

  it('should expose the testId and a value-suffixed testid', () => {
    const html = renderToStaticMarkup(
      <KpiCard title="Boutiques" value={2} testId="kpi-card-boutiques" />
    );
    expect(html).toContain('data-testid="kpi-card-boutiques"');
    expect(html).toContain('data-testid="kpi-card-boutiques-value"');
  });

  it('should expose an aria-label combining title and value', () => {
    const html = renderToStaticMarkup(
      <KpiCard title="Boutiques" value={2} description="2 actives" />
    );
    expect(html).toContain('aria-label="Boutiques : 2. 2 actives"');
  });
});
