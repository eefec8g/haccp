import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';

/**
 * En-tete partage des pages Epic RELEVE+ALERTE (Server Component).
 *
 * Extrait pour eliminer la duplication des 7 constantes de styles
 * (`HEADER_CLASSES`, `TITLE_CLASSES`, `EYEBROW_CLASSES`,
 * `DIVIDER_CLASSES`, `SUBTITLE_CLASSES`, `SECTION_CLASSES`,
 * `BACK_LINK_CLASSES`) qui etaient redondantes entre 4 pages.
 *
 * Charte Maison Givre sobre :
 *   - eyebrow uppercase tracking-[0.3em] mg-or (10px),
 *   - title font-light tracking-[0.2em] uppercase mg-noir (2xl/3xl),
 *   - divider or 48px (h-px w-12),
 *   - subtitle font-light text-mg-noir/60,
 *   - back link discret avec chevron, hover mg-or.
 *
 * Pas de `'use client'` : aucune interaction, juste un layout statique
 * + un `Link` Next.js (toujours utilisable cote serveur).
 */

interface AppPageHeaderProps {
  /** Titre principal de la page (uppercased par la charte). */
  readonly title: string;
  /** Surtitre optionnel en or (ex: "MAISON GIVRE - CORRECTION HACCP"). */
  readonly eyebrow?: string;
  /** Sous-titre optionnel sous le divider or. */
  readonly subtitle?: string | ReactNode;
  /** Cible du lien retour (typed Route). Sans valeur, pas de lien rendu. */
  readonly backHref?: Route;
  /** Libelle du lien retour (defaut : "Retour"). */
  readonly backLabel?: string;
  /** Slot d'actions a droite (boutons CTA, filtres). */
  readonly children?: ReactNode;
  /** `data-testid` du header pour ciblage e2e. */
  readonly testId?: string;
}

const HEADER_CLASSES =
  'flex flex-col gap-4 border-b border-mg-noir/10 bg-mg-ivoire px-6 py-8 sm:px-10';
const TITLE_CLASSES =
  'mt-2 text-2xl font-light uppercase tracking-[0.2em] text-mg-noir sm:text-3xl';
const EYEBROW_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.3em] text-mg-or';
const DIVIDER_CLASSES = 'mt-4 inline-block h-px w-12 bg-mg-or';
const SUBTITLE_CLASSES = 'mt-4 text-sm font-light text-mg-noir/60';
const BACK_LINK_CLASSES =
  'inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:text-mg-or';
/**
 * Layout mobile-first : on empile le bloc titre + le bloc actions par
 * defaut (gap-6) puis on revient sur la disposition desktop (row +
 * wrap + justify-between) a partir de `sm:` (>= 640px). Sans ce
 * fix, plusieurs actions a droite poussaient le bloc en dessous du
 * titre avec un alignement central peu lisible sur viewport etroit.
 */
const ROW_CLASSES =
  'flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between';

export function AppPageHeader({
  title,
  eyebrow,
  subtitle,
  backHref,
  backLabel = 'Retour',
  children,
  testId,
}: AppPageHeaderProps) {
  return (
    <header className={HEADER_CLASSES} data-testid={testId}>
      {backHref ? (
        <Link
          href={backHref}
          className={BACK_LINK_CLASSES}
          data-testid={testId ? `${testId}-back` : undefined}
        >
          &larr; {backLabel}
        </Link>
      ) : null}
      <div className={children ? ROW_CLASSES : undefined}>
        <div>
          {eyebrow ? <p className={EYEBROW_CLASSES}>{eyebrow}</p> : null}
          <h1 className={TITLE_CLASSES}>{title}</h1>
          <span aria-hidden="true" className={DIVIDER_CLASSES} />
          {subtitle ? <p className={SUBTITLE_CLASSES}>{subtitle}</p> : null}
        </div>
        {children ? (
          <div className="flex flex-wrap items-center gap-3">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
