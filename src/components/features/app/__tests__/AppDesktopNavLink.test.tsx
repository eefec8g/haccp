import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/releves'),
}));

import { AppDesktopNavLink } from '../AppDesktopNavLink';

const usePathnameMock = vi.mocked(usePathname);

/**
 * Tests `AppDesktopNavLink` (Epic RESPONSIVE, fix/desktop-nav).
 *
 * Couvre :
 *   - `aria-current="page"` quand la route courante correspond exactement.
 *   - `aria-current="page"` quand la route courante est fille (prefix /).
 *   - Pas d'`aria-current` quand pathname different.
 *   - Classes actives (`text-mg-or border-b-2 border-mg-or`) quand actif.
 *   - Classes inactives (`text-mg-noir/70`) sinon.
 *   - `data-testid` propage tel quel (cle de selection du nav parent).
 */
describe('[AppDesktopNavLink]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark itself aria-current=page when pathname matches href exactly', () => {
    usePathnameMock.mockReturnValue('/alertes');
    const html = renderToStaticMarkup(
      <AppDesktopNavLink
        href={'/alertes' as Route}
        label="Alertes"
        testId="app-desktop-nav-link-alertes"
      />
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-mg-or');
    expect(html).toContain('border-b-2 border-mg-or');
  });

  it('should mark itself aria-current=page when pathname is a child route', () => {
    usePathnameMock.mockReturnValue('/releves/listing');
    const html = renderToStaticMarkup(
      <AppDesktopNavLink
        href={'/releves' as Route}
        label="Mes releves"
        testId="app-desktop-nav-link-releves"
      />
    );

    expect(html).toContain('aria-current="page"');
  });

  it('should NOT mark itself active when pathname differs', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    const html = renderToStaticMarkup(
      <AppDesktopNavLink
        href={'/alertes' as Route}
        label="Alertes"
        testId="app-desktop-nav-link-alertes"
      />
    );

    expect(html).not.toContain('aria-current="page"');
    expect(html).toContain('text-mg-noir/70');
    expect(html).not.toContain('border-b-2 border-mg-or');
  });

  it('should NOT mark itself active when pathname only shares a prefix without slash', () => {
    // /relevesXYZ ne doit PAS matcher /releves : on respecte la frontiere
    // de segment via `pathname.startsWith(`${href}/`)`.
    usePathnameMock.mockReturnValue('/releves-autre');
    const html = renderToStaticMarkup(
      <AppDesktopNavLink
        href={'/releves' as Route}
        label="Mes releves"
        testId="app-desktop-nav-link-releves"
      />
    );

    expect(html).not.toContain('aria-current="page"');
  });

  it('should expose the data-testid passed in props', () => {
    usePathnameMock.mockReturnValue('/');
    const html = renderToStaticMarkup(
      <AppDesktopNavLink
        href={'/exports' as Route}
        label="Exports CSV"
        testId="app-desktop-nav-link-exports"
      />
    );

    expect(html).toContain('data-testid="app-desktop-nav-link-exports"');
    expect(html).toContain('Exports CSV');
  });
});
