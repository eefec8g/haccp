import type { ReactNode } from 'react';

/**
 * KpisGrid - Layout responsive pour aligner des `KpiCard`.
 *
 * Server Component pur, structure semantique :
 *   - <section> avec aria-label optionnel,
 *   - grid 1 colonne mobile / 2 sm / 4 md.
 *
 * Quatre colonnes maximum sur grand ecran : aligne avec les 4 KPIs
 * Responsable (taux jour, alertes, manquants, boutiques) et les 6
 * Admin (sur 2 lignes de 4 / 4 + 2 pour la lisibilite).
 */

interface KpisGridProps {
  readonly children: ReactNode;
  /** aria-label de la section (defaut : "Indicateurs cles"). */
  readonly ariaLabel?: string;
  /** `data-testid` du wrapper (defaut : kpis-grid). */
  readonly testId?: string;
}

const GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4';

export function KpisGrid({
  children,
  ariaLabel = 'Indicateurs cles',
  testId,
}: KpisGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={GRID_CLASSES}
      data-testid={testId ?? 'kpis-grid'}
    >
      {children}
    </section>
  );
}
