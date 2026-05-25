import Link from 'next/link';
import type { Metadata } from 'next';
import type { Route } from 'next';
import type { TypeEquipement } from '@prisma/client';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from '@/components/features/admin/AdminDataTable';
import { Pagination } from '@/components/features/admin/Pagination';
import { PrimaryLinkButton } from '@/components/features/admin/PrimaryLinkButton';
import { EquipementBoutiqueFilter } from '@/components/features/admin/EquipementBoutiqueFilter';
import { EquipementToggleActiveButton } from '@/components/features/admin/EquipementToggleActiveButton';
import { listEquipements } from '@/lib/services/equipement.service';
import { listBoutiques } from '@/lib/services/boutique.service';
import { paginationQuerySchema } from '@/lib/validations/admin';
import { ADMIN_PAGE_SIZE } from '@/lib/constants/admin';
import type { EquipementListItem } from '@/types/admin';

export const metadata: Metadata = {
  title: 'Equipements - Administration HACCP',
};

interface EquipementsPageProps {
  readonly searchParams: Promise<{
    readonly page?: string;
    readonly pageSize?: string;
    readonly boutiqueId?: string;
    readonly includeInactive?: string;
  }>;
}

const SECONDARY_LINK_CLASSES =
  'inline-flex h-11 w-44 items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const STATUS_BADGE_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em]';
const STATUS_ACTIVE_CLASSES = `${STATUS_BADGE_BASE} border-mg-or/40 text-mg-or`;
const STATUS_INACTIVE_CLASSES = `${STATUS_BADGE_BASE} border-mg-noir/20 text-mg-noir/50`;
const TYPE_BADGE_BASE =
  'inline-flex items-center rounded-full border border-mg-or/40 px-3 py-1 text-[10px] font-light uppercase tracking-[0.2em] text-mg-or';

const TYPE_LABELS: Readonly<Record<TypeEquipement, string>> = {
  CONGELATEUR: 'Congelateur',
  VITRINE: 'Vitrine refrigeree',
  CHAMBRE_FROIDE: 'Chambre froide',
  AUTRE: 'Autre',
} as const;

// Type badges en or uniforme (charte MG : pas de palette multicolore).
// La differenciation visuelle entre types se fait par le label texte.

function buildPaginationBaseHref(
  boutiqueId: string | undefined,
  includeInactive: boolean
): string {
  const params = new URLSearchParams();
  if (boutiqueId) {
    params.set('boutiqueId', boutiqueId);
  }
  if (includeInactive) {
    params.set('includeInactive', 'true');
  }
  const query = params.toString();
  return query ? `/admin/equipements?${query}` : '/admin/equipements';
}

function buildToggleInactiveHref(
  boutiqueId: string | undefined,
  includeInactive: boolean
): Route {
  const params = new URLSearchParams();
  if (boutiqueId) {
    params.set('boutiqueId', boutiqueId);
  }
  if (!includeInactive) {
    params.set('includeInactive', 'true');
  }
  const query = params.toString();
  return (
    query ? `/admin/equipements?${query}` : '/admin/equipements'
  ) as Route;
}

function buildCreateHref(boutiqueId: string | undefined): Route {
  return (
    boutiqueId
      ? `/admin/equipements/nouveau?boutiqueId=${boutiqueId}`
      : '/admin/equipements/nouveau'
  ) as Route;
}

function renderStatusBadge(actif: boolean) {
  return (
    <span className={actif ? STATUS_ACTIVE_CLASSES : STATUS_INACTIVE_CLASSES}>
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

function renderTypeBadge(type: TypeEquipement) {
  return <span className={TYPE_BADGE_BASE}>{TYPE_LABELS[type]}</span>;
}

const EQUIPEMENT_COLUMNS: readonly AdminDataTableColumn<EquipementListItem>[] =
  [
    {
      key: 'nom',
      label: 'Nom',
      render: (row) => (
        <Link
          href={`/admin/equipements/${row.id}` as Route}
          className="font-light uppercase tracking-[0.15em] text-mg-noir transition-colors hover:text-mg-or"
          data-testid={`equipement-link-${row.id}`}
        >
          {row.nom}
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => renderTypeBadge(row.type),
    },
    {
      key: 'boutique',
      label: 'Boutique',
      render: (row) => row.boutiqueNom,
    },
    {
      key: 'seuils',
      label: 'Seuils',
      align: 'right',
      render: (row) => `${row.seuilMin}°C / ${row.seuilMax}°C`,
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
            href={`/admin/equipements/${row.id}` as Route}
            className={SECONDARY_LINK_CLASSES}
            data-testid={`equipement-edit-${row.id}`}
          >
            Editer
          </Link>
          <EquipementToggleActiveButton
            equipementId={row.id}
            equipementNom={row.nom}
            actif={row.actif}
          />
        </div>
      ),
    },
  ];

/**
 * Liste paginee des equipements (Server Component, US-ADM-002).
 *
 * Le layout `(app)/admin/layout.tsx` garantit auth + role ADMIN. La
 * query string est parsee via Zod (defenses contre `?page=abc`). Le
 * filtre `boutiqueId` est valide en verifiant que la boutique existe
 * (sinon le filtre est ignore pour ne pas masquer toute la liste).
 */
export default async function AdminEquipementsPage({
  searchParams,
}: EquipementsPageProps) {
  const resolvedParams = await searchParams;
  const parsed = paginationQuerySchema.safeParse({
    page: resolvedParams.page,
    pageSize: resolvedParams.pageSize,
  });
  const query = parsed.success
    ? parsed.data
    : { page: 1, pageSize: ADMIN_PAGE_SIZE };

  const includeInactive = resolvedParams.includeInactive === 'true';

  // On charge toutes les boutiques actives pour le selecteur de filtre.
  // pageSize=200 couvre largement le parc Maison Givre.
  const boutiquesResult = await listBoutiques({
    query: { page: 1, pageSize: 200 },
  });
  const boutiqueOptions = boutiquesResult.items;
  const validBoutiqueId =
    resolvedParams.boutiqueId &&
    boutiqueOptions.some((b) => b.id === resolvedParams.boutiqueId)
      ? resolvedParams.boutiqueId
      : undefined;

  const result = await listEquipements({
    query,
    boutiqueId: validBoutiqueId,
    includeInactive,
  });

  const toggleInactiveHref = buildToggleInactiveHref(
    validBoutiqueId,
    includeInactive
  );
  const toggleInactiveLabel = includeInactive
    ? 'Cacher inactives'
    : 'Voir inactives';

  return (
    <div data-testid="admin-equipements-page">
      <AdminPageHeader
        title="Equipements"
        subtitle="Gerer les equipements frigorifiques par boutique."
        actions={
          <>
            <Link
              href={toggleInactiveHref}
              className={SECONDARY_LINK_CLASSES}
              data-testid="equipement-toggle-inactive"
            >
              {toggleInactiveLabel}
            </Link>
            <PrimaryLinkButton
              href={buildCreateHref(validBoutiqueId)}
              data-testid="equipement-create-link"
            >
              + Nouvel equipement
            </PrimaryLinkButton>
          </>
        }
      />

      <EquipementBoutiqueFilter
        boutiques={boutiqueOptions}
        currentBoutiqueId={validBoutiqueId ?? null}
        includeInactive={includeInactive}
      />

      <AdminDataTable
        name="equipements"
        columns={EQUIPEMENT_COLUMNS}
        rows={result.items}
        getRowId={(row) => row.id}
        empty="Aucun equipement pour le moment. Cliquez sur '+ Nouvel equipement' pour en creer un."
        caption="Liste des equipements"
      />

      <Pagination
        currentPage={result.page}
        totalPages={result.totalPages}
        baseHref={buildPaginationBaseHref(validBoutiqueId, includeInactive)}
      />
    </div>
  );
}
