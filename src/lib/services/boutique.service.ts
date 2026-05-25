import { Prisma, type Boutique } from '@prisma/client';
import { db } from '@/lib/prisma';
import type {
  BoutiqueListItem,
  PaginatedResult,
  PaginationQuery,
} from '@/types/admin';
import type { Result } from '@/types/result';
import type {
  BoutiqueCreateInput,
  BoutiqueUpdateInput,
} from '@/lib/validations/admin';
import { logAudit } from '@/lib/services/audit-log.service';
import { buildPaginated } from '@/lib/utils/pagination';

/**
 * Service de gestion des boutiques (admin).
 *
 * Responsabilites :
 *   - CRUD + soft-delete (toggle `actif`) sur Boutique
 *   - Pagination des listings
 *   - Detection de duplicates par (nom + ville) parmi les boutiques
 *     actives (les desactivees peuvent partager le nom historique)
 *
 * Conventions :
 *   - Pas d'auth check ici : delegue a l'API/Server Action appelante
 *     (separation des couches).
 *   - Result<T, E> pour les erreurs metier (Clean Code #7).
 */

export type BoutiqueError = 'NOT_FOUND' | 'INVALID' | 'DUPLICATE';

interface ListBoutiquesArgs {
  readonly query: PaginationQuery;
  readonly includeInactive?: boolean;
}

function mapBoutique(
  row: Boutique & { readonly _count: { readonly equipements: number } }
): BoutiqueListItem {
  return {
    id: row.id,
    nom: row.nom,
    adresse: row.adresse,
    ville: row.ville,
    actif: row.actif,
    createdAt: row.createdAt,
    equipementsCount: row._count.equipements,
  };
}

/**
 * Liste paginee des boutiques. Par defaut on ne renvoie que les actives.
 * `includeInactive=true` reserve aux admins (consulter l'historique).
 */
export async function listBoutiques({
  query,
  includeInactive = false,
}: ListBoutiquesArgs): Promise<PaginatedResult<BoutiqueListItem>> {
  const where: Prisma.BoutiqueWhereInput = includeInactive
    ? {}
    : { actif: true };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.boutique.findMany({
      where,
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
      skip,
      take: query.pageSize,
      include: { _count: { select: { equipements: true } } },
    }),
    db.boutique.count({ where }),
  ]);
  return buildPaginated(rows.map(mapBoutique), total, query);
}

export async function getBoutiqueById(
  id: string
): Promise<Result<Boutique, 'NOT_FOUND'>> {
  const boutique = await db.boutique.findUnique({ where: { id } });
  if (!boutique) {
    return { success: false, error: 'NOT_FOUND' };
  }
  return { success: true, data: boutique };
}

/**
 * Projection legere des boutiques pour les selecteurs (formulaires
 * d'invitation/equipement, filtres). Optimise par rapport a
 * `listBoutiques` :
 *   - pas de `_count.equipements` (pas de jointure agregat)
 *   - pas de pagination (cap dur a `BOUTIQUE_OPTIONS_MAX` au caller)
 *   - retourne uniquement id/nom/ville.
 *
 * Par defaut seulement les actives, conforme a la regle "on n'affecte
 * pas un user a une boutique desactivee".
 */
export interface BoutiqueSelectOption {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

interface ListBoutiquesForSelectArgs {
  readonly limit: number;
  readonly includeInactive?: boolean;
}

export async function listBoutiquesForSelect({
  limit,
  includeInactive = false,
}: ListBoutiquesForSelectArgs): Promise<readonly BoutiqueSelectOption[]> {
  const where: Prisma.BoutiqueWhereInput = includeInactive
    ? {}
    : { actif: true };
  const rows = await db.boutique.findMany({
    where,
    orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    take: limit,
    select: { id: true, nom: true, ville: true },
  });
  return rows;
}

/**
 * Recupere les boutiques par ids (page detail user) sans charger toute
 * la liste. Optimise pour ~1 a quelques ids.
 */
export async function getBoutiquesByIds(
  ids: readonly string[]
): Promise<readonly BoutiqueSelectOption[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db.boutique.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, nom: true, ville: true },
  });
  return rows;
}

/**
 * Verifie l'unicite (nom + ville) parmi les boutiques actives.
 * `excludeId` permet d'autoriser un update sans declencher un faux
 * positif sur la boutique en cours d'edition.
 */
async function isDuplicateBoutique(args: {
  readonly nom: string;
  readonly ville: string | null | undefined;
  readonly excludeId?: string;
}): Promise<boolean> {
  const duplicate = await db.boutique.findFirst({
    where: {
      actif: true,
      nom: { equals: args.nom, mode: 'insensitive' },
      ville: args.ville ?? null,
      ...(args.excludeId ? { NOT: { id: args.excludeId } } : {}),
    },
    select: { id: true },
  });
  return duplicate !== null;
}

export async function createBoutique(
  input: BoutiqueCreateInput,
  performedById: string
): Promise<Result<Boutique, BoutiqueError>> {
  if (await isDuplicateBoutique({ nom: input.nom, ville: input.ville })) {
    return { success: false, error: 'DUPLICATE' };
  }
  const created = await db.$transaction(async (tx) => {
    const boutique = await tx.boutique.create({
      data: {
        nom: input.nom,
        adresse: input.adresse ?? null,
        ville: input.ville ?? null,
      },
    });
    await logAudit({
      action: 'CREATE',
      entityType: 'BOUTIQUE',
      entityId: boutique.id,
      entityLabel: boutique.nom,
      performedById,
      tx,
    });
    return boutique;
  });
  return { success: true, data: created };
}

export async function updateBoutique(
  id: string,
  input: BoutiqueUpdateInput
): Promise<Result<Boutique, BoutiqueError>> {
  const existing = await db.boutique.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (input.nom !== undefined || input.ville !== undefined) {
    const nextNom = input.nom ?? existing.nom;
    const nextVille =
      input.ville !== undefined ? (input.ville ?? null) : existing.ville;
    if (
      await isDuplicateBoutique({
        nom: nextNom,
        ville: nextVille,
        excludeId: id,
      })
    ) {
      return { success: false, error: 'DUPLICATE' };
    }
  }
  const updated = await db.boutique.update({
    where: { id },
    data: {
      ...(input.nom !== undefined && { nom: input.nom }),
      ...(input.adresse !== undefined && { adresse: input.adresse ?? null }),
      ...(input.ville !== undefined && { ville: input.ville ?? null }),
    },
  });
  return { success: true, data: updated };
}

interface DisableBoutiqueArgs {
  readonly id: string;
  readonly performedById: string;
  readonly motif?: string;
}

interface EnableBoutiqueArgs {
  readonly id: string;
  readonly performedById: string;
}

/**
 * Soft-delete avec audit (US-ADM-004) : bascule `actif=false` ET ecrit
 * l'entree d'audit dans la meme transaction. Si l'audit echoue, la
 * mutation rollback (atomicite stricte : pas de mutation sans trace).
 */
export async function disableBoutique({
  id,
  performedById,
  motif,
}: DisableBoutiqueArgs): Promise<Result<void, 'NOT_FOUND'>> {
  const existing = await db.boutique.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  await db.$transaction(async (tx) => {
    await tx.boutique.update({ where: { id }, data: { actif: false } });
    await logAudit({
      action: 'DISABLE',
      entityType: 'BOUTIQUE',
      entityId: id,
      entityLabel: existing.nom,
      motif,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}

export async function enableBoutique({
  id,
  performedById,
}: EnableBoutiqueArgs): Promise<Result<void, 'NOT_FOUND'>> {
  const existing = await db.boutique.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  await db.$transaction(async (tx) => {
    await tx.boutique.update({ where: { id }, data: { actif: true } });
    await logAudit({
      action: 'ENABLE',
      entityType: 'BOUTIQUE',
      entityId: id,
      entityLabel: existing.nom,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}
