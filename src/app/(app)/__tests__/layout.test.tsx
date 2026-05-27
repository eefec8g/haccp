/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
  usePathname: vi.fn(() => '/releves'),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Eviter d'importer le client (`useId`, `useState`) dans le test SSR :
// on mocke le FAB pour s'assurer que le shell le rend bien.
vi.mock('@/components/features/app/AppMobileNavButton', () => ({
  AppMobileNavButton: ({ viewerRole }: { readonly viewerRole: string }) => (
    <button data-testid="app-nav-button" data-role={viewerRole} type="button">
      menu
    </button>
  ),
}));

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AppRouteLayout from '../layout';

/**
 * Tests du layout racine du route group `(app)`.
 *
 * Couvre les CA :
 *   - Auth check defense en profondeur : redirect /login si pas de
 *     session (le middleware peut tomber ou etre contourne).
 *   - Render transparent des enfants quand authentifie.
 *   - Montage du `AppShell` avec le FAB de navigation mobile (Epic
 *     RESPONSIVE, CRITICAL 2) en passant `viewerRole`.
 */
describe('[AppRouteLayout]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    await expect(
      AppRouteLayout({
        children: <span data-testid="child" />,
      })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render children and the mobile nav button when session is present', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.fr', role: 'SALARIE' },
    } as any);

    const element = await AppRouteLayout({
      children: <div data-testid="child">hello</div>,
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="child"');
    expect(html).toContain('hello');
    expect(html).toContain('data-testid="app-nav-button"');
    expect(html).toContain('data-role="SALARIE"');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should forward the RESPONSABLE role to the mobile nav button', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u2', email: 'r@b.fr', role: 'RESPONSABLE' },
    } as any);

    const element = await AppRouteLayout({
      children: <div data-testid="child" />,
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-role="RESPONSABLE"');
  });
});
