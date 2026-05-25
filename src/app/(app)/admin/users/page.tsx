import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { UserRole } from '@prisma/client';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from '@/components/features/admin/AdminDataTable';
import { Pagination } from '@/components/features/admin/Pagination';
import { UserToggleActiveButton } from '@/components/features/admin/UserToggleActiveButton';
import { PrimaryLinkButton } from '@/components/features/admin/PrimaryLinkButton';
import { StatusBadge } from '@/components/features/admin/StatusBadge';
import { listUsers } from '@/lib/services/user.service';
import { paginationQuerySchema } from '@/lib/validations/admin';
import { ADMIN_PAGE_SIZE } from '@/lib/constants/admin';
import { USER_ROLE_LABELS } from '@/lib/constants/user-labels';
import type { UserListItem } from '@/types/admin';

export const metadata: Metadata = {
  title: 'Utilisateurs - Administration HACCP',
};

interface UsersPageProps {
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly pageSize?: string;
    readonly role?: string;
    readonly includeInactive?: string;
  }>;
}

const SECONDARY_LINK_CLASSES =
  'inline-flex h-11 w-44 items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const ROLE_BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';
const FILTER_FORM_CLASSES =
  'mb-6 flex flex-wrap items-center gap-3 border border-mg-noir/10 bg-mg-ivoire px-4 py-3';
const FILTER_SELECT_CLASSES =
  'rounded-none border border-mg-noir/15 bg-mg-ivoire px-3 py-2 text-sm font-light text-mg-noir focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or';

const ROLE_BADGE_CLASSES: Readonly<Record<UserRole, string>> = {
  SALARIE: 'border-mg-noir/30 text-mg-noir/70',
  RESPONSABLE: 'border-mg-noir/40 text-mg-noir',
  ADMIN: 'border-mg-or/50 text-mg-or',
} as const;

const ROLE_FILTER_VALUES: readonly UserRole[] = [
  'SALARIE',
  'RESPONSABLE',
  'ADMIN',
] as const;

function buildPaginationBaseHref(
  role: UserRole | undefined,
  includeInactive: boolean
): string {
  const params = new URLSearchParams();
  if (role) {
    params.set('role', role);
  }
  if (includeInactive) {
    params.set('includeInactive', 'true');
  }
  const query = params.toString();
  return query ? `/admin/users?${query}` : '/admin/users';
}

function buildToggleInactiveHref(
  role: UserRole | undefined,
  includeInactive: boolean
): Route {
  const params = new URLSearchParams();
  if (role) {
    params.set('role', role);
  }
  if (!includeInactive) {
    params.set('includeInactive', 'true');
  }
  const query = params.toString();
  return (query ? `/admin/users?${query}` : '/admin/users') as Route;
}

function renderStatusBadge(actif: boolean) {
  return <StatusBadge variant={actif ? 'active' : 'inactive'} />;
}

function renderRoleBadge(role: UserRole) {
  return (
    <span className={`${ROLE_BADGE_BASE} ${ROLE_BADGE_CLASSES[role]}`}>
      {USER_ROLE_LABELS[role]}
    </span>
  );
}

function parseRoleFilter(value: string | undefined): UserRole | undefined {
  if (!value) {
    return undefined;
  }
  return (ROLE_FILTER_VALUES as readonly string[]).includes(value)
    ? (value as UserRole)
    : undefined;
}

function renderBoutiquesCount(row: UserListItem): string {
  if (row.role === 'ADMIN') {
    return 'Toutes';
  }
  if (row.role === 'SALARIE') {
    return row.boutiqueSalarieId ? '1' : '-';
  }
  return String(row.boutiqueIdsResponsable.length);
}

const USER_COLUMNS: readonly AdminDataTableColumn<UserListItem>[] = [
  {
    key: 'email',
    label: 'Email',
    render: (row) => (
      <Link
        href={`/admin/users/${row.id}` as Route}
        className="font-light text-mg-noir transition-colors hover:text-mg-or"
        data-testid={`user-link-${row.id}`}
      >
        {row.email}
      </Link>
    ),
  },
  {
    key: 'name',
    label: 'Nom',
    render: (row) => row.name,
  },
  {
    key: 'role',
    label: 'Role',
    render: (row) => renderRoleBadge(row.role),
  },
  {
    key: 'boutiques',
    label: 'Boutiques',
    align: 'right',
    render: (row) => renderBoutiquesCount(row),
  },
  {
    key: 'actif',
    label: 'Statut',
    render: (row) => renderStatusBadge(row.actif),
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    render: (row) => (
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/admin/users/${row.id}` as Route}
          className={SECONDARY_LINK_CLASSES}
          data-testid={`user-edit-${row.id}`}
        >
          Detail
        </Link>
        <UserToggleActiveButton
          userId={row.id}
          userLabel={row.email}
          actif={row.actif}
        />
      </div>
    ),
  },
];

/**
 * Liste paginee des utilisateurs (Server Component, US-ADM-003).
 *
 * Le layout `(app)/admin/layout.tsx` garantit auth + role ADMIN. La
 * query string est parsee via Zod ; le filtre role est restreint a
 * un whitelist d'enum pour rejeter les valeurs hostiles.
 */
export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const resolvedParams = await searchParams;
  const parsed = paginationQuerySchema.safeParse({
    page: resolvedParams.page,
    pageSize: resolvedParams.pageSize,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: ADMIN_PAGE_SIZE };

  const includeInactive = resolvedParams.includeInactive === 'true';
  const roleFilter = parseRoleFilter(resolvedParams.role);

  // Le filtre `role` est pousse au WHERE Prisma (cf. user.service)
  // pour que la pagination s'applique aux items filtres. Auparavant
  // le filtre etait applique en memoire APRES pagination ce qui
  // produisait des pages qui semblaient vides.
  const result = await listUsers({ query, role: roleFilter, includeInactive });

  const toggleInactiveHref = buildToggleInactiveHref(
    roleFilter,
    includeInactive
  );
  const toggleInactiveLabel = includeInactive
    ? 'Cacher inactifs'
    : 'Voir inactifs';

  return (
    <div data-testid="admin-users-page">
      <AdminPageHeader
        title="Utilisateurs"
        subtitle="Gerer les comptes des salaries, responsables et administrateurs."
        actions={
          <>
            <Link
              href={toggleInactiveHref}
              className={SECONDARY_LINK_CLASSES}
              data-testid="user-toggle-inactive"
            >
              {toggleInactiveLabel}
            </Link>
            <PrimaryLinkButton
              href={'/admin/users/inviter' as Route}
              data-testid="user-invite-link"
            >
              + Inviter un utilisateur
            </PrimaryLinkButton>
          </>
        }
      />

      <form
        method="get"
        action="/admin/users"
        className={FILTER_FORM_CLASSES}
        aria-label="Filtrer par role"
        data-testid="user-filter-form"
      >
        <label
          htmlFor="filter-role"
          className="text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/70"
        >
          Role
        </label>
        <select
          id="filter-role"
          name="role"
          defaultValue={roleFilter ?? ''}
          className={FILTER_SELECT_CLASSES}
          data-testid="user-filter-role"
        >
          <option value="">Tous les roles</option>
          {ROLE_FILTER_VALUES.map((opt) => (
            <option key={opt} value={opt}>
              {USER_ROLE_LABELS[opt]}
            </option>
          ))}
        </select>
        {includeInactive ? (
          <input type="hidden" name="includeInactive" value="true" />
        ) : null}
        <button
          type="submit"
          className={SECONDARY_LINK_CLASSES}
          data-testid="user-filter-submit"
        >
          Filtrer
        </button>
      </form>

      <AdminDataTable
        name="users"
        columns={USER_COLUMNS}
        rows={result.items}
        getRowId={(row) => row.id}
        empty="Aucun utilisateur a afficher. Cliquez sur '+ Inviter un utilisateur' pour en ajouter un."
        caption="Liste des utilisateurs"
      />

      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={buildPaginationBaseHref(roleFilter, includeInactive)}
      />
    </div>
  );
}
