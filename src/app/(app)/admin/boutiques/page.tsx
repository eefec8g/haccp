import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from '@/components/features/admin/AdminDataTable';
import { Pagination } from '@/components/features/admin/Pagination';
import { PrimaryLinkButton } from '@/components/features/admin/PrimaryLinkButton';
import { BoutiqueToggleActiveButton } from '@/components/features/admin/BoutiqueToggleActiveButton';
import { listBoutiques } from '@/lib/services/boutique.service';
import { paginationQuerySchema } from '@/lib/validations/admin';
import { ADMIN_PAGE_SIZE } from '@/lib/constants/admin';
import type { BoutiqueListItem } from '@/types/admin';

export const metadata: Metadata = {
  title: 'Boutiques - Administration HACCP',
};

interface BoutiquesPageProps {
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly pageSize?: string;
    readonly includeInactive?: string;
  }>;
}

const SECONDARY_LINK_CLASSES =
  'inline-flex h-11 w-44 items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';
const STATUS_ACTIVE_CLASSES = `${BADGE_BASE} border-mg-or/40 text-mg-or`;
const STATUS_INACTIVE_CLASSES = `${BADGE_BASE} border-mg-noir/20 text-mg-noir/50`;

function buildPaginationBaseHref(includeInactive: boolean): string {
  return includeInactive
    ? '/admin/boutiques?includeInactive=true'
    : '/admin/boutiques';
}

function renderStatusBadge(actif: boolean) {
  return (
    <span className={actif ? STATUS_ACTIVE_CLASSES : STATUS_INACTIVE_CLASSES}>
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

const BOUTIQUE_COLUMNS: readonly AdminDataTableColumn<BoutiqueListItem>[] = [
  {
    key: 'nom',
    label: 'Nom',
    render: (row) => (
      <Link
        href={`/admin/boutiques/${row.id}` as Route}
        className="font-light uppercase tracking-[0.15em] text-mg-noir transition-colors hover:text-mg-or"
        data-testid={`boutique-link-${row.id}`}
      >
        {row.nom}
      </Link>
    ),
  },
  {
    key: 'ville',
    label: 'Ville',
    render: (row) => row.ville ?? '-',
  },
  {
    key: 'equipementsCount',
    label: 'Equipements',
    align: 'right',
    render: (row) => row.equipementsCount.toString(),
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
          href={`/admin/boutiques/${row.id}` as Route}
          className={SECONDARY_LINK_CLASSES}
          data-testid={`boutique-edit-${row.id}`}
        >
          Editer
        </Link>
        <BoutiqueToggleActiveButton
          boutiqueId={row.id}
          boutiqueNom={row.nom}
          actif={row.actif}
        />
      </div>
    ),
  },
];

/**
 * Liste paginee des boutiques (Server Component).
 *
 * Le layout `(app)/admin/layout.tsx` garantit deja auth + role ADMIN.
 * On se concentre ici sur le data fetching et l'affichage. La query
 * string est parsee via Zod (defenses contre `?page=abc&pageSize=9999`).
 */
export default async function AdminBoutiquesPage({
  searchParams,
}: BoutiquesPageProps) {
  const resolvedParams = await searchParams;
  const parsed = paginationQuerySchema.safeParse({
    page: resolvedParams.page,
    pageSize: resolvedParams.pageSize,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: ADMIN_PAGE_SIZE };

  const includeInactive = resolvedParams.includeInactive === 'true';

  const result = await listBoutiques({ query, includeInactive });

  const filterHref = includeInactive
    ? ('/admin/boutiques' as Route)
    : ('/admin/boutiques?includeInactive=true' as Route);
  const filterLabel = includeInactive ? 'Cacher inactives' : 'Voir inactives';

  return (
    <div data-testid="admin-boutiques-page">
      <AdminPageHeader
        title="Boutiques"
        subtitle="Gerer le parc des boutiques Maison Givre."
        actions={
          <>
            <Link
              href={filterHref}
              className={SECONDARY_LINK_CLASSES}
              data-testid="boutique-toggle-inactive"
            >
              {filterLabel}
            </Link>
            <PrimaryLinkButton
              href={'/admin/boutiques/nouvelle' as Route}
              data-testid="boutique-create-link"
            >
              + Nouvelle boutique
            </PrimaryLinkButton>
          </>
        }
      />

      <AdminDataTable
        name="boutiques"
        columns={BOUTIQUE_COLUMNS}
        rows={result.items}
        getRowId={(row) => row.id}
        empty="Aucune boutique pour le moment. Cliquez sur '+ Nouvelle boutique' pour en creer une."
        caption="Liste des boutiques"
      />

      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={buildPaginationBaseHref(includeInactive)}
      />
    </div>
  );
}
