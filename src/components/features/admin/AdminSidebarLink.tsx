'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface AdminSidebarLinkProps {
  readonly href: Route;
  readonly label: string;
  readonly icon?: ReactNode;
}

const LINK_BASE =
  'group relative flex items-center gap-3 px-8 py-3 text-[11px] font-medium tracking-[0.25em] uppercase transition-colors';
const LINK_ACTIVE = 'text-mg-or';
const LINK_INACTIVE = 'text-mg-ivoire/70 hover:text-mg-or';

/**
 * Lien de la sidebar admin avec mise en valeur du chemin actif.
 *
 * Charte Maison Givre : style minimaliste premium, lettres capitales
 * espacees, indicateur or fin a gauche pour l'etat actif.
 *
 * `'use client'` uniquement parce qu'on a besoin de `usePathname`. Le
 * reste de la sidebar (texture, structure) reste Server Component pour
 * limiter l'hydratation.
 */
export function AdminSidebarLink({ href, label, icon }: AdminSidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${LINK_BASE} ${isActive ? LINK_ACTIVE : LINK_INACTIVE}`}
      data-testid={`admin-sidebar-link-${label.toLowerCase()}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1/2 left-0 h-6 w-px -translate-y-1/2 bg-mg-or transition-opacity ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
        }`}
      />
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </Link>
  );
}
