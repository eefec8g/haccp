import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/releves'),
}));

import { AppDesktopNav } from '../AppDesktopNav';
import { APP_NAV_ITEMS } from '@/lib/constants/app-nav';

/**
 * Tests `AppDesktopNav` (Epic RESPONSIVE, fix/desktop-nav).
 *
 * Couvre :
 *   - Filtrage par role : SALARIE voit 2 items (releves + alertes).
 *   - Filtrage par role : RESPONSABLE voit 6 items metier (releves,
 *     listing, alertes, dashboard, exports, registre consolide) sans
 *     l'espace admin.
 *   - Filtrage par role : ADMIN voit tous les items.
 *   - Visibilite desktop-only via `hidden md:block`.
 *   - aria-label de navigation et data-testid root.
 *   - Sticky sous le header eventuel via `sticky top-0 z-40`.
 *
 * `usePathname` est mock car `AppDesktopNavLink` est un Client Component
 * importe transitivement par le nav.
 */
describe('[AppDesktopNav]', () => {
  it('should render exactly 2 items for SALARIE (releves + alertes)', () => {
    const html = renderToStaticMarkup(<AppDesktopNav viewerRole="SALARIE" />);

    expect(html).toContain('data-testid="app-desktop-nav-link-releves"');
    expect(html).toContain('data-testid="app-desktop-nav-link-alertes"');
    expect(html).not.toContain(
      'data-testid="app-desktop-nav-link-releves-listing"'
    );
    expect(html).not.toContain('data-testid="app-desktop-nav-link-dashboard"');
    expect(html).not.toContain('data-testid="app-desktop-nav-link-exports"');
    expect(html).not.toContain(
      'data-testid="app-desktop-nav-link-registre-consolide"'
    );
    expect(html).not.toContain('data-testid="app-desktop-nav-link-admin"');
  });

  it('should render 6 business items for RESPONSABLE without the admin link', () => {
    const html = renderToStaticMarkup(
      <AppDesktopNav viewerRole="RESPONSABLE" />
    );

    expect(html).toContain('data-testid="app-desktop-nav-link-releves"');
    expect(html).toContain(
      'data-testid="app-desktop-nav-link-releves-listing"'
    );
    expect(html).toContain('data-testid="app-desktop-nav-link-alertes"');
    expect(html).toContain('data-testid="app-desktop-nav-link-dashboard"');
    expect(html).toContain('data-testid="app-desktop-nav-link-exports"');
    expect(html).toContain(
      'data-testid="app-desktop-nav-link-registre-consolide"'
    );
    expect(html).not.toContain('data-testid="app-desktop-nav-link-admin"');
  });

  it('should render every nav item including admin for ADMIN role', () => {
    const html = renderToStaticMarkup(<AppDesktopNav viewerRole="ADMIN" />);

    for (const item of APP_NAV_ITEMS) {
      expect(html).toContain(`data-testid="app-desktop-nav-link-${item.slug}"`);
    }
  });

  it('should expose the root navigation testid + aria-label', () => {
    const html = renderToStaticMarkup(<AppDesktopNav viewerRole="ADMIN" />);

    expect(html).toContain('data-testid="app-desktop-nav"');
    expect(html).toContain('aria-label="Navigation principale"');
  });

  it('should stay hidden on mobile via `hidden md:block`', () => {
    const html = renderToStaticMarkup(<AppDesktopNav viewerRole="ADMIN" />);

    // Whole class string starts with "hidden md:block" so the FAB takes
    // over on mobile (md:hidden on FAB side).
    expect(html).toContain('hidden md:block');
  });

  it('should be sticky under any page chrome (top-0, z-40)', () => {
    const html = renderToStaticMarkup(<AppDesktopNav viewerRole="ADMIN" />);

    expect(html).toContain('sticky top-0');
    expect(html).toContain('z-40');
  });
});
