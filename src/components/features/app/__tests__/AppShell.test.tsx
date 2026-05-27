import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../AppMobileNavButton', () => ({
  AppMobileNavButton: ({ viewerRole }: { readonly viewerRole: string }) => (
    <button data-testid="app-nav-button" data-role={viewerRole} type="button">
      menu
    </button>
  ),
}));

vi.mock('../AppDesktopNav', () => ({
  AppDesktopNav: ({ viewerRole }: { readonly viewerRole: string }) => (
    <nav data-testid="app-desktop-nav" data-role={viewerRole}>
      desktop-nav
    </nav>
  ),
}));

import { AppShell } from '../AppShell';

/**
 * Tests `AppShell` (Epic RESPONSIVE).
 *
 * Vrai contrat du composant :
 *   - Render des enfants sans wrapper visuel (pour ne pas casser les
 *     pages a pleine largeur).
 *   - Render de la top nav desktop (`AppDesktopNav`) avec le role propage.
 *   - Render du FAB de navigation mobile (`AppMobileNavButton`) avec le
 *     role propage.
 *
 * On mock les deux navs pour eviter d'embarquer leur chaine client
 * (`useId`, `useState`, `usePathname`) qui n'apporte rien ici : on teste
 * le contrat structurel du shell.
 */
describe('[AppShell]', () => {
  it('should render the children inline (no wrapper that breaks pages)', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="SALARIE">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

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

  it('should mount the desktop nav with the viewer role', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="RESPONSABLE">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toContain('data-testid="app-desktop-nav"');
    expect(html).toMatch(
      /<nav[^>]*data-testid="app-desktop-nav"[^>]*data-role="RESPONSABLE"/
    );
  });

  it('should render the desktop nav BEFORE children (sticky at the top of the app)', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    const navIndex = html.indexOf('data-testid="app-desktop-nav"');
    const childIndex = html.indexOf('data-testid="page-main"');
    expect(navIndex).toBeGreaterThanOrEqual(0);
    expect(childIndex).toBeGreaterThan(navIndex);
  });

  it('should pass ADMIN role when viewer is admin', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toContain('data-role="ADMIN"');
  });
});
