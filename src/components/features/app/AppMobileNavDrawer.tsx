'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@prisma/client';
import { LogoutButton } from '@/components/features/auth/LogoutButton';
import { getAppNavItemsForRole } from '@/lib/constants/app-nav';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { CloseIcon } from '@/components/ui/icons/MenuIcons';

interface AppMobileNavDrawerProps {
  readonly viewerRole: UserRole;
  readonly onClose: () => void;
  readonly labelledById: string;
}

/**
 * Drawer plein-ecran de navigation transversale mobile (Client
 * Component, Epic RESPONSIVE).
 *
 * Resout le finding initial CRITICAL : "Un RESPONSABLE n'a aucun
 * raccourci vers /alertes, /dashboard, /exports/registre-consolide
 * depuis son mobile". Liste les routes filtrees par role.
 *
 * a11y :
 *   - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` cible le
 *     header texte "Navigation".
 *   - `useFocusTrap` mutualise focus trap, Escape, focus initial et
 *     scroll lock body (cf. `src/lib/hooks/useFocusTrap.ts`).
 *   - Le focus revient au bouton burger via `onClose` (gere par le
 *     parent).
 *   - Chaque lien depasse 44x44 px (min-h-touch, padding genereux).
 *
 * Pourquoi un drawer plein-ecran et pas un panel lateral ?
 *   - Charte MG mobile : surface unique, hierarchie nette.
 *   - Cohesion avec `AdminMobileMenu` (style sobre, accents or, sans
 *     scintillement).
 *
 * Note d'integration : ce composant ne gere PAS sa visibilite. Le parent
 * (`AppMobileNavButton`) le monte/demonte selon `isOpen`. Cela simplifie
 * le focus restore et evite des animations cassantes en SSR.
 */

const OVERLAY_CLASSES =
  'fixed inset-0 z-50 flex flex-col bg-mg-ivoire text-mg-noir md:hidden';
const HEADER_CLASSES =
  'flex items-center justify-between border-b border-mg-noir/10 px-6 pt-8 pb-6';
const HEADER_LABEL_CLASSES =
  'text-sm font-semibold uppercase tracking-[0.3em] text-mg-noir';
const HEADER_OR_BAR_CLASSES = 'mt-3 inline-block h-px w-10 bg-mg-or';
const HEADER_SUBTITLE_CLASSES =
  'mt-3 text-[10px] font-light uppercase tracking-[0.3em] text-mg-or';
const CLOSE_BUTTON_CLASSES =
  'inline-flex min-h-touch min-w-touch items-center justify-center text-mg-noir transition-colors hover:text-mg-or focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const NAV_CLASSES = 'flex-1 overflow-y-auto px-2 py-4';
const LINK_BASE =
  'flex min-h-touch items-center px-6 py-4 text-lg font-light tracking-wide text-mg-noir transition-colors hover:bg-mg-or/10 hover:text-mg-or focus:outline-none focus:bg-mg-or/10 focus:ring-2 focus:ring-mg-or focus:ring-inset';
const LINK_ACTIVE_CLASSES = 'bg-mg-or/10 text-mg-or font-medium';
const FOOTER_CLASSES =
  'border-t border-mg-noir/10 px-6 py-6 flex items-center justify-center';

function isLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  return pathname.startsWith(`${href}/`);
}

export function AppMobileNavDrawer({
  viewerRole,
  onClose,
  labelledById,
}: AppMobileNavDrawerProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = getAppNavItemsForRole(viewerRole);

  useFocusTrap({ containerRef, onEscape: onClose, isActive: true });

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      className={OVERLAY_CLASSES}
      data-testid="app-nav-drawer"
    >
      <div className={HEADER_CLASSES}>
        <div>
          <span id={labelledById} className={HEADER_LABEL_CLASSES}>
            Navigation
          </span>
          <span aria-hidden="true" className={HEADER_OR_BAR_CLASSES} />
          <p className={HEADER_SUBTITLE_CLASSES}>Maison Givre</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la navigation"
          className={CLOSE_BUTTON_CLASSES}
          data-testid="app-nav-close"
        >
          <CloseIcon />
        </button>
      </div>
      <nav className={NAV_CLASSES} aria-label="Navigation principale mobile">
        <ul className="flex flex-col">
          {items.map((item) => {
            const active = isLinkActive(pathname, item.href);
            return (
              <li key={item.slug}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`${LINK_BASE} ${active ? LINK_ACTIVE_CLASSES : ''}`}
                  data-testid={`app-nav-link-${item.slug}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={FOOTER_CLASSES}>
        <LogoutButton />
      </div>
    </div>
  );
}
