import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/releves'),
}));

import { AppSidebarLink } from '../AppSidebarLink';

const usePathnameMock = vi.mocked(usePathname);

/**
 * Tests `AppSidebarLink` (fix/app-sidebar).
 *
 * Couvre :
 *   - `aria-current="page"` quand la route courante correspond exactement.
 *   - `aria-current="page"` quand la route courante est fille (prefix /).
 *   - Pas d'`aria-current` quand pathname different.
 *   - Pas d'`aria-current` quand le pathname partage seulement un prefixe
 *     sans frontiere de segment (`/relevesAutre` ne matche pas `/releves`).
 *   - Classes actives (`text-mg-or`) quand actif.
 *   - Classes inactives (`text-mg-ivoire/70`) sinon.
 *   - `data-testid` propage tel quel (cle de selection du nav parent).
 */
describe('[AppSidebarLink]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark itself aria-current=page when pathname matches href exactly', () => {
    usePathnameMock.mockReturnValue('/alertes');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/alertes' as Route}
        label="Alertes"
        testId="app-sidebar-link-alertes"
      />
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-mg-or');
  });

  it('should mark itself aria-current=page when pathname is a child route', () => {
    usePathnameMock.mockReturnValue('/releves/listing');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/releves' as Route}
        label="Mes releves"
        testId="app-sidebar-link-releves"
      />
    );

    expect(html).toContain('aria-current="page"');
  });

  it('should NOT mark itself active when pathname differs', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/alertes' as Route}
        label="Alertes"
        testId="app-sidebar-link-alertes"
      />
    );

    expect(html).not.toContain('aria-current="page"');
    expect(html).toContain('text-mg-ivoire/70');
  });

  it('should NOT mark itself active when pathname only shares a prefix without slash', () => {
    // /relevesAutre ne doit PAS matcher /releves : on respecte la
    // frontiere de segment via `pathname.startsWith(`${href}/`)`.
    usePathnameMock.mockReturnValue('/releves-autre');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/releves' as Route}
        label="Mes releves"
        testId="app-sidebar-link-releves"
      />
    );

    expect(html).not.toContain('aria-current="page"');
  });

  it('should expose the data-testid passed in props', () => {
    usePathnameMock.mockReturnValue('/');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/exports/registre-consolide' as Route}
        label="Exports"
        testId="app-sidebar-link-registre-consolide"
      />
    );

    expect(html).toContain('data-testid="app-sidebar-link-registre-consolide"');
    expect(html).toContain('Exports');
  });

  it('should respect WCAG touch target via `min-h-touch`', () => {
    usePathnameMock.mockReturnValue('/');
    const html = renderToStaticMarkup(
      <AppSidebarLink
        href={'/releves' as Route}
        label="Mes releves"
        testId="app-sidebar-link-releves"
      />
    );

    expect(html).toContain('min-h-touch');
  });
});
