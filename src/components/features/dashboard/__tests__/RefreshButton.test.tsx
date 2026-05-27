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

import { RefreshButton } from '../RefreshButton';

// Les routes `/dashboard` / `/admin/dashboard` arrivent en Phase 2.
// On utilise `/alertes` (existante) pour rester compatible avec
// `typedRoutes: true` sans cast `as Route`.
describe('[Dashboard] RefreshButton', () => {
  it('should render an anchor with the provided href', () => {
    const html = renderToStaticMarkup(<RefreshButton href="/alertes" />);
    expect(html).toContain('<a ');
    expect(html).toContain('href="/alertes"');
  });

  it('should render the default label "Actualiser"', () => {
    const html = renderToStaticMarkup(<RefreshButton href="/alertes" />);
    expect(html).toContain('Actualiser');
  });

  it('should expose the default testid and aria-label', () => {
    const html = renderToStaticMarkup(<RefreshButton href="/alertes" />);
    expect(html).toContain('data-testid="refresh-button"');
    expect(html).toContain('aria-label="Actualiser"');
  });

  it('should override the label and testId when provided', () => {
    const html = renderToStaticMarkup(
      <RefreshButton
        href="/admin/users"
        label="Recharger"
        testId="refresh-admin"
      />
    );
    expect(html).toContain('Recharger');
    expect(html).toContain('data-testid="refresh-admin"');
    expect(html).toContain('aria-label="Recharger"');
  });
});
