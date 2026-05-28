'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

interface AppSidebarLinkProps {
  readonly href: Route;
  readonly label: string;
  readonly testId: string;
}

/**
 * Lien individuel de la sidebar desktop `(app)` (Client Component,
 * fix/app-sidebar).
 *
 * Pourquoi un Client Component dedie ?
 *   - Le seul besoin de `usePathname()` justifie de sortir uniquement le
 *     lien du Server Component parent (`AppSidebar`). Pattern aligne
 *     sur `AdminSidebarLink` : on minimise la surface d'hydratation a
 *     l'echelle du lien plutot que de la sidebar complete.
 *   - La sidebar parente reste Server Component (zero JS) : seuls les
 *     liens individuels hydratent pour calculer leur etat actif.
 *
 * Charte Maison Givre : capitales espacees, fine barre or a gauche
 * pour l'item actif (sur fond noir profond, accent or).
 *
 * a11y :
 *   - `aria-current="page"` sur l'item correspondant a la route courante
 *     (match exact ou route fille `${href}/...`).
 *   - Cible tactile `min-h-touch` (>= 44px WCAG 2.1 AA).
 *   - Focus visible via ring or, contraste AA sur fond noir.
 */

const LINK_BASE =
  'group relative flex min-h-touch items-center gap-3 px-8 py-3 text-[11px] font-medium tracking-[0.25em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-inset';
const LINK_ACTIVE = 'text-mg-or';
const LINK_INACTIVE = 'text-mg-ivoire/70 hover:text-mg-or';

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

export function AppSidebarLink({ href, label, testId }: AppSidebarLinkProps) {
  const pathname = usePathname();
  const active = isLinkActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${LINK_BASE} ${active ? LINK_ACTIVE : LINK_INACTIVE}`}
      data-testid={testId}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-0 h-6 w-px -translate-y-1/2 bg-mg-or transition-opacity ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
        }`}
      />
      <span>{label}</span>
    </Link>
  );
}
