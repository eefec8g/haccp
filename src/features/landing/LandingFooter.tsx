import Link from 'next/link';
import type { Route } from 'next';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_HERITAGE,
  BRAND_FOUNDING_YEAR,
} from '@/lib/constants/brand';
import { FOOTER_BRAND_TAGLINE, FOOTER_LINK_GROUPS } from './constants';
import { BrandDivider } from './BrandDivider';

interface FooterCta {
  readonly label: string;
  readonly href: Route;
  readonly testid: string;
}

/**
 * Resout le CTA contextuel selon l'etat de session.
 * Meme logique que `LandingHeader` / `CTASection` pour eviter qu'un
 * utilisateur authentifie voie "Espace pro" en footer pendant que le
 * header affiche "Acceder a mon espace" (incoherence visuelle).
 */
function resolveFooterCta(role: UserRole | undefined): FooterCta {
  if (role && role in POST_LOGIN_REDIRECT) {
    return {
      label: 'Acceder a mon espace',
      href: POST_LOGIN_REDIRECT[role] as Route,
      testid: 'landing-footer-cta-app',
    };
  }
  return {
    label: 'Espace pro',
    href: '/login' as Route,
    testid: 'landing-footer-cta-pro',
  };
}

/**
 * Footer public de la vitrine Maison Givre (Server Component).
 *
 * Composition :
 *  - Colonne marque : wordmark + tagline courte
 *  - Colonnes navigation, legal, reseaux sociaux
 *  - Mention copyright "1933-AAAA Maison Givre - Tous droits reserves"
 *  - Petit lien discret "Espace pro" (ou "Acceder a mon espace") vers /login
 *
 * La date courante est calculee cote serveur (no hydration mismatch).
 */
export async function LandingFooter() {
  const currentYear = new Date().getFullYear();
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const cta = resolveFooterCta(role);

  return (
    <footer
      role="contentinfo"
      className="border-t border-mg-or/20 bg-mg-ivoire py-16 lg:py-20"
      data-testid="landing-footer"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="flex flex-col leading-tight"
              aria-label={`${BRAND_NAME} - Accueil`}
            >
              <span className="text-base font-semibold tracking-[0.3em] text-mg-noir">
                {BRAND_NAME}
              </span>
              <span className="mt-2 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-5 bg-mg-or"
                />
                <span className="text-[10px] font-light tracking-[0.25em] text-mg-or">
                  {BRAND_TAGLINE}
                </span>
              </span>
            </Link>
            <p className="mt-6 max-w-xs text-sm leading-relaxed font-light text-mg-noir/65">
              {FOOTER_BRAND_TAGLINE}
            </p>
          </div>

          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-medium tracking-[0.25em] text-mg-noir uppercase">
                {group.title}
              </h3>
              <div className="mt-4">
                <BrandDivider width="small" />
              </div>
              <ul className="mt-6 space-y-3" role="list">
                {group.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-light text-mg-noir/70 transition-colors hover:text-mg-or"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        href={link.href as Route}
                        className="text-sm font-light text-mg-noir/70 transition-colors hover:text-mg-or"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 border-t border-mg-or/20 pt-8 sm:flex-row sm:justify-between">
          <p className="text-xs font-light tracking-[0.2em] text-mg-noir/60">
            &copy; {BRAND_FOUNDING_YEAR}-{currentYear} {BRAND_NAME}{' '}
            <span aria-hidden="true" className="text-mg-or">
              ·
            </span>{' '}
            Tous droits reserves
          </p>
          <p className="text-[10px] font-light tracking-[0.3em] text-mg-noir/50">
            <span className="text-mg-or">·</span> {BRAND_HERITAGE}{' '}
            <span className="text-mg-or">·</span>
          </p>
          <Link
            href={cta.href}
            className="text-[10px] font-medium tracking-[0.3em] text-mg-noir/60 uppercase transition-colors hover:text-mg-or"
            data-testid={cta.testid}
          >
            {cta.label} {String.fromCharCode(8594)}
          </Link>
        </div>
      </div>
    </footer>
  );
}
