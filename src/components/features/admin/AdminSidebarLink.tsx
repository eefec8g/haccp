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
  'flex items-center gap-3 rounded-[7px] px-4 py-2.5 text-sm font-medium transition-colors';
const LINK_ACTIVE =
  'bg-[#5D87FF] text-white shadow-[0_4px_16px_-4px_rgba(93,135,255,0.55)]';
const LINK_INACTIVE = 'text-[#2A3547] hover:bg-[#ECF2FF] hover:text-[#5D87FF]';

/**
 * Lien de la sidebar admin avec mise en valeur du chemin actif.
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
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span>{label}</span>
    </Link>
  );
}
