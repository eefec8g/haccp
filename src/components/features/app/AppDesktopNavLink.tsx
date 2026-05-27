'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

interface AppDesktopNavLinkProps {
  readonly href: Route;
  readonly label: string;
  readonly testId: string;
}

/**
 * Lien individuel de la top nav desktop avec highlight de l'item actif
 * (Epic RESPONSIVE, fix/desktop-nav).
 *
 * Pourquoi un Client Component dedie ?
 *   - Le seul besoin de `usePathname()` justifie de sortir uniquement le
 *     lien du Server Component parent (`AppDesktopNav`). Pattern aligne
 *     sur `AdminSidebarLink` : on minimise la surface d'hydratation a
 *     l'echelle du lien plutot que du nav complet.
 *   - Le nav parent reste Server Component (zero JS) : seuls les liens
 *     individuels hydratent pour calculer leur etat actif.
 *
 * a11y :
 *   - `aria-current="page"` sur l'item correspondant a la route courante
 *     (match exact ou route fille `${href}/...`).
 *   - Cible tactile `min-h-touch` (>= 44px WCAG 2.1 AA).
 *   - Focus visible via ring or, contraste AA sur fond ivoire.
 */

const LINK_BASE =
  'inline-flex items-center min-h-touch px-4 py-2 text-xs uppercase tracking-[0.2em] font-light focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire transition-colors';
const LINK_INACTIVE = 'text-mg-noir/70 hover:text-mg-or';
const LINK_ACTIVE = 'text-mg-or border-b-2 border-mg-or';

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

export function AppDesktopNavLink({
  href,
  label,
  testId,
}: AppDesktopNavLinkProps) {
  const pathname = usePathname();
  const active = isLinkActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${LINK_BASE} ${active ? LINK_ACTIVE : LINK_INACTIVE}`}
      data-testid={testId}
    >
      {label}
    </Link>
  );
}
