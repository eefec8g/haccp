import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
}

/**
 * En-tete d'une page admin (Server Component).
 *
 * Titre + sous-titre a gauche, slot `actions` a droite (boutons
 * "Creer", filtres globaux...). Reste pur SC : aucune logique client.
 */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="admin-page-header"
    >
      <div>
        <h1 className="text-2xl font-bold text-[#2A3547]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[#5A6A85]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
