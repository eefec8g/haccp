import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from '@/components/features/admin/AdminDataTable';
import { Pagination } from '@/components/features/admin/Pagination';
import { listAuditLogs } from '@/lib/services/audit-log.service';
import { auditQuerySchema } from '@/lib/validations/audit';
import { ADMIN_PAGE_SIZE } from '@/lib/constants/admin';
import type { AuditLogListItem } from '@/types/audit';

export const metadata: Metadata = {
  title: "Journal d'audit - Administration HACCP",
};

interface AuditLogPageProps {
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly pageSize?: string;
    readonly entityType?: string;
    readonly action?: string;
  }>;
}

const FILTER_LINK_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/20 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const FILTER_LINK_ACTIVE =
  'inline-flex items-center justify-center border border-mg-or bg-mg-or px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

const BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';

const ACTION_BADGE: Readonly<Record<AuditAction, string>> = {
  CREATE: `${BADGE_BASE} border-mg-or/40 text-mg-or`,
  UPDATE: `${BADGE_BASE} border-mg-noir/20 text-mg-noir/70`,
  DISABLE: `${BADGE_BASE} border-mg-noir/30 text-mg-noir`,
  ENABLE: `${BADGE_BASE} border-mg-or/40 text-mg-or`,
  DELETE: `${BADGE_BASE} border-mg-noir/30 text-mg-noir`,
  EXPORT: `${BADGE_BASE} border-mg-or/40 text-mg-or`,
};

const ENTITY_LABEL: Readonly<Record<AuditEntityType, string>> = {
  BOUTIQUE: 'Boutique',
  EQUIPEMENT: 'Equipement',
  USER: 'Utilisateur',
  INVITATION: 'Invitation',
  EXPORT: 'Export',
};

const ENTITY_TYPES: readonly AuditEntityType[] = [
  'BOUTIQUE',
  'EQUIPEMENT',
  'USER',
  'INVITATION',
  'EXPORT',
];

const PARIS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', PARIS_DATE_FORMAT).format(date);
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

const AUDIT_COLUMNS: readonly AdminDataTableColumn<AuditLogListItem>[] = [
  {
    key: 'createdAt',
    label: 'Date',
    render: (row) => (
      <span
        className="font-light text-mg-noir/80"
        data-testid={`audit-row-${row.id}-date`}
      >
        {formatDate(row.createdAt)}
      </span>
    ),
  },
  {
    key: 'action',
    label: 'Action',
    render: (row) => (
      <span
        className={ACTION_BADGE[row.action]}
        data-testid={`audit-row-${row.id}-action`}
      >
        {row.action}
      </span>
    ),
  },
  {
    key: 'entity',
    label: 'Entite',
    render: (row) => (
      <span data-testid={`audit-row-${row.id}-entity`}>
        <span className="font-light text-mg-noir">
          {ENTITY_LABEL[row.entityType]}
        </span>
        {row.entityLabel ? (
          <span className="ml-1 font-light text-mg-noir/60">
            {' '}
            : {row.entityLabel}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: 'motif',
    label: 'Motif',
    render: (row) =>
      row.motif ? (
        <span
          className="font-light text-mg-noir/60"
          title={row.motif}
          data-testid={`audit-row-${row.id}-motif`}
        >
          {truncate(row.motif, 80)}
        </span>
      ) : (
        <span className="text-mg-noir/30">-</span>
      ),
  },
  {
    key: 'performedBy',
    label: 'Effectue par',
    render: (row) => (
      <span data-testid={`audit-row-${row.id}-actor`}>
        <span className="font-light text-mg-noir">{row.performedByName}</span>
        <span className="ml-1 text-xs font-light text-mg-noir/50">
          ({row.performedByEmail})
        </span>
      </span>
    ),
  },
];

function buildFilterHref(entityType?: AuditEntityType): Route {
  return entityType
    ? (`/admin/audit-log?entityType=${entityType}` as Route)
    : ('/admin/audit-log' as Route);
}

function buildPaginationBaseHref(entityType?: AuditEntityType): string {
  return entityType
    ? `/admin/audit-log?entityType=${entityType}`
    : '/admin/audit-log';
}

/**
 * Page liste du journal d'audit (US-ADM-004).
 *
 * Layout `(app)/admin/layout.tsx` garantit deja auth + role ADMIN.
 * Pas de mutation ici : lecture seule. Filtrage par entityType via
 * query string (defense Zod contre les valeurs invalides).
 */
export default async function AdminAuditLogPage({
  searchParams,
}: AuditLogPageProps) {
  const resolvedParams = await searchParams;
  const parsed = auditQuerySchema.safeParse(resolvedParams);
  const filters = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: ADMIN_PAGE_SIZE,
        entityType: undefined,
        action: undefined,
        entityId: undefined,
        performedById: undefined,
      };

  const result = await listAuditLogs({
    query: { page: filters.page, pageSize: filters.pageSize },
    entityType: filters.entityType,
    action: filters.action,
    entityId: filters.entityId,
    performedById: filters.performedById,
  });

  return (
    <div data-testid="admin-audit-log-page">
      <AdminPageHeader
        title="Journal d'audit"
        subtitle="Historique des actions admin (creations, desactivations, reactivations). Tracabilite HACCP."
      />

      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        data-testid="admin-audit-log-filters"
      >
        <Link
          href={buildFilterHref(undefined)}
          className={
            filters.entityType === undefined
              ? FILTER_LINK_ACTIVE
              : FILTER_LINK_CLASSES
          }
          data-testid="audit-filter-all"
        >
          Toutes
        </Link>
        {ENTITY_TYPES.map((type) => (
          <Link
            key={type}
            href={buildFilterHref(type)}
            className={
              filters.entityType === type
                ? FILTER_LINK_ACTIVE
                : FILTER_LINK_CLASSES
            }
            data-testid={`audit-filter-${type.toLowerCase()}`}
          >
            {ENTITY_LABEL[type]}
          </Link>
        ))}
      </div>

      <AdminDataTable
        name="audit-log"
        columns={AUDIT_COLUMNS}
        rows={result.items}
        getRowId={(row) => row.id}
        empty="Aucune entree pour ce filtre."
        caption="Journal d'audit des actions administratives"
      />

      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={buildPaginationBaseHref(filters.entityType)}
      />
    </div>
  );
}
