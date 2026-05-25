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
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5D87FF] transition-colors hover:bg-[#ECF2FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const FILTER_LINK_ACTIVE =
  'inline-flex items-center justify-center rounded-[7px] border border-[#5D87FF] bg-[#5D87FF] px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

const ACTION_BADGE: Readonly<Record<AuditAction, string>> = {
  CREATE:
    'inline-flex items-center rounded-full bg-[#E6FBF6] px-3 py-1 text-xs font-semibold text-[#0F9F86]',
  UPDATE:
    'inline-flex items-center rounded-full bg-[#ECF2FF] px-3 py-1 text-xs font-semibold text-[#5D87FF]',
  DISABLE:
    'inline-flex items-center rounded-full bg-[#FFF0EC] px-3 py-1 text-xs font-semibold text-[#FA896B]',
  ENABLE:
    'inline-flex items-center rounded-full bg-[#E6FBF6] px-3 py-1 text-xs font-semibold text-[#0F9F86]',
  DELETE:
    'inline-flex items-center rounded-full bg-[#FFF0EC] px-3 py-1 text-xs font-semibold text-[#FA896B]',
};

const ENTITY_LABEL: Readonly<Record<AuditEntityType, string>> = {
  BOUTIQUE: 'Boutique',
  EQUIPEMENT: 'Equipement',
  USER: 'Utilisateur',
  INVITATION: 'Invitation',
};

const ENTITY_TYPES: readonly AuditEntityType[] = [
  'BOUTIQUE',
  'EQUIPEMENT',
  'USER',
  'INVITATION',
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
      <span className="text-[#2A3547]" data-testid={`audit-row-${row.id}-date`}>
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
        <span className="font-medium text-[#2A3547]">
          {ENTITY_LABEL[row.entityType]}
        </span>
        {row.entityLabel ? (
          <span className="ml-1 text-[#5A6A85]"> : {row.entityLabel}</span>
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
          className="text-[#5A6A85]"
          title={row.motif}
          data-testid={`audit-row-${row.id}-motif`}
        >
          {truncate(row.motif, 80)}
        </span>
      ) : (
        <span className="text-[#9AA5B5]">-</span>
      ),
  },
  {
    key: 'performedBy',
    label: 'Effectue par',
    render: (row) => (
      <span data-testid={`audit-row-${row.id}-actor`}>
        <span className="font-medium text-[#2A3547]">
          {row.performedByName}
        </span>
        <span className="ml-1 text-xs text-[#5A6A85]">
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
