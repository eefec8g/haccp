/**
 * Indicateur "actif / annule / alerte" pour un releve dans un listing
 * historique (US-REL-003, US-REL-004 lecture).
 *
 * Server Component, pas d'interactivite. La palette MG ne contient
 * pas de rouge : on signale l'alerte en or plein, l'annulation en
 * teinte attenu, l'actif en liseret or.
 */

export type ReleveStatusVariant = 'ACTIF' | 'ALERTE' | 'ANNULE';

interface ReleveStatusIndicatorProps {
  readonly variant: ReleveStatusVariant;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

const BASE_CLASSES =
  'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em]';

const VARIANT_CLASSES: Readonly<Record<ReleveStatusVariant, string>> = {
  ACTIF: 'border border-mg-or/40 bg-transparent text-mg-or',
  ALERTE: 'border border-mg-or bg-mg-or text-mg-noir',
  ANNULE:
    'border border-mg-noir/20 bg-transparent text-mg-noir/50 line-through',
} as const;

const VARIANT_LABELS: Readonly<Record<ReleveStatusVariant, string>> = {
  ACTIF: 'Actif',
  ALERTE: 'Alerte',
  ANNULE: 'Annule',
} as const;

export function ReleveStatusIndicator({
  variant,
  className,
  'data-testid': dataTestid,
}: ReleveStatusIndicatorProps) {
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span
      className={classes}
      data-testid={dataTestid ?? `releve-status-${variant.toLowerCase()}`}
    >
      {VARIANT_LABELS[variant]}
    </span>
  );
}
