import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// React 19 : flag requis pour `act()` hors React Testing Library.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin/users'),
}));

import { AdminMobileMenu } from '../AdminMobileMenu';
import { ADMIN_NAV_ITEMS } from '@/lib/constants/admin-nav';

/**
 * Tests `AdminMobileMenu` (Epic RESPONSIVE Phase 3).
 *
 * Couvre :
 *   - SSR initial (closed) : burger rendu, aria-expanded=false,
 *     aria-controls absent tant que le panneau n'existe pas.
 *   - Toggle open via DOM reel (createRoot) : panneau visible avec
 *     role=dialog + aria-modal=true + aria-labelledby + items.
 *   - aria-current sur l'item correspondant au pathname.
 *   - Close on link click (UX : l'item agit comme un trigger de
 *     navigation, on ferme le panneau).
 *   - Escape ferme le panneau (via useFocusTrap).
 *   - Focus restore : le bouton burger reprend le focus au close.
 *   - Scroll lock body pendant l'ouverture (via useFocusTrap).
 */
describe('[AdminMobileMenu]', () => {
  afterEach(() => {
    // Defense en profondeur : un test qui crashe ne doit pas laisser le
    // scroll lock global au profil suivant.
    document.body.style.overflow = '';
  });

  it('should render only the burger button initially (closed)', () => {
    const html = renderToStaticMarkup(<AdminMobileMenu />);

    expect(html).toContain('data-testid="admin-mobile-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Ouvrir le menu"');
    expect(html).not.toContain('data-testid="admin-mobile-menu"');
    // aria-controls doit etre absent quand le panneau n'est pas monte
    // (eviter un pointeur vers un id inexistant).
    expect(html).not.toMatch(/aria-controls="/);
  });

  it('should open the panel with role=dialog, aria-modal and aria-labelledby', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-mobile-toggle"]'
    );
    expect(toggle).not.toBeNull();

    act(() => {
      toggle?.click();
    });

    const panel = container.querySelector<HTMLElement>(
      '[data-testid="admin-mobile-menu"]'
    );
    expect(panel).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    const labelledBy = panel?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    // Le wordmark "Maison Givre" doit porter l'id cible. On utilise
    // getElementById car React 19 `useId()` produit des ids contenant
    // ":" (`:r0:`), invalides comme selecteurs CSS bruts.
    expect(
      document.getElementById(labelledBy as string)?.textContent
    ).toContain('Maison Givre');

    for (const item of ADMIN_NAV_ITEMS) {
      expect(panel?.textContent).toContain(item.label);
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should expose aria-controls pointing to the panel id when open', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-toggle"]')
        ?.click();
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-mobile-toggle"]'
    );
    const panel = container.querySelector<HTMLElement>(
      '[data-testid="admin-mobile-menu"]'
    );
    const controls = toggle?.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    // React 19 `useId()` produit des ids contenant ":", incompatibles
    // avec `querySelector`. On compare directement les attributs.
    expect(panel?.getAttribute('id')).toBe(controls);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should mark the current pathname item as aria-current=page', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-toggle"]')
        ?.click();
    });

    // Le composant aligne sa logique sur `AdminSidebarLink` :
    // `pathname.startsWith(href + '/')` rend "Tableau de bord" (/admin)
    // egalement actif quand on est sur une sous-section. On verifie donc
    // que l'item cible figure parmi les items marques `aria-current="page"`
    // (et non qu'il est le seul).
    const currents = container.querySelectorAll('[aria-current="page"]');
    const labels = Array.from(currents).map((el) => el.textContent ?? '');
    expect(labels.some((label) => label.includes('Utilisateurs'))).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should close the panel when a nav link is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-toggle"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="admin-mobile-menu"]')
    ).not.toBeNull();

    const firstItem = ADMIN_NAV_ITEMS[0];
    if (!firstItem) {
      throw new Error('ADMIN_NAV_ITEMS must contain at least one item');
    }
    const firstLink = container.querySelector<HTMLAnchorElement>(
      `[data-testid="admin-mobile-link-${firstItem.label.toLowerCase()}"]`
    );
    act(() => {
      firstLink?.click();
    });

    expect(
      container.querySelector('[data-testid="admin-mobile-menu"]')
    ).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should close the panel when Escape is pressed (useFocusTrap)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-toggle"]')
        ?.click();
    });
    expect(
      container.querySelector('[data-testid="admin-mobile-menu"]')
    ).not.toBeNull();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(
      container.querySelector('[data-testid="admin-mobile-menu"]')
    ).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should restore focus to the toggle button when the panel closes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="admin-mobile-toggle"]'
    );
    act(() => {
      toggle?.click();
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-close"]')
        ?.click();
    });

    // requestAnimationFrame est utilise pour le focus restore : on
    // attend un tick pour laisser le navigateur poser le focus.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    expect(document.activeElement).toBe(toggle);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('should lock body scroll while the panel is open', () => {
    document.body.style.overflow = 'auto';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AdminMobileMenu />);
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-toggle"]')
        ?.click();
    });

    expect(document.body.style.overflow).toBe('hidden');

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="admin-mobile-close"]')
        ?.click();
    });

    expect(document.body.style.overflow).toBe('auto');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
