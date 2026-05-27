'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEMS } from '@/lib/constants/admin-nav';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { BurgerIcon, CloseIcon } from '@/components/ui/icons/MenuIcons';

/**
 * Menu mobile admin (Client Component, US Epic RESPONSIVE).
 *
 * Affiche un burger button (visible `md:hidden`) qui ouvre un panneau
 * plein ecran avec les memes items que la sidebar desktop. Calque
 * structurel sur `LandingMobileMenu` pour rester homogene visuellement.
 *
 * `'use client'` requis : `useState` (open/close), `usePathname` (etat
 * actif), `useRef` (focus restore au close) + `useFocusTrap`.
 *
 * Visuel :
 *   - Burger : 44x44 px (min-h-touch + min-w-touch -> WCAG 2.1 AA).
 *   - Panneau : fond noir profond, items capitales espacees ivoire,
 *     item actif souligne d'une fine barre or a gauche.
 *
 * a11y :
 *   - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` cible le
 *     wordmark "Maison Givre" du panneau (contrat WAI-ARIA pour les
 *     modales).
 *   - `aria-expanded` / `aria-controls` (conditionnel quand le panneau
 *     est monte) sur le burger pour signaler l'etat aux lecteurs d'ecran.
 *   - `aria-label` dynamique "Ouvrir/Fermer le menu".
 *   - `useFocusTrap` : focus initial sur premier item, Tab/Shift+Tab
 *     reste dans le panneau, Escape ferme, scroll body lock pendant
 *     l'ouverture.
 *   - Focus restore : le bouton burger reprend le focus a la fermeture
 *     pour respecter le contrat WCAG des dialogs.
 *
 * Pourquoi pas dans `AdminMobileMenu` -> panneau "lg:hidden" (et non
 * `md:hidden`) ? La sidebar desktop est visible a partir de `lg+`. En
 * dessous (mobile + tablette portrait), pas de sidebar -> on offre le
 * burger ; cela couvre meme les tablettes a 1024px en portrait.
 */

const BURGER_CLASSES =
  'inline-flex min-h-touch min-w-touch items-center justify-center text-mg-noir transition-colors hover:text-mg-or focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire lg:hidden';
const OVERLAY_CLASSES = 'fixed inset-0 z-40 bg-mg-noir/40 lg:hidden';
const PANEL_CLASSES =
  'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-mg-noir text-mg-ivoire shadow-2xl lg:hidden';
const PANEL_HEADER_CLASSES = 'px-8 pt-10 pb-8';
const NAV_CLASSES = 'mt-2 flex flex-col';
const LINK_BASE =
  'relative flex min-h-touch items-center px-8 py-3 text-[11px] font-medium tracking-[0.25em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-inset';
const LINK_ACTIVE = 'text-mg-or';
const LINK_INACTIVE = 'text-mg-ivoire/70 hover:text-mg-or';
const CLOSE_BUTTON_CLASSES =
  'inline-flex min-h-touch min-w-touch items-center justify-center text-mg-ivoire transition-colors hover:text-mg-or focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-noir';

export function AdminMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const labelledById = `${panelId}-title`;

  const close = useCallback(() => {
    setIsOpen(false);
    // Focus restore : le bouton qui a ouvert reprend le focus apres close
    // pour respecter le contrat des dialogs WCAG. requestAnimationFrame
    // attend que le DOM ait fini de demonter le panneau avant de poser le
    // focus, sinon le navigateur le perd.
    requestAnimationFrame(() => {
      buttonRef.current?.focus();
    });
  }, []);

  useFocusTrap({
    containerRef: panelRef,
    onEscape: close,
    isActive: isOpen,
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className={BURGER_CLASSES}
        data-testid="admin-mobile-toggle"
      >
        <BurgerIcon />
      </button>

      {isOpen ? (
        <>
          <div
            className={OVERLAY_CLASSES}
            onClick={close}
            data-testid="admin-mobile-overlay"
            aria-hidden="true"
          />
          <aside
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledById}
            className={PANEL_CLASSES}
            data-testid="admin-mobile-menu"
          >
            <div className={PANEL_HEADER_CLASSES}>
              <div className="flex items-start justify-between">
                <div>
                  <span
                    id={labelledById}
                    className="block text-sm font-semibold tracking-[0.3em] text-mg-ivoire uppercase"
                  >
                    Maison Givre
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-3 inline-block h-px w-10 bg-mg-or"
                  />
                  <p className="mt-3 text-[10px] font-light tracking-[0.3em] text-mg-or uppercase">
                    Espace Admin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fermer le menu"
                  className={CLOSE_BUTTON_CLASSES}
                  data-testid="admin-mobile-close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <nav
              className={NAV_CLASSES}
              aria-label="Sections administration mobile"
            >
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    aria-current={isActive ? 'page' : undefined}
                    className={`${LINK_BASE} ${
                      isActive ? LINK_ACTIVE : LINK_INACTIVE
                    }`}
                    data-testid={`admin-mobile-link-${item.label.toLowerCase()}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 left-0 h-6 w-px -translate-y-1/2 bg-mg-or transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}
