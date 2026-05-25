import type { ReactNode } from 'react';

/**
 * Badge de statut Actif / Inactif partage par les pages admin et
 * les detail pages (boutique, equipement, user).
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

const STATUS_ACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#E6FBF6] px-3 py-1 text-xs font-semibold text-[#0F9F86]';
const STATUS_INACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#F1F4F9] px-3 py-1 text-xs font-semibold text-[#5A6A85]';

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
