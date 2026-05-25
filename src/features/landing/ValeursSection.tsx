import { BRAND_KEYWORDS, BRAND_STORY } from '@/lib/constants/brand';
import { BrandDivider } from './BrandDivider';

/**
 * Section "Valeurs" (Server Component).
 *
 * Bandeau central sobre sur fond ivoire :
 *  - 3 mots cles ELEGANCE / AUTHENTICITE / SAVOIR-FAIRE separes par des
 *    points or, en grandes capitales espacees.
 *  - Ligne fine or de transition.
 *  - Tagline officielle complete (BRAND_STORY).
 *
 * Beaucoup d'air autour : padding vertical genereux, max-width contenu,
 * marges de respiration. Aucune surcharge visuelle.
 */
export function ValeursSection() {
  return (
    <section
      id="valeurs"
      aria-labelledby="valeurs-title"
      className="bg-mg-ivoire py-28 lg:py-40"
      data-testid="landing-valeurs"
    >
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <h2
          id="valeurs-title"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-xl font-light tracking-[0.3em] text-mg-noir sm:text-2xl lg:text-3xl"
        >
          {BRAND_KEYWORDS.map((keyword, index) => (
            <span key={keyword} className="inline-flex items-center gap-x-6">
              <span>{keyword}</span>
              {index < BRAND_KEYWORDS.length - 1 && (
                <span aria-hidden="true" className="text-mg-or">
                  ·
                </span>
              )}
            </span>
          ))}
        </h2>

        <div className="mt-14 flex justify-center">
          <BrandDivider width="medium" withDot />
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-base leading-relaxed font-light text-mg-noir/75 sm:text-lg">
          {BRAND_STORY}
        </p>
      </div>
    </section>
  );
}
