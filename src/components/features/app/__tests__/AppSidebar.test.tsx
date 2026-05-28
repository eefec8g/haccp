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
import { APP_NAV_ITEMS } from '@/lib/constants/app-nav';

/**
 * Tests `AppSidebar` (fix/app-sidebar + fix/csv-in-consolide).
 *
 * Couvre :
 *   - Filtrage par role : SALARIE voit 2 items (releves + alertes).
 *   - Filtrage par role : RESPONSABLE voit 5 items metier sans l'admin
 *     (releves, releves-listing, alertes, dashboard, exports unifies).
 *   - Filtrage par role : ADMIN voit tous les items.
 *   - data-testid `app-sidebar` + un testid par lien.
 *   - LogoutButton present en pied.
 *   - Sidebar fixe ancree a gauche : `hidden lg:flex`, `fixed inset-y-0
 *     left-0`, largeur `w-64`.
 *   - aria-label de navigation.
 *
 * `usePathname` est mock car `AppSidebarLink` est un Client Component
 * importe transitivement par la sidebar.
 */
describe('[AppSidebar]', () => {
  it('should render the SALARIE links (dashboard + releves + alertes)', () => {
    // feat/dashboard-as-home : /dashboard est accueil pour TOUS les roles.
    // La sidebar SALARIE expose donc dashboard + releves + alertes.
    const html = renderToStaticMarkup(<AppSidebar viewerRole="SALARIE" />);

    expect(html).toContain('data-testid="app-sidebar-link-dashboard"');
    expect(html).toContain('data-testid="app-sidebar-link-releves"');
    expect(html).toContain('data-testid="app-sidebar-link-alertes"');
    expect(html).not.toContain(
      'data-testid="app-sidebar-link-releves-listing"'
    );
    expect(html).not.toContain(
      'data-testid="app-sidebar-link-registre-consolide"'
    );
    expect(html).not.toContain('data-testid="app-sidebar-link-admin"');
  });

  it('should render 5 business links for RESPONSABLE without the admin link', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="RESPONSABLE" />);

    expect(html).toContain('data-testid="app-sidebar-link-releves"');
    expect(html).toContain('data-testid="app-sidebar-link-releves-listing"');
    expect(html).toContain('data-testid="app-sidebar-link-alertes"');
    expect(html).toContain('data-testid="app-sidebar-link-dashboard"');
    expect(html).toContain('data-testid="app-sidebar-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-sidebar-link-admin"');
  });

  it('should render every nav item including admin for ADMIN role', () => {
    const html = renderToStaticMarkup(<AppSidebar viewerRole="ADMIN" />);

    for (const item of APP_NAV_ITEMS) {
      expect(html).toContain(`data-testid="app-sidebar-link-${item.slug}"`);
    }
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
