'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { BRAND_NAV_LINKS } from '@/lib/constants/brand';

interface LandingMobileMenuProps {
  readonly ctaLabel: string;
  readonly ctaHref: Route;
  readonly ctaTestId: string;
}

/**
 * Burger menu mobile de la vitrine Maison Givre (Client Component isole).
 *
 * useState requis pour l'etat ouvert/ferme. Charte mobile : fond ivoire,
 * accents or, typographie capitales espacees. Le reste du header reste
 * Server Component pour eviter une hydration globale.
 */
export function LandingMobileMenu({
  ctaLabel,
  ctaHref,
  ctaTestId,
}: LandingMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls="landing-mobile-menu"
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="inline-flex h-11 w-11 items-center justify-center text-mg-noir transition-colors hover:text-mg-or"
        data-testid="landing-mobile-toggle"
      >
        {isOpen ? (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          id="landing-mobile-menu"
          className="absolute top-full right-0 left-0 border-t border-mg-or/20 bg-mg-ivoire px-6 py-6 shadow-lg"
          data-testid="landing-mobile-menu"
        >
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {BRAND_NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                className="px-2 py-3 text-xs font-medium tracking-[0.2em] text-mg-noir uppercase transition-colors hover:text-mg-or"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 border-t border-mg-or/20 pt-6">
            <Link
              href={ctaHref}
              onClick={close}
              className="inline-flex w-full items-center justify-center gap-2 border border-mg-or px-6 py-3 text-xs font-medium tracking-[0.25em] text-mg-noir uppercase transition-colors hover:bg-mg-or hover:text-mg-ivoire"
              data-testid={
                ctaTestId === 'landing-cta-login'
                  ? 'landing-mobile-cta'
                  : ctaTestId
              }
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
