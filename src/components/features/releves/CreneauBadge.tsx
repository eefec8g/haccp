import type { Creneau } from '@prisma/client';
import { CRENEAU_LABELS } from '@/lib/constants/releve';
import type { CreneauStatus } from '@/types/releve';

/**
 * Petit badge "status creneau" affichable dans une liste ou une carte.
 *
 * Variantes (charte MG, pas de rouge/vert) :
 *   - DONE    : ivoire profond, liseret or (releve OK).
 *   - ALERTE  : or plein, texte noir (releve hors seuils -> attention).
 *   - MISSING : transparent, texte noir attenu (a faire).
 *
 * Server Component, pas d'interactivite.
 */
interface CreneauBadgeProps {
  readonly creneau: Creneau;
  readonly status: CreneauStatus;
  readonly current?: boolean;
  readonly className?: string;
  readonly 'data-testid'?: string;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em]';

const STATUS_CLASSES: Readonly<Record<CreneauStatus, string>> = {
  DONE: 'border border-mg-or/40 bg-transparent text-mg-or',
  ALERTE: 'border border-mg-or bg-mg-or text-mg-noir',
  MISSING: 'border border-mg-noir/20 bg-transparent text-mg-noir/60',
} as const;

const CURRENT_CLASSES = 'ring-1 ring-mg-or';

export function CreneauBadge({
  creneau,
  status,
  current = false,
  className,
  'data-testid': dataTestid,
}: CreneauBadgeProps) {
  const classes = [
    BASE_CLASSES,
    STATUS_CLASSES[status],
    current ? CURRENT_CLASSES : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      role="status"
      aria-label={`${CRENEAU_LABELS[creneau]} - ${status.toLowerCase()}`}
      className={classes}
      data-testid={dataTestid ?? `creneau-badge-${creneau}`}
    >
      {CRENEAU_LABELS[creneau]}
    </span>
  );
}
