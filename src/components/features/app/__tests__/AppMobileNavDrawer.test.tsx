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
import { APP_NAV_ITEMS } from '@/lib/constants/app-nav';

/**
 * Tests `AppMobileNavDrawer` (Epic RESPONSIVE).
 *
 * Cas couverts :
 *   - Filtrage par role : SALARIE voit "Mes releves" + "Alertes", pas
 *     "Tableau de bord" ni "Espace admin".
 *   - Filtrage par role : RESPONSABLE voit dashboard / exports / registre
 *     consolide mais pas l'espace admin.
 *   - Filtrage par role : ADMIN voit tous les items.
 *   - data-testid + aria-current pour le pathname actif.
 *   - Escape ferme le drawer (onClose appele).
 *   - Click sur un lien ferme le drawer (onClose appele).
 *   - aria-modal + role dialog + aria-labelledby (a11y).
 */
describe('[AppMobileNavDrawer]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show only SALARIE items for a SALARIE role', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="SALARIE"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    expect(html).toContain('data-testid="app-nav-link-releves"');
    expect(html).toContain('data-testid="app-nav-link-alertes"');
    expect(html).not.toContain('data-testid="app-nav-link-dashboard"');
    expect(html).not.toContain('data-testid="app-nav-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-nav-link-admin"');
    expect(html).not.toContain('data-testid="app-nav-link-releves-listing"');
  });

  it('should show RESPONSABLE items (dashboard, registre consolide unifie) without admin', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="RESPONSABLE"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    expect(html).toContain('data-testid="app-nav-link-releves"');
    expect(html).toContain('data-testid="app-nav-link-releves-listing"');
    expect(html).toContain('data-testid="app-nav-link-alertes"');
    expect(html).toContain('data-testid="app-nav-link-dashboard"');
    expect(html).toContain('data-testid="app-nav-link-registre-consolide"');
    expect(html).not.toContain('data-testid="app-nav-link-admin"');
  });

  it('should show all items including admin for ADMIN role', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavDrawer
        viewerRole="ADMIN"
        onClose={() => undefined}
        labelledById="title"
      />
    );

    for (const item of APP_NAV_ITEMS) {
      expect(html).toContain(`data-testid="app-nav-link-${item.slug}"`);
    }
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
    // React serialise les attributs dans l'ordre de leur declaration JSX,
    // ce qui place `aria-current` AVANT `data-testid`. On match donc le
    // bloc `<a ...>` contenant les deux attributs sans presumer de l'ordre.
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
          '[data-testid="app-nav-link-releves"]'
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
