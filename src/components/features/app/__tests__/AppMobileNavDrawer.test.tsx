import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/alertes'),
}));

vi.mock('@/components/features/auth/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" data-testid="logout-button">
      Se deconnecter
    </button>
  ),
}));

import { AppMobileNavDrawer } from '../AppMobileNavDrawer';

/**
 * Tests `AppMobileNavDrawer` (refactor/unified-sidebar).
 *
 * Le drawer reflete la sidebar UNIFIEE : memes groupes (`Operations`,
 * `Administration`) filtres par role. Cas couverts :
 *   - SALARIE : groupe Operations (dashboard + alertes), pas
 *     d'Administration ni de lien "Espace admin".
 *   - RESPONSABLE : Operations a 4 items, pas d'Administration.
 *   - ADMIN : Operations + Administration (users, boutiques, equipements,
 *     audit).
 *   - data-testid de groupe + aria-current pour le pathname actif.
 *   - Escape / click lien / click close ferment le drawer (onClose).
 *   - aria-modal + role dialog + aria-labelledby (a11y).
 */
describe('[AppMobileNavDrawer]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show only the Operations group for a SALARIE role', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="SALARIE"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    expect(html).toContain('data-testid="app-nav-group-operations"');
    expect(html).not.toContain('data-testid="app-nav-group-administration"');
    expect(html).toContain('data-testid="app-nav-link-dashboard"');
    expect(html).toContain('data-testid="app-nav-link-alertes"');
    expect(html).not.toContain('data-testid="app-nav-link-releves-listing"');
    expect(html).not.toContain('data-testid="app-nav-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-nav-link-admin"');
  });

  it('should show the 4 Operations items for RESPONSABLE without Administration', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="RESPONSABLE"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    expect(html).toContain('data-testid="app-nav-group-operations"');
    expect(html).not.toContain('data-testid="app-nav-group-administration"');
    expect(html).toContain('data-testid="app-nav-link-dashboard"');
    expect(html).toContain('data-testid="app-nav-link-releves-listing"');
    expect(html).toContain('data-testid="app-nav-link-alertes"');
    expect(html).toContain('data-testid="app-nav-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-nav-link-admin-users"');
  });

  it('should show both groups including Administration for ADMIN role', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="ADMIN"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    expect(html).toContain('data-testid="app-nav-group-operations"');
    expect(html).toContain('data-testid="app-nav-group-administration"');
    expect(html).toContain('data-testid="app-nav-link-admin-users"');
    expect(html).toContain('data-testid="app-nav-link-admin-boutiques"');
    expect(html).toContain('data-testid="app-nav-link-admin-equipements"');
    expect(html).toContain('data-testid="app-nav-link-admin-audit"');
  });

  it('should expose dialog role + aria-modal + aria-labelledby', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="ADMIN"
        onClose={() => undefined}
        labelledById="my-title"
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="my-title"');
    expect(html).toContain('id="my-title"');
  });

  it('should mark the current pathname item with aria-current=page', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="ADMIN"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    // pathname mocked to /alertes -> "Alertes" item must be aria-current.
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*data-testid="app-nav-link-alertes"/
    );
  });

  it('should call onClose when a nav link is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <AppMobileNavDrawer
          viewerRole="ADMIN"
          onClose={onClose}
          labelledById="title"
        />
      );
    });

    act(() => {
      container
        .querySelector<HTMLAnchorElement>(
          '[data-testid="app-nav-link-dashboard"]'
        )
        ?.click();
    });

    expect(onClose).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should call onClose when Escape is pressed', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <AppMobileNavDrawer
          viewerRole="ADMIN"
          onClose={onClose}
          labelledById="title"
        />
      );
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(onClose).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should call onClose when the close button is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <AppMobileNavDrawer
          viewerRole="ADMIN"
          onClose={onClose}
          labelledById="title"
        />
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="app-nav-close"]')
        ?.click();
    });

    expect(onClose).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
