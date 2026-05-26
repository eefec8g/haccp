import Link from 'next/link';
import type { Route } from 'next';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_HERITAGE,
  BRAND_NAV_LINKS,
} from '@/lib/constants/brand';
import { LandingMobileMenu } from './LandingMobileMenu';

interface HeaderCta {
  readonly label: string;
  readonly href: Route;
  readonly testid: string;
}

/**
 * Resout le CTA contextuel a afficher selon l'etat de session :
 *  - anonyme  -> "Espace pro" -> /login (discret)
 *  - authentifie -> "Acceder a mon espace" -> POST_LOGIN_REDIRECT[role]
 */
function resolveHeaderCta(role: UserRole | undefined): HeaderCta {
  if (role && role in POST_LOGIN_REDIRECT) {
    return {
      label: 'Acceder a mon espace',
      href: POST_LOGIN_REDIRECT[role] as Route,
      testid: 'landing-cta-app',
    };
  }
  return {
    label: 'Espace pro',
    href: '/login' as Route,
    testid: 'landing-cta-login',
  };
}

/**
 * Header de la vitrine publique Maison Givre (Server Component).
 *
 * Layout :
 *  - Logo / wordmark a gauche (MAISON GIVRE + ligne or + GLACIER ARTISAN)
 *  - Navigation par ancres au centre (md+)
 *  - CTA "Espace pro" discret a droite (texte fin + chevron)
 *  - Burger mobile (composant client isole)
 *
 * Palette : fond ivoire avec leger flou, accent or, texte noir profond.
 */
export async function LandingHeader() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const cta = resolveHeaderCta(role);

  return (
    <header
      className="sticky top-0 z-50 border-b border-mg-or/20 bg-mg-ivoire/95 backdrop-blur-md"
      data-testid="landing-header"
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5 lg:px-10">
        <Link
          href="/"
          className="flex flex-col items-start leading-tight"
          aria-label={`${BRAND_NAME} - Accueil`}
          data-testid="landing-logo"
        >
          <span className="text-base font-semibold tracking-[0.3em] text-mg-noir sm:text-lg">
            {BRAND_NAME}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-px w-6 bg-mg-or"
            />
            <span className="text-[10px] font-light tracking-[0.25em] text-mg-or">
              {BRAND_TAGLINE}
            </span>
          </span>
          <span className="mt-0.5 text-[9px] font-light tracking-[0.3em] text-mg-noir/60">
            <span className="text-mg-or">·</span> {BRAND_HERITAGE}{' '}
            <span className="text-mg-or">·</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Navigation principale"
        >
          {BRAND_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-[0.2em] text-mg-noir/80 uppercase transition-colors hover:text-mg-or"
              data-testid={link.testid}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center md:flex">
          <Link
            href={cta.href}
            className="group inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-xs font-medium tracking-[0.25em] text-mg-noir uppercase transition-colors hover:border-mg-or hover:text-mg-or"
            data-testid={cta.testid}
          >
            {cta.label}
            <span
              aria-hidden="true"
              className="inline-block transition-transform group-hover:translate-x-0.5"
            >
              {String.fromCharCode(8594)}
            </span>
          </Link>
        </div>

        <LandingMobileMenu
          ctaLabel={cta.label}
          ctaHref={cta.href}
          ctaTestId={cta.testid}
        />
      </div>
    </header>
  );
}
