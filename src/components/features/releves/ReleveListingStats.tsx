import type { ReleveListingStats } from '@/types/releve-listing';

/**
 * Encart de statistiques globales du listing (Epic LISTING, Phase 2).
 *
 * Server Component pur (pas d'interactivite) : 4 cards alignees en grille
 * responsive (1 colonne mobile, 2 tablette, 4 desktop). Chaque card
 * affiche un compteur et un libelle, avec une couleur de la charte
 * Maison Givre dependante du statut :
 *   - Saisis    : mg-noir (neutre, conformite OK).
 *   - Alertes   : mg-or (accent attention, RG-SEUIL-001).
 *   - Manquants : mg-noir/60 (visible mais discret).
 *   - Annules   : mg-noir/50 + italic (signal d'invalidation, lisible).
 *
 * a11y : `aria-label` calcule sur chaque card pour les lecteurs d'ecran
 * ("Saisis : 123"), `role="status"` global polite pour annoncer un
 * recalcul si la valeur change apres un filtre.
 *
 * Pourquoi pas `KpiCard` ?
 *   - Pas de drill-down individuel (les filtres sont sur le form).
 *   - Charte specifique au listing (statut-colored value, pas l'eyebrow
 *     or systematique).
 */

interface ReleveListingStatsProps {
  readonly stats: ReleveListingStats;
}

interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly testId: string;
  readonly valueClasses: string;
}

const SECTION_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4';
const CARD_CLASSES =
  'flex flex-col gap-2 rounded-lg border border-mg-noir/10 bg-white p-6';
const LABEL_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const VALUE_BASE = 'text-4xl font-light tracking-tight tabular-nums';

const VALUE_CLASS_SAISIS = `${VALUE_BASE} text-mg-noir`;
const VALUE_CLASS_ALERTES = `${VALUE_BASE} text-mg-or`;
const VALUE_CLASS_MANQUANTS = `${VALUE_BASE} text-mg-noir/60`;
const VALUE_CLASS_ANNULES = `${VALUE_BASE} italic text-mg-noir/50`;

function StatCard({
  label,
  value,
  testId,
  valueClasses,
}: StatCardProps): React.ReactElement {
  return (
    <article
      className={CARD_CLASSES}
      data-testid={testId}
      aria-label={`${label} : ${value}`}
    >
      <p className={LABEL_CLASSES}>{label}</p>
      <p className={valueClasses} data-testid={`${testId}-value`}>
        {value}
      </p>
    </article>
  );
}

export function ReleveListingStats({
  stats,
}: ReleveListingStatsProps): React.ReactElement {
  return (
    <section
      className={SECTION_CLASSES}
      data-testid="listing-stats"
      role="status"
      aria-live="polite"
      aria-label="Statistiques du listing"
    >
      <StatCard
        label="Saisis"
        value={stats.totalSaisis}
        testId="listing-stats-saisis"
        valueClasses={VALUE_CLASS_SAISIS}
      />
      <StatCard
        label="Alertes"
        value={stats.totalAlertes}
        testId="listing-stats-alertes"
        valueClasses={VALUE_CLASS_ALERTES}
      />
      <StatCard
        label="Manquants"
        value={stats.totalManquants}
        testId="listing-stats-manquants"
        valueClasses={VALUE_CLASS_MANQUANTS}
      />
      <StatCard
        label="Annules"
        value={stats.totalAnnules}
        testId="listing-stats-annules"
        valueClasses={VALUE_CLASS_ANNULES}
      />
    </section>
  );
}
