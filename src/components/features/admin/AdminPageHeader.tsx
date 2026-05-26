import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
}

/**
 * En-tete d'une page admin (Server Component).
 *
 * Charte Maison Givre : titre h1 en CAPITALES espacees noir, divider
 * fin or sous le titre, sous-titre light gris. Slot `actions` a droite
 * pour les CTA (boutons "+ Nouvelle xxx", filtres globaux).
 */
export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header
      className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
      data-testid="admin-page-header"
    >
      <div>
        <h1 className="text-2xl font-light tracking-[0.2em] text-mg-noir uppercase sm:text-3xl">
          {title}
        </h1>
        <span
          aria-hidden="true"
          className="mt-4 inline-block h-px w-12 bg-mg-or"
        />
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-sm font-light text-mg-noir/60">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
