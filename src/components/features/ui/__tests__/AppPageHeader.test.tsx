import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests AppPageHeader (composant partage Epic RELEVE+ALERTE).
 *
 * On mock `next/link` pour rendre un `<a>` simple : le SSR pur n'a
 * pas besoin du Router. La signature de la prop respectee assure que
 * les pages reelles utilisant le composant rendent bien un Link.
 */

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
  }) => (
    <a href={href} className={className} data-testid={dataTestid}>
      {children}
    </a>
  ),
}));

import { AppPageHeader } from '../AppPageHeader';

describe('[UI] AppPageHeader', () => {
  it('should render the title in an h1 element', () => {
    const html = renderToStaticMarkup(<AppPageHeader title="Mes releves" />);
    expect(html).toContain('<h1');
    expect(html).toContain('Mes releves');
  });

  it('should render the eyebrow when provided', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader title="Mes releves" eyebrow="Maison Givre" />
    );
    expect(html).toContain('Maison Givre');
  });

  it('should not render any eyebrow markup when eyebrow is omitted', () => {
    const html = renderToStaticMarkup(<AppPageHeader title="Mes releves" />);
    expect(html).not.toContain('tracking-[0.3em] text-mg-or');
  });

  it('should render the subtitle when provided', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader title="Mes releves" subtitle="Fenetre 7 jours" />
    );
    expect(html).toContain('Fenetre 7 jours');
  });

  it('should not render the subtitle paragraph when omitted', () => {
    const html = renderToStaticMarkup(<AppPageHeader title="Mes releves" />);
    expect(html).not.toContain('text-mg-noir/60');
  });

  it('should render the back link with provided href and default label', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader title="Mes releves" backHref="/releves" />
    );
    expect(html).toContain('href="/releves"');
    expect(html).toContain('Retour');
  });

  it('should render the back link with a custom backLabel', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader
        title="Mes releves"
        backHref="/releves"
        backLabel="Retour a la tournee"
      />
    );
    expect(html).toContain('Retour a la tournee');
  });

  it('should not render any anchor when no backHref is provided', () => {
    const html = renderToStaticMarkup(<AppPageHeader title="Mes releves" />);
    expect(html).not.toContain('<a ');
  });

  it('should expose the testId as data-testid on the header', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader title="Mes releves" testId="my-header" />
    );
    expect(html).toContain('data-testid="my-header"');
  });

  it('should expose the back link testId derived from testId', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader
        title="Mes releves"
        backHref="/releves"
        testId="my-header"
      />
    );
    expect(html).toContain('data-testid="my-header-back"');
  });

  it('should render children inside the actions slot', () => {
    const html = renderToStaticMarkup(
      <AppPageHeader title="Mes releves">
        <button type="button" data-testid="cta-button">
          + Nouveau
        </button>
      </AppPageHeader>
    );
    expect(html).toContain('data-testid="cta-button"');
    expect(html).toContain('+ Nouveau');
  });

  it('should always render the gold divider for visual identity', () => {
    const html = renderToStaticMarkup(<AppPageHeader title="Mes releves" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('bg-mg-or');
  });
});
