import Link from 'next/link';
import type { Route } from 'next';
import type { AuditLogCompactItem } from '@/types/audit';
import { AUDIT_ENTITY_LABEL, PARIS_DATE_FORMAT } from '@/lib/constants/audit';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';

/**
 * AdminAuditLogCompact - Vue condensee des N dernieres entrees du journal
 * d'audit (US-DAS-002).
 *
 * Server Component pur :
 *   - Empty state explicite si aucune entree (texte mg-noir/40),
 *   - Liste verticale : acteur (nom) + action + entite (libelle) + date,
 *   - Lien "Voir tout" -> `/admin/audit-log` (Link Next.js).
 *
 * Pas de hooks, pas d'events : rendu pur depuis les donnees serveur.
 * Le journal d'audit complet reste accessible via `/admin/audit-log`
 * (page paginee). Cette vue n'est qu'un aperu pour l'admin.
 *
 * Note RGPD : utilise `AuditLogCompactItem` (sans email, sans motif) ;
 * la projection cote service evite que ces PII transitent inutilement
 * dans le RSC payload. Cf. `listAuditLogsCompact` dans le service.
 *
 * a11y :
 *   - <section> avec aria-label "Activite recente",
 *   - chaque entree est un <li> dans une <ul> semantique,
 *   - le lien "Voir tout" a un focus visible ring or.
 */

interface AdminAuditLogCompactProps {
  /** Entrees a afficher (deja limitees a la cardinalite voulue). */
  readonly entries: readonly AuditLogCompactItem[];
  /** `data-testid` du wrapper (defaut : admin-audit-log-compact). */
  readonly testId?: string;
}

const SECTION_CLASSES =
  'flex flex-col gap-4 rounded-lg border border-mg-noir/10 bg-white p-6';
const LIST_CLASSES = 'flex flex-col divide-y divide-mg-noir/5';
const ITEM_CLASSES =
  'flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0';
const ACTOR_CLASSES = 'text-sm font-light text-mg-noir';
const META_CLASSES = 'text-xs font-light text-mg-noir/60';
const DATE_CLASSES =
  'ml-auto text-[11px] uppercase tracking-[0.2em] text-mg-noir/50 tabular-nums';
const EMPTY_CLASSES = 'text-sm font-light text-mg-noir/40';
const VIEW_ALL_CLASSES =
  'inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:text-mg-or';

const AUDIT_LOG_HREF = '/admin/audit-log' as Route;

function formatCompactDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', PARIS_DATE_FORMAT).format(date);
}

function buildEntryAriaLabel(entry: AuditLogCompactItem): string {
  const entity = AUDIT_ENTITY_LABEL[entry.entityType];
  const label = entry.entityLabel ? ` ${entry.entityLabel}` : '';
  return `${entry.performedByName} a effectue ${entry.action} sur ${entity}${label}`;
}

export function AdminAuditLogCompact({
  entries,
  testId,
}: AdminAuditLogCompactProps) {
  const dataTestId = testId ?? 'admin-audit-log-compact';
  return (
    <section
      className={SECTION_CLASSES}
      data-testid={dataTestId}
      aria-label="Activite recente"
    >
      <div className="flex items-center justify-between">
        <p className={MG_EYEBROW_CLASSES}>Activite recente</p>
        <Link
          href={AUDIT_LOG_HREF}
          className={VIEW_ALL_CLASSES}
          data-testid={`${dataTestId}-view-all`}
        >
          Voir tout &rarr;
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className={EMPTY_CLASSES} data-testid={`${dataTestId}-empty`}>
          Aucune activite recente.
        </p>
      ) : (
        <ul className={LIST_CLASSES}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={ITEM_CLASSES}
              data-testid={`${dataTestId}-entry-${entry.id}`}
              aria-label={buildEntryAriaLabel(entry)}
            >
              <span className={ACTOR_CLASSES}>{entry.performedByName}</span>
              <span className={META_CLASSES}>
                {entry.action.toLowerCase()}{' '}
                {AUDIT_ENTITY_LABEL[entry.entityType].toLowerCase()}
                {entry.entityLabel ? (
                  <span className="text-mg-noir/80">
                    {' '}
                    : {entry.entityLabel}
                  </span>
                ) : null}
              </span>
              <time
                className={DATE_CLASSES}
                dateTime={entry.createdAt.toISOString()}
              >
                {formatCompactDate(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
