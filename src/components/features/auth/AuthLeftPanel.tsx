import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_HERITAGE,
} from '@/lib/constants/brand';
import { BrandDivider } from '@/features/landing/BrandDivider';

/**
 * Panneau gauche des pages auth (Server Component).
 *
 * Composition typographique Maison Givre :
 *   - Fond noir profond plein.
 *   - Wordmark MAISON GIVRE en capitales ivoire largement espacees.
 *   - Divider or fin (BrandDivider, source de verite vitrine).
 *   - Sous-titre GLACIER ARTISAN en or.
 *   - Mention DEPUIS 1933 entouree de points or.
 *   - Sous-texte court precisant le contexte "espace pro".
 *
 * Aucune illustration metier (anti-pattern : la charte premium prime sur le
 * branding HACCP). Visible uniquement >= lg pour ne pas hydrater le mobile
 * (panneau invisible) et respecter le split layout.
 */
export function AuthLeftPanel() {
  return (
    <aside
      className="relative hidden flex-col items-center justify-center overflow-hidden bg-mg-noir px-12 lg:flex lg:w-7/12"
      data-testid="auth-left-panel"
    >
      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <h1 className="text-5xl font-light tracking-[0.25em] text-mg-ivoire sm:text-6xl">
          {BRAND_NAME}
        </h1>

        <div className="mt-8">
          <BrandDivider width="large" />
        </div>

        <p className="mt-8 text-sm font-light tracking-[0.4em] text-mg-or sm:text-base">
          {BRAND_TAGLINE}
        </p>

        <p className="mt-10 text-[11px] font-light tracking-[0.4em] text-mg-ivoire/70">
          <span className="text-mg-or">{String.fromCharCode(183)}</span>{' '}
          {BRAND_HERITAGE}{' '}
          <span className="text-mg-or">{String.fromCharCode(183)}</span>
        </p>

        <p className="mt-16 max-w-xs text-[10px] font-light tracking-[0.3em] text-mg-ivoire/60 uppercase">
          Espace pro {String.fromCharCode(183)} Acces reserve aux equipes Maison
          Givre
        </p>
      </div>
    </aside>
  );
}
