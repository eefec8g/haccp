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

const PRIMARY_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const SECONDARY_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-1.5 text-sm font-medium text-[#5D87FF] transition-colors hover:bg-[#ECF2FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';
const STATUS_ACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#E6FBF6] px-3 py-1 text-xs font-semibold text-[#0F9F86]';
const STATUS_INACTIVE_CLASSES =
  'inline-flex items-center rounded-full bg-[#F1F4F9] px-3 py-1 text-xs font-semibold text-[#5A6A85]';
const TYPE_BADGE_BASE =
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
const FILTER_FORM_CLASSES =
  'mb-4 flex flex-wrap items-center gap-2 rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3';
const FILTER_SELECT_CLASSES =
  'rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-2 text-sm text-[#2A3547] focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF]';

const TYPE_LABELS: Readonly<Record<TypeEquipement, string>> = {
  CONGELATEUR: 'Congelateur',
  VITRINE: 'Vitrine refrigeree',
  CHAMBRE_FROIDE: 'Chambre froide',
  AUTRE: 'Autre',
} as const;

const TYPE_BADGE_CLASSES: Readonly<Record<TypeEquipement, string>> = {
  CONGELATEUR: 'bg-[#ECF2FF] text-[#5D87FF]',
  VITRINE: 'bg-[#F3E8FF] text-[#7A5AF8]',
  CHAMBRE_FROIDE: 'bg-[#E6FBF6] text-[#0F9F86]',
  AUTRE: 'bg-[#F1F4F9] text-[#5A6A85]',
} as const;

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
  return (
    <span className={`${TYPE_BADGE_BASE} ${TYPE_BADGE_CLASSES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

const EQUIPEMENT_COLUMNS: readonly AdminDataTableColumn<EquipementListItem>[] =
  [
    {
      key: 'nom',
      label: 'Nom',
      render: (row) => (
        <Link
          href={`/admin/equipements/${row.id}` as Route}
          className="font-medium text-[#5D87FF] hover:text-[#4570e6]"
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
            <Link
              href={buildCreateHref(validBoutiqueId)}
              className={PRIMARY_LINK_CLASSES}
              data-testid="equipement-create-link"
            >
              + Nouvel equipement
            </Link>
          </>
        }
      />

      <form
        method="get"
        action="/admin/equipements"
        className={FILTER_FORM_CLASSES}
        aria-label="Filtrer par boutique"
        data-testid="equipement-filter-form"
      >
        <label htmlFor="filter-boutique" className="text-sm text-[#5A6A85]">
          Boutique :
        </label>
        <select
          id="filter-boutique"
          name="boutiqueId"
          defaultValue={validBoutiqueId ?? ''}
          className={FILTER_SELECT_CLASSES}
          data-testid="equipement-filter-boutique"
        >
          <option value="">Toutes les boutiques</option>
          {boutiqueOptions.map((boutique) => (
            <option key={boutique.id} value={boutique.id}>
              {boutique.ville
                ? `${boutique.nom} - ${boutique.ville}`
                : boutique.nom}
            </option>
          ))}
        </select>
        {includeInactive ? (
          <input type="hidden" name="includeInactive" value="true" />
        ) : null}
        <button
          type="submit"
          className={SECONDARY_LINK_CLASSES}
          data-testid="equipement-filter-submit"
        >
          Filtrer
        </button>
      </form>

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
