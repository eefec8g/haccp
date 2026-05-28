import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../AppMobileNavButton', () => ({
  AppMobileNavButton: ({ viewerRole }: { readonly viewerRole: string }) => (
    <button data-testid="app-nav-button" data-role={viewerRole} type="button">
      menu
    </button>
  ),
}));

vi.mock('../AppShellClientGate', () => ({
  AppShellClientGate: ({
    viewerRole,
    children,
  }: {
    readonly viewerRole: string;
    readonly children: ReactNode;
  }) => (
    <div data-testid="app-shell-gate" data-role={viewerRole}>
      {children}
    </div>
  ),
}));

import { AppShell } from '../AppShell';

/**
 * Tests `AppShell` (fix/app-sidebar).
 *
 * Vrai contrat du composant :
 *   - Mount du `AppShellClientGate` (qui rend la sidebar desktop +
 *     wrapper `lg:pl-64` hors `/admin/*`) avec le role propage.
 *   - Render des enfants A L'INTERIEUR du gate (la sidebar doit
 *     accompagner les enfants pour partager le meme decalage).
 *   - Mount du FAB de navigation mobile (`AppMobileNavButton`) avec le
 *     role propage.
 *
 * On mock les deux boundaries pour eviter d'embarquer leur chaine client
 * (`useId`, `useState`, `usePathname`) qui n'apporte rien ici : on teste
 * le contrat structurel du shell.
 */
describe('[AppShell]', () => {
  it('should render the children inside the client gate', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="SALARIE">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    expect(html).toContain('data-testid="app-shell-gate"');
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

  it('should pass the viewer role to the client gate', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="RESPONSABLE">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toMatch(
      /<div[^>]*data-testid="app-shell-gate"[^>]*data-role="RESPONSABLE"/
    );
  });

  it('should render the gate BEFORE the mobile FAB (FAB stays at the end as overlay)', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <main data-testid="page-main">contenu page</main>
      </AppShell>
    );

    const gateIndex = html.indexOf('data-testid="app-shell-gate"');
    const fabIndex = html.indexOf('data-testid="app-nav-button"');
    expect(gateIndex).toBeGreaterThanOrEqual(0);
    expect(fabIndex).toBeGreaterThan(gateIndex);
  });

  it('should pass ADMIN role both to the gate and to the FAB', () => {
    const html = renderToStaticMarkup(
      <AppShell viewerRole="ADMIN">
        <div data-testid="child" />
      </AppShell>
    );

    expect(html).toMatch(
      /<div[^>]*data-testid="app-shell-gate"[^>]*data-role="ADMIN"/
    );
    expect(html).toMatch(
      /<button[^>]*data-testid="app-nav-button"[^>]*data-role="ADMIN"/
    );
  });
});
