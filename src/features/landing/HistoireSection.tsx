import Image from 'next/image';
import {
  BRAND_HERITAGE,
  BRAND_HISTORY_INTRO,
  BRAND_HISTORY_OUTRO,
  BRAND_HISTORY_PARAGRAPHS,
} from '@/lib/constants/brand';
import { BrandDivider } from './BrandDivider';
import { FadeInSection } from './FadeInSection';
import { FleurDeLys } from './FleurDeLys';

/** Delais des deux colonnes : photo immediate, texte legerement decale. */
const PHOTO_DELAY_MS = 0;
const TEXT_DELAY_MS = 150;

/**
 * Section "Notre histoire" (Server Component).
 *
 * Layout 2 colonnes premium :
 *  - Col gauche : photo "histoire-jean-marc.jpg" (cornet + portrait Jean-Marc
 *    + texte officiel) en aspect 4/5, encadree d'un fin trait or
 *  - Col droite : intro + 4 paragraphes storytelling officiel + outro
 *
 * Sur mobile (< lg) : 1 col, photo en haut puis texte.
 * Les decoratifs typographiques (BrandDivider, FleurDeLys) restent en tete.
 * La mention "· DEPUIS 1933 ·" cloture centree sous les 2 colonnes.
 */
export function HistoireSection() {
  return (
    <section
      id="histoire"
      aria-labelledby="histoire-title"
      className="bg-mg-ivoire py-24 lg:py-32"
      data-testid="landing-histoire"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2
            id="histoire-title"
            className="text-2xl font-light tracking-[0.3em] text-mg-noir sm:text-3xl"
          >
            NOTRE HISTOIRE
          </h2>
          <div className="mt-8">
            <BrandDivider width="medium" />
          </div>
          <div className="mt-8">
            <FleurDeLys size={20} />
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-24">
          <FadeInSection delay={PHOTO_DELAY_MS}>
            <div className="relative aspect-[4/5] w-full overflow-hidden border border-mg-or/20">
              <Image
                src="/illustrations/histoire-jean-marc.jpg"
                alt="Cornet Maison Givre devant le tableau d'histoire signe Jean-Marc, glacier artisan depuis 1933"
                fill
                quality={85}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
                style={{ filter: 'grayscale(10%) brightness(0.95)' }}
              />
            </div>
          </FadeInSection>

          <FadeInSection
            delay={TEXT_DELAY_MS}
            className="flex flex-col justify-center"
          >
            <div className="space-y-3 text-lg leading-relaxed font-light text-mg-noir sm:text-xl">
              <p>{BRAND_HISTORY_INTRO.line1}</p>
              <p>{BRAND_HISTORY_INTRO.line2}</p>
            </div>

            <div className="mt-10 space-y-6 text-base leading-relaxed font-light text-mg-noir/80">
              {BRAND_HISTORY_PARAGRAPHS.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10 space-y-3 text-lg leading-relaxed font-light text-mg-noir sm:text-xl">
              <p>{BRAND_HISTORY_OUTRO.line1}</p>
              <p>{BRAND_HISTORY_OUTRO.line2}</p>
            </div>
          </FadeInSection>
        </div>

        <div className="mt-20 flex flex-col items-center">
          <BrandDivider width="small" />
          <p className="mt-6 text-[11px] font-light tracking-[0.4em] text-mg-noir">
            <span className="text-mg-or">·</span> {BRAND_HERITAGE}{' '}
            <span className="text-mg-or">·</span>
          </p>
        </div>
      </div>
    </section>
  );
}
