import { Prisma, type Equipement } from '@prisma/client';
import { db } from '@/lib/prisma';
import type {
  EquipementListItem,
  PaginatedResult,
  PaginationQuery,
} from '@/types/admin';
import type { Result } from '@/types/result';
import type {
  EquipementCreateInput,
  EquipementUpdateInput,
} from '@/lib/validations/admin';
import { logAudit } from '@/lib/services/audit-log.service';
import { buildPaginated } from '@/lib/utils/pagination';

/**
 * Service de gestion des equipements (admin).
 *
 * Regles :
 *   - Un equipement est rattache a une boutique active (verifie a la
 *     creation).
 *   - Seuils min/max sont obligatoires (decision Epic ADMIN #4) et
 *     valides par Zod en amont. On reverifie ici par defense en
 *     profondeur (`seuilMin < seuilMax`).
 *   - Unicite du nom par boutique parmi les equipements actifs.
 */

export type EquipementError =
  | 'NOT_FOUND'
  | 'INVALID'
  | 'BOUTIQUE_NOT_FOUND'
  | 'DUPLICATE';

interface ListEquipementsArgs {
  readonly query: PaginationQuery;
  readonly boutiqueId?: string;
  readonly includeInactive?: boolean;
}

type EquipementWithBoutique = Equipement & {
  readonly boutique: { readonly nom: string };
};

function mapEquipement(row: EquipementWithBoutique): EquipementListItem {
  return {
    id: row.id,
    nom: row.nom,
    type: row.type,
    seuilMin: Number(row.seuilMin),
    seuilMax: Number(row.seuilMax),
    actif: row.actif,
    createdAt: row.createdAt,
    boutiqueId: row.boutiqueId,
    boutiqueNom: row.boutique.nom,
  };
}

/**
 * Liste paginee des equipements. Filtrable par `boutiqueId`.
 */
export async function listEquipements({
  query,
  boutiqueId,
  includeInactive = false,
}: ListEquipementsArgs): Promise<PaginatedResult<EquipementListItem>> {
  const where: Prisma.EquipementWhereInput = {
    ...(includeInactive ? {} : { actif: true }),
    ...(boutiqueId ? { boutiqueId } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.equipement.findMany({
      where,
      orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
      skip,
      take: query.pageSize,
      include: { boutique: { select: { nom: true } } },
    }),
    db.equipement.count({ where }),
  ]);
  return buildPaginated(rows.map(mapEquipement), total, query);
}

export async function getEquipementById(
  id: string
): Promise<Result<Equipement, 'NOT_FOUND'>> {
  const equipement = await db.equipement.findUnique({ where: { id } });
  if (!equipement) {
    return { success: false, error: 'NOT_FOUND' };
  }
  return { success: true, data: equipement };
}

async function isDuplicateEquipement(args: {
  readonly nom: string;
  readonly boutiqueId: string;
  readonly excludeId?: string;
}): Promise<boolean> {
  const duplicate = await db.equipement.findFirst({
    where: {
      actif: true,
      boutiqueId: args.boutiqueId,
      nom: { equals: args.nom, mode: 'insensitive' },
      ...(args.excludeId ? { NOT: { id: args.excludeId } } : {}),
    },
    select: { id: true },
  });
  return duplicate !== null;
}

async function ensureActiveBoutique(boutiqueId: string): Promise<boolean> {
  const boutique = await db.boutique.findUnique({
    where: { id: boutiqueId },
    select: { actif: true },
  });
  return boutique?.actif === true;
}

export async function createEquipement(
  input: EquipementCreateInput,
  performedById: string
): Promise<Result<Equipement, EquipementError>> {
  if (input.seuilMin >= input.seuilMax) {
    return { success: false, error: 'INVALID' };
  }
  if (!(await ensureActiveBoutique(input.boutiqueId))) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  if (
    await isDuplicateEquipement({
      nom: input.nom,
      boutiqueId: input.boutiqueId,
    })
  ) {
    return { success: false, error: 'DUPLICATE' };
  }
  const created = await db.$transaction(async (tx) => {
    const equipement = await tx.equipement.create({
      data: {
        nom: input.nom,
        type: input.type,
        boutiqueId: input.boutiqueId,
        seuilMin: input.seuilMin,
        seuilMax: input.seuilMax,
      },
    });
    await logAudit({
      action: 'CREATE',
      entityType: 'EQUIPEMENT',
      entityId: equipement.id,
      entityLabel: equipement.nom,
      performedById,
      tx,
    });
    return equipement;
  });
  return { success: true, data: created };
}

export async function updateEquipement(
  id: string,
  input: EquipementUpdateInput
): Promise<Result<Equipement, EquipementError>> {
  const existing = await db.equipement.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  const nextMin =
    input.seuilMin !== undefined ? input.seuilMin : Number(existing.seuilMin);
  const nextMax =
    input.seuilMax !== undefined ? input.seuilMax : Number(existing.seuilMax);
  if (nextMin >= nextMax) {
    return { success: false, error: 'INVALID' };
  }
  if (input.boutiqueId && input.boutiqueId !== existing.boutiqueId) {
    if (!(await ensureActiveBoutique(input.boutiqueId))) {
      return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
    }
  }
  if (input.nom !== undefined || input.boutiqueId !== undefined) {
    const nextBoutiqueId = input.boutiqueId ?? existing.boutiqueId;
    const nextNom = input.nom ?? existing.nom;
    if (
      await isDuplicateEquipement({
        nom: nextNom,
        boutiqueId: nextBoutiqueId,
        excludeId: id,
      })
    ) {
      return { success: false, error: 'DUPLICATE' };
    }
  }
  const updated = await db.equipement.update({
    where: { id },
    data: {
      ...(input.nom !== undefined && { nom: input.nom }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.boutiqueId !== undefined && { boutiqueId: input.boutiqueId }),
      ...(input.seuilMin !== undefined && { seuilMin: input.seuilMin }),
      ...(input.seuilMax !== undefined && { seuilMax: input.seuilMax }),
    },
  });
  return { success: true, data: updated };
}

interface DisableEquipementArgs {
  readonly id: string;
  readonly performedById: string;
  readonly motif?: string;
}

interface EnableEquipementArgs {
  readonly id: string;
  readonly performedById: string;
}

/**
 * Soft-delete avec audit (US-ADM-004). Cf. boutique.service pour le
 * raisonnement atomique (rollback si log echoue).
 */
export async function disableEquipement({
  id,
  performedById,
  motif,
}: DisableEquipementArgs): Promise<Result<void, 'NOT_FOUND'>> {
  const existing = await db.equipement.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  await db.$transaction(async (tx) => {
    await tx.equipement.update({ where: { id }, data: { actif: false } });
    await logAudit({
      action: 'DISABLE',
      entityType: 'EQUIPEMENT',
      entityId: id,
      entityLabel: existing.nom,
      motif,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}

export async function enableEquipement({
  id,
  performedById,
}: EnableEquipementArgs): Promise<Result<void, 'NOT_FOUND'>> {
  const existing = await db.equipement.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  await db.$transaction(async (tx) => {
    await tx.equipement.update({ where: { id }, data: { actif: true } });
    await logAudit({
      action: 'ENABLE',
      entityType: 'EQUIPEMENT',
      entityId: id,
      entityLabel: existing.nom,
      performedById,
      tx,
    });
  });
  return { success: true, data: undefined };
}
