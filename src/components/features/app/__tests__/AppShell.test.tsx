import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../AppMobileNavButton', () => ({
  AppMobileNavButton: ({ viewerRole }: { readonly viewerRole: string }) => (
    <button data-testid="app-nav-button" data-role={viewerRole} type="button">
      menu
    </button>
  ),
}));

import { AppShell } from '../AppShell';

/**
 * Tests `AppShell` (Epic RESPONSIVE).
 *
 * Vrai contrat du composant :
 *   - Render des enfants sans wrapper visuel (pour ne pas casser les
 *     pages a pleine largeur).
 *   - Render du FAB de navigation mobile (`AppMobileNavButton`) avec le
 *     role propage.
 *
 * On mock le FAB pour eviter d'embarquer la chaine client (`useId`,
 * `useState`) qui n'apporte rien ici : on teste le contrat structurel.
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

  it('should pass ADMIN role when viewer is admin', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toContain('data-role="ADMIN"');
  });
});
