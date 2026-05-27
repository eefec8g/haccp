import type { ReactNode } from 'react';
import type { Route } from 'next';
import Link from 'next/link';

/**
 * KpiCard - Encart d'un KPI cle du dashboard (Server Component).
 *
 * Charte Maison Givre sobre :
 *   - eyebrow uppercase or (10px tracking-[0.3em]),
 *   - chiffre tres grand font-light tracking-tight,
 *   - description font-light en mg-noir/60.
 *
 * Si `href` fourni, la carte devient cliquable (Link Next.js) avec
 * hover/focus or pour signaler l'interaction. a11y : focus visible ring
 * or, aria-label calcule a partir du titre + description.
 */

interface KpiCardProps {
  /** Libelle court du KPI (ex: "Conformite jour"). */
  readonly title: string;
  /** Valeur principale a mettre en avant. */
  readonly value: string | number;
  /** Description optionnelle sous la valeur. */
  readonly description?: string;
  /** Lien de drill-down vers la page associee (typed Route). */
  readonly href?: Route;
  /** `data-testid` du wrapper (defaut : kpi-card). */
  readonly testId?: string;
  /** Icone/picto optionnel rendu a gauche du titre. */
  readonly icon?: ReactNode;
}

const CARD_BASE_CLASSES =
  'flex flex-col gap-3 rounded-lg border border-mg-noir/10 bg-white p-6';
const CARD_LINK_CLASSES =
  'transition-colors hover:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const HEADER_CLASSES = 'flex items-center gap-2';
const EYEBROW_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.3em] text-mg-or';
const VALUE_CLASSES =
  'text-4xl font-light tracking-tight text-mg-noir tabular-nums';
const DESCRIPTION_CLASSES = 'text-xs font-light text-mg-noir/60';

export function KpiCard({
  title,
  value,
  description,
  href,
  testId,
  icon,
}: KpiCardProps) {
  const ariaLabel = description
    ? `${title} : ${value}. ${description}`
    : `${title} : ${value}`;
  const dataTestId = testId ?? 'kpi-card';

  const content = (
    <>
      <div className={HEADER_CLASSES}>
        {icon ? (
          <span aria-hidden="true" className="text-mg-or">
            {icon}
          </span>
        ) : null}
        <p className={EYEBROW_CLASSES}>{title}</p>
      </div>
      <p className={VALUE_CLASSES} data-testid={`${dataTestId}-value`}>
        {value}
      </p>
      {description ? (
        <p className={DESCRIPTION_CLASSES}>{description}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${CARD_BASE_CLASSES} ${CARD_LINK_CLASSES}`}
        data-testid={dataTestId}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className={CARD_BASE_CLASSES}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    >
      {content}
    </article>
  );
}
