import type { ReactNode } from 'react';

/**
 * Badge de statut Actif / Inactif partage par les pages admin et
 * les detail pages (boutique, equipement, user).
 *
 * Charte Maison Givre : pill rounded en capitales tres espacees, fond
 * transparent + liseret. L'or signale l'etat actif (accent universel),
 * le gris noir signale les etats neutres / inactifs. Pas de
 * rouge/vert/jaune dans la palette MG.
 *
 * Factorise les classes Tailwind dupliquees (DRY, Clean Code #4).
 * Server Component (rendu serveur uniquement, pas d'interactivite).
 */
type StatusBadgeVariant = 'active' | 'inactive';

interface StatusBadgeProps {
  readonly variant: StatusBadgeVariant;
  readonly children?: ReactNode;
  readonly 'data-testid'?: string;
}

const BADGE_BASE =
  'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em]';
const STATUS_ACTIVE_CLASSES = `${BADGE_BASE} border border-mg-or/40 bg-transparent text-mg-or`;
const STATUS_INACTIVE_CLASSES = `${BADGE_BASE} border border-mg-noir/20 bg-transparent text-mg-noir/50`;

export function StatusBadge({
  variant,
  children,
  'data-testid': dataTestid,
}: StatusBadgeProps) {
  const className =
    variant === 'active' ? STATUS_ACTIVE_CLASSES : STATUS_INACTIVE_CLASSES;
  const label = children ?? (variant === 'active' ? 'Actif' : 'Inactif');
  return (
    <span className={className} data-testid={dataTestid}>
      {label}
    </span>
  );
}
