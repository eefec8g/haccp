import { BRAND_PILLARS, type PillarIconKey } from '@/lib/constants/brand';
import { BrandDivider } from './BrandDivider';

/**
 * Section "Savoir-faire" / 4 piliers de marque (Server Component).
 *
 * Fond noir profond, pictogrammes ronds or, typographie capitales espacees.
 * Layout : 1 colonne mobile, 2 colonnes tablette, 4 colonnes desktop.
 * Icones SVG inline (zero asset reseau) : feuille, fouet, montagne, flocon.
 */

/**
 * Catalogue d'icones SVG inline pour les piliers. Toutes les icones
 * partagent les memes attributs de tracage (currentColor, stroke 1.5px).
 * Decorativement la ronde est dessinee par le wrapper parent.
 */
const PILLAR_ICONS: Record<PillarIconKey, React.ReactNode> = {
  feuille: (
    <>
      <path d="M6 18 C 6 10, 12 6, 18 6 C 18 12, 14 18, 6 18 Z" />
      <path d="M6 18 C 8 14, 12 10, 18 6" />
    </>
  ),
  fouet: (
    <>
      <path d="M12 4 L 12 12" />
      <path d="M8 14 C 8 17, 10 19, 12 19 C 14 19, 16 17, 16 14" />
      <path d="M9 12 C 9 14, 10.5 16, 12 16 C 13.5 16, 15 14, 15 12" />
      <path d="M10 10 C 10 12, 11 14, 12 14 C 13 14, 14 12, 14 10" />
      <circle cx="12" cy="3.5" r="0.8" />
    </>
  ),
  montagne: (
    <>
      <path d="M3 19 L 9 9 L 12 13 L 15 8 L 21 19 Z" />
      <path d="M8 14 L 10 12" />
    </>
  ),
  flocon: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      <path d="M12 6 L 10 4 M12 6 L 14 4" />
      <path d="M12 18 L 10 20 M12 18 L 14 20" />
      <path d="M6 12 L 4 10 M6 12 L 4 14" />
      <path d="M18 12 L 20 10 M18 12 L 20 14" />
    </>
  ),
};

export function PiliersSection() {
  return (
    <section
      id="savoir-faire"
      aria-labelledby="piliers-title"
      className="bg-mg-noir py-24 lg:py-32"
      data-testid="landing-piliers"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <h2
            id="piliers-title"
            className="text-2xl font-light tracking-[0.3em] text-mg-ivoire sm:text-3xl"
          >
            L&apos;EXCELLENCE A CHAQUE ETAPE
          </h2>
          <div className="mt-8 flex justify-center">
            <BrandDivider width="medium" />
          </div>
          <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed font-light text-mg-ivoire/70">
            Notre engagement repose sur quatre piliers transmis de generation en
            generation, depuis l&apos;atelier fondateur de 1933.
          </p>
        </div>

        <ul
          className="mt-20 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
          role="list"
        >
          {BRAND_PILLARS.map((pillar) => (
            <li
              key={pillar.id}
              className="flex flex-col items-center text-center"
              data-testid={`pillar-${pillar.id}`}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full border border-mg-or"
                style={{ borderWidth: '1.5px' }}
              >
                <svg
                  className="h-7 w-7 text-mg-or"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  role="img"
                  aria-label={pillar.title}
                >
                  {PILLAR_ICONS[pillar.iconKey]}
                </svg>
              </div>
              <h3 className="mt-8 text-xs font-medium tracking-[0.25em] text-mg-ivoire uppercase">
                {pillar.title}
              </h3>
              <p className="mt-4 max-w-xs text-sm leading-relaxed font-light text-mg-ivoire/65">
                {pillar.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
