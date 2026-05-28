import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/releves'),
}));

vi.mock('@/components/features/auth/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" data-testid="logout-button">
      Se deconnecter
    </button>
  ),
}));

import { AppSidebar } from '../AppSidebar';

/**
 * Tests `AppSidebar` (refactor/unified-sidebar).
 *
 * La sidebar est desormais UNIFIEE et organisee en groupes
 * (`Operations`, `Administration`). Couvre :
 *   - SALARIE : seul le groupe Operations (dashboard + alertes), pas
 *     d'Administration.
 *   - RESPONSABLE : Operations a 4 items, pas d'Administration.
 *   - ADMIN : Operations + Administration (users, boutiques, equipements,
 *     audit) + titres de groupe.
 *   - Plus de lien de bascule "Espace admin" (slug `admin`).
 *   - data-testid `app-sidebar`, `app-sidebar-group-{slug}`,
 *     `app-sidebar-link-{slug}`.
 *   - LogoutButton present en pied + sidebar fixe `hidden lg:flex` w-64.
 *
 * `usePathname` est mock car `AppSidebarLink` est un Client Component
 * importe transitivement par la sidebar.
 */
describe('[AppSidebar]', () => {
  it('should render only the Operations group (dashboard + alertes) for SALARIE', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="SALARIE" />);

    expect(html).toContain('data-testid="app-sidebar-group-operations"');
    expect(html).not.toContain(
      'data-testid="app-sidebar-group-administration"'
    );
    expect(html).toContain('data-testid="app-sidebar-link-dashboard"');
    expect(html).toContain('data-testid="app-sidebar-link-alertes"');
    expect(html).not.toContain(
      'data-testid="app-sidebar-link-releves-listing"'
    );
    expect(html).not.toContain(
      'data-testid="app-sidebar-link-registre-consolide"'
    );
    expect(html).not.toContain('data-testid="app-sidebar-link-admin"');
  });

  it('should render the 4 Operations items for RESPONSABLE without the Administration group', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="RESPONSABLE" />);

    expect(html).toContain('data-testid="app-sidebar-group-operations"');
    expect(html).not.toContain(
      'data-testid="app-sidebar-group-administration"'
    );
    expect(html).toContain('data-testid="app-sidebar-link-dashboard"');
    expect(html).toContain('data-testid="app-sidebar-link-releves-listing"');
    expect(html).toContain('data-testid="app-sidebar-link-alertes"');
    expect(html).toContain('data-testid="app-sidebar-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-sidebar-link-admin-users"');
  });

  it('should render both Operations and Administration groups for ADMIN', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    expect(html).toContain('data-testid="app-sidebar-group-operations"');
    expect(html).toContain('data-testid="app-sidebar-group-administration"');
    expect(html).toContain('Operations');
    expect(html).toContain('Administration');
    expect(html).toContain('data-testid="app-sidebar-link-admin-users"');
    expect(html).toContain('data-testid="app-sidebar-link-admin-boutiques"');
    expect(html).toContain('data-testid="app-sidebar-link-admin-equipements"');
    expect(html).toContain('data-testid="app-sidebar-link-admin-audit"');
  });

  it('should NOT render the legacy "Espace admin" toggle link', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    expect(html).not.toContain('data-testid="app-sidebar-link-admin"');
    expect(html).not.toContain('Espace admin');
  });

  it('should expose the root sidebar testid + aria-label', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    expect(html).toContain('data-testid="app-sidebar"');
    expect(html).toContain('aria-label="Navigation principale"');
  });

  it('should mount the LogoutButton at the bottom of the sidebar', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="SALARIE" />);

    expect(html).toContain('data-testid="logout-button"');
  });

  it('should be hidden on mobile and shown only on lg via `hidden lg:flex`', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    expect(html).toContain('hidden lg:flex');
  });

  it('should be fixed on the left edge with width w-64', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    expect(html).toContain('fixed inset-y-0 left-0');
    expect(html).toContain('w-64');
  });

  it('should display the Maison Givre wordmark and the HACCP eyebrow', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="SALARIE" />);

    expect(html).toContain('Maison Givre');
    expect(html).toContain('HACCP');
  });
});
