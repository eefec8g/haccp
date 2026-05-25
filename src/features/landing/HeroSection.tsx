import Image from 'next/image';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_HERITAGE,
} from '@/lib/constants/brand';
import { BrandDivider } from './BrandDivider';

/**
 * Hero principal de la vitrine Maison Givre (Server Component).
 *
 * Composition typographique premium sur photo reelle de la boutique :
 *  - Background : photo "boutique-interieur.jpg" traitee (grayscale 20%,
 *    brightness 0.55) pour uniformiser vers la charte ivoire/noir/or
 *  - Overlay noir mg-noir/40 pour garantir la lisibilite du texte
 *  - Eyebrow "· BIENVENUE" en or, puis wordmark MAISON GIVRE
 *  - Divider or fin
 *  - Sous-titre GLACIER ARTISAN
 *  - Mention DEPUIS 1933 entouree de points or
 *  - CTA outline or vers "Notre histoire"
 *
 * L'image utilise next/image avec priority (above the fold) et quality 85.
 */
export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-mg-noir pt-32 pb-24 lg:pt-40"
      data-testid="landing-hero"
    >
      <Image
        src="/illustrations/boutique-interieur.jpg"
        alt="Interieur de la boutique Maison Givre"
        fill
        priority
        quality={85}
        sizes="100vw"
        className="absolute inset-0 z-0 object-cover object-center"
        style={{ filter: 'grayscale(20%) brightness(0.55)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 z-10 bg-mg-noir/40" />

      <div className="relative z-20 mx-auto flex max-w-3xl flex-col items-center px-6 text-center lg:px-8">
        <p className="mb-6 text-[10px] font-light tracking-[0.4em] text-mg-or uppercase">
          <span className="text-mg-or">·</span> Bienvenue
        </p>

        <h1
          id="hero-title"
          className="text-5xl font-light tracking-[0.25em] text-mg-ivoire sm:text-6xl lg:text-7xl"
        >
          {BRAND_NAME}
        </h1>

        <div className="mt-8">
          <BrandDivider width="large" />
        </div>

        <p className="mt-8 text-sm font-light tracking-[0.4em] text-mg-or sm:text-base">
          {BRAND_TAGLINE}
        </p>

        <p className="mt-12 text-[11px] font-light tracking-[0.4em] text-mg-ivoire/80">
          <span className="text-mg-or">·</span> {BRAND_HERITAGE}{' '}
          <span className="text-mg-or">·</span>
        </p>

        <a
          href="#histoire"
          className="group mt-16 inline-flex items-center gap-3 border border-mg-or/60 bg-mg-noir/20 px-8 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase backdrop-blur-sm transition-all hover:border-mg-or hover:bg-mg-or hover:text-mg-noir"
          data-testid="hero-cta-histoire"
        >
          Notre histoire
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-hover:translate-x-1"
          >
            {String.fromCharCode(8594)}
          </span>
        </a>
      </div>
    </section>
  );
}
