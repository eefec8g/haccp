import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePathname } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/releves'),
}));

vi.mock('../AppSidebar', () => ({
  AppSidebar: ({ viewerRole }: { readonly viewerRole: string }) => (
    <aside data-testid="app-sidebar" data-role={viewerRole}>
      sidebar
    </aside>
  ),
}));

import { AppShellClientGate } from '../AppShellClientGate';

const usePathnameMock = vi.mocked(usePathname);

/**
 * Tests `AppShellClientGate` (fix/app-sidebar).
 *
 * Le gate decide cote client si on rend la sidebar + son padding
 * `lg:pl-64` ou seulement les enfants inline. Cela evite la double
 * sidebar et le double padding-left sur `/admin/*` ou `AdminLayout`
 * applique deja son propre layout.
 *
 * Couvre :
 *   - Sur `/admin` : ne rend NI sidebar NI wrapper `lg:pl-64`, juste
 *     les enfants inline (delegate complete a `AdminLayout`).
 *   - Sur `/admin/users` (sous-route admin) : meme comportement.
 *   - Sur `/releves` (hors admin) : rend la sidebar + wrap les enfants
 *     dans un div `lg:pl-64`.
 *   - Sur `/admin-autre` (faux match) : rend la sidebar (frontiere de
 *     segment respectee, le prefix sans `/` ne doit pas matcher).
 *   - Role propage a la sidebar.
 */
describe('[AppShellClientGate]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should hide the sidebar AND the `lg:pl-64` wrapper on /admin exactly', () => {
    usePathnameMock.mockReturnValue('/admin');
    const html = renderToStaticMarkup(
      <AppShellClientGate viewerRole="ADMIN">
        <main data-testid="page-main">admin home</main>
      </AppShellClientGate>
    );

    expect(html).not.toContain('data-testid="app-sidebar"');
    expect(html).not.toContain('lg:pl-64');
    expect(html).toContain('data-testid="page-main"');
  });

  it('should hide the sidebar AND the `lg:pl-64` wrapper on /admin sub-routes', () => {
    usePathnameMock.mockReturnValue('/admin/users');
    const html = renderToStaticMarkup(
      <AppShellClientGate viewerRole="ADMIN">
        <main data-testid="page-main">admin users</main>
      </AppShellClientGate>
    );

    expect(html).not.toContain('data-testid="app-sidebar"');
    expect(html).not.toContain('lg:pl-64');
    expect(html).toContain('data-testid="page-main"');
  });

  it('should render the sidebar + `lg:pl-64` wrapper on non-admin routes', () => {
    usePathnameMock.mockReturnValue('/releves');
    const html = renderToStaticMarkup(
      <AppShellClientGate viewerRole="SALARIE">
        <main data-testid="page-main">releves</main>
      </AppShellClientGate>
    );

    expect(html).toContain('data-testid="app-sidebar"');
    expect(html).toContain('lg:pl-64');
    expect(html).toContain('data-testid="page-main"');
  });

  it('should propagate the viewer role to the sidebar', () => {
    usePathnameMock.mockReturnValue('/releves');
    const html = renderToStaticMarkup(
      <AppShellClientGate viewerRole="RESPONSABLE">
        <div data-testid="child" />
      </AppShellClientGate>
    );

    expect(html).toMatch(
      /<aside[^>]*data-testid="app-sidebar"[^>]*data-role="RESPONSABLE"/
    );
  });

  it('should render the sidebar when a non-admin path shares only a prefix (`/admin-autre`)', () => {
    // Frontiere de segment respectee : `/admin-autre` ne doit pas etre
    // considere comme une sous-route de `/admin`.
    usePathnameMock.mockReturnValue('/admin-autre');
    const html = renderToStaticMarkup(
      <AppShellClientGate viewerRole="ADMIN">
        <div data-testid="child" />
      </AppShellClientGate>
    );

    expect(html).toContain('data-testid="app-sidebar"');
    expect(html).toContain('lg:pl-64');
  });
});
