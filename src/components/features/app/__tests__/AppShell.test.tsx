import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../AppMobileNavButton', () => ({
  AppMobileNavButton: ({ viewerRole }: { readonly viewerRole: string }) => (
    <button data-testid="app-nav-button" data-role={viewerRole} type="button">
      menu
    </button>
  ),
}));

vi.mock('../AppSidebar', () => ({
  AppSidebar: ({ viewerRole }: { readonly viewerRole: string }) => (
    <aside data-testid="app-sidebar" data-role={viewerRole}>
      sidebar
    </aside>
  ),
}));

import { AppShell } from '../AppShell';

/**
 * Tests `AppShell` (refactor/unified-sidebar).
 *
 * Le shell est desormais un Server Component sans gate : il rend la
 * sidebar UNIFIEE partout (y compris `/admin/*`), decale le contenu via
 * `lg:pl-64`, et monte le FAB mobile. Contrat verifie :
 *   - `AppSidebar` rendu avec le role propage.
 *   - `{children}` enveloppes dans un wrapper `lg:pl-64`.
 *   - `AppMobileNavButton` (FAB) monte en fin avec le role propage.
 *
 * On mock la sidebar + le FAB pour eviter d'embarquer leur chaine client
 * (`useId`, `useState`, `usePathname`) : on teste le contrat structurel.
 */
describe('[AppShell]', () => {
  it('should render the unified sidebar with the viewer role', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="SALARIE">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    expect(html).toMatch(
      /<aside[^>]*data-testid="app-sidebar"[^>]*data-role="SALARIE"/
    );
  });

  it('should wrap the children in a `lg:pl-64` offset', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="SALARIE">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    expect(html).toContain('lg:pl-64');
    expect(html).toContain('data-testid="page-main"');
    expect(html).toContain('contenu page');
  });

  it('should mount the mobile nav button with the viewer role', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="RESPONSABLE">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toContain('data-testid="app-nav-button"');
    expect(html).toContain('data-role="RESPONSABLE"');
  });

  it('should render the sidebar BEFORE the mobile FAB (FAB stays at the end as overlay)', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    const sidebarIndex = html.indexOf('data-testid="app-sidebar"');
    const fabIndex = html.indexOf('data-testid="app-nav-button"');
    expect(sidebarIndex).toBeGreaterThanOrEqual(0);
    expect(fabIndex).toBeGreaterThan(sidebarIndex);
  });

  it('should pass ADMIN role both to the sidebar and to the FAB', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toMatch(
      /<aside[^>]*data-testid="app-sidebar"[^>]*data-role="ADMIN"/
    );
    expect(html).toMatch(
      /<button[^>]*data-testid="app-nav-button"[^>]*data-role="ADMIN"/
    );
  });
});
