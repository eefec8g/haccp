import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { POST_LOGIN_REDIRECT } from '@/lib/constants/auth';
import { BRAND_BOUTIQUES, BRAND_CONTACT } from '@/lib/constants/brand';
import { BrandDivider } from './BrandDivider';
import { FadeInSection } from './FadeInSection';

interface ProCta {
  readonly label: string;
  readonly href: Route;
  readonly testid: string;
}

/**
 * Resout le CTA "Espace pro" en fonction de la session. Pour un utilisateur
 * authentifie on pointe vers son espace, sinon vers /login.
 */
function resolveProCta(role: UserRole | undefined): ProCta {
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
 * Section CTA finale "Contact" (Server Component).
 *
 * Fond noir profond, titre capitales espacees, coordonnees centrees
 * (adresse, telephone, email, horaires) et deux CTAs :
 *  - "Nous contacter" : mailto principal (bouton outline or)
 *  - "Espace pro" : lien discret texte+chevron vers /login (ou espace)
 *
 * Aucune redondance commerciale, ton sobre, tres aere.
 */
export async function CTASection() {
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  const proCta = resolveProCta(role);
  const mailto = `mailto:${BRAND_CONTACT.email}`;

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative overflow-hidden bg-mg-noir py-24 lg:py-32"
      data-testid="landing-cta"
    >
      <Image
        src="/illustrations/boutique-vitrine.jpg"
        alt="Vitrine de glaces et sorbets artisanaux Maison Givre"
        fill
        quality={80}
        sizes="100vw"
        className="absolute inset-0 z-0 object-cover object-center"
        style={{ filter: 'grayscale(35%) brightness(0.45)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 z-10 bg-mg-noir/75" />

      <FadeInSection className="relative z-20 mx-auto max-w-3xl px-6 text-center lg:px-8">
        <h2
          id="contact-title"
          className="text-2xl font-light tracking-[0.3em] text-mg-ivoire sm:text-3xl"
        >
          NOUS RENDRE VISITE
        </h2>
        <div className="mt-8 flex justify-center">
          <BrandDivider width="medium" />
        </div>

        <ul
          role="list"
          className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-16"
        >
          {BRAND_BOUTIQUES.map((boutique) => (
            <li
              key={boutique.id}
              className="flex flex-col items-center text-center"
              data-testid={`boutique-${boutique.id}`}
            >
              <h3 className="text-xs font-medium tracking-[0.4em] text-mg-or uppercase">
                {boutique.name}
              </h3>
              <div className="mt-4">
                <BrandDivider width="small" />
              </div>
              <div className="mt-6 space-y-1 text-sm font-light tracking-wide text-mg-ivoire/80">
                <p>{boutique.street}</p>
                <p>
                  {boutique.postalCode} {boutique.city}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-14 text-sm font-light tracking-wide text-mg-ivoire/70">
          <a href={mailto} className="transition-colors hover:text-mg-or">
            {BRAND_CONTACT.email}
          </a>
        </p>

        <div className="mt-14 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
          <a
            href={mailto}
            className="group inline-flex items-center gap-3 border border-mg-or px-8 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-or uppercase transition-all hover:bg-mg-or hover:text-mg-noir"
            data-testid="landing-cta-contact"
          >
            Nous contacter
            <span
              aria-hidden="true"
              className="inline-block transition-transform group-hover:translate-x-1"
            >
              {String.fromCharCode(8594)}
            </span>
          </a>

          <Link
            href={proCta.href}
            className="group inline-flex items-center gap-2 border-b border-transparent pb-0.5 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire/70 uppercase transition-colors hover:border-mg-or hover:text-mg-or"
            data-testid={proCta.testid}
          >
            {proCta.label}
            <span
              aria-hidden="true"
              className="inline-block transition-transform group-hover:translate-x-0.5"
            >
              {String.fromCharCode(8594)}
            </span>
          </Link>
        </div>
      </FadeInSection>
    </section>
  );
}
