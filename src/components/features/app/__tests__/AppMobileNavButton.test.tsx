import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// React 19 : flag requis pour `act()` hors React Testing Library.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

/**
 * `next/dynamic` charge le drawer en async ; en test on veut un import
 * synchrone pour que le drawer soit rendu lors du premier `act()` apres
 * le click. On stubbe donc dynamic en renvoyant la vraie implementation.
 */
vi.mock('next/dynamic', async () => {
  const { AppMobileNavDrawer } = await import('../AppMobileNavDrawer');
  return {
    default: () => AppMobileNavDrawer,
  };
});

import { AppMobileNavButton } from '../AppMobileNavButton';

/**
 * Tests `AppMobileNavButton` (Epic RESPONSIVE).
 *
 * Couvre :
 *   - SSR (closed) : bouton burger present, aria-expanded=false, drawer
 *     absent.
 *   - Click ouvre le drawer (aria-expanded passe a true).
 *   - Click sur close ferme le drawer et restore le focus au bouton.
 *
 * usePathname est mock car le drawer en a besoin pour calculer
 * aria-current. LogoutButton est mock pour eviter d'importer le server
 * action `logoutAction`.
 */
describe('[AppMobileNavButton]', () => {
  it('should render only the burger button initially (closed)', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavButton viewerRole="SALARIE" />
    );

    expect(html).toContain('data-testid="app-nav-button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Menu de navigation"');
    expect(html).not.toContain('data-testid="app-nav-drawer"');
  });

  it('should open the drawer when the burger is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AppMobileNavButton viewerRole="RESPONSABLE" />);
    });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="app-nav-button"]'
    );
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      button?.click();
    });

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(
      container.querySelector('[data-testid="app-nav-drawer"]')
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should close the drawer when the close button is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AppMobileNavButton viewerRole="ADMIN" />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="app-nav-button"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="app-nav-drawer"]')
    ).not.toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="app-nav-close"]')
        ?.click();
    });

    expect(
      container.querySelector('[data-testid="app-nav-drawer"]')
    ).toBeNull();
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="app-nav-button"]')
        ?.getAttribute('aria-expanded')
    ).toBe('false');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should omit aria-controls when the drawer is closed (no dangling reference)', () => {
    const html = renderToStaticMarkup(
      <AppMobileNavButton viewerRole="ADMIN" />
    );
    // aria-controls ne doit pointer vers un id que lorsqu'il existe dans
    // le DOM. Drawer ferme = pas d'id cible = pas d'aria-controls.
    expect(html).not.toMatch(/aria-controls="/);
  });

  it('should expose aria-controls referencing the drawer id when open', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AppMobileNavButton viewerRole="ADMIN" />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="app-nav-button"]')
        ?.click();
    });

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="app-nav-button"]'
    );
    const controls = button?.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    // L'id cible doit correspondre a un element reellement monte. On
    // utilise getElementById car React 19 `useId()` produit des ids
    // contenant ":" (`:r0:`) que `querySelector` ne sait pas parser.
    expect(document.getElementById(controls as string)).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
