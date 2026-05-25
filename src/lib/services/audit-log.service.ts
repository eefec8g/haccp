import { Prisma, type AuditAction, type AuditEntityType } from '@prisma/client';
import { db } from '@/lib/prisma';
import type { AuditLogListItem } from '@/types/audit';
import type { PaginatedResult, PaginationQuery } from '@/types/admin';
import { buildPaginated } from '@/lib/utils/pagination';

/**
 * Type du client transactionnel passe par `db.$transaction(async tx => ...)`.
 * Notre `db` est etendu via `$extends`, donc son `TransactionClient`
 * differe de `Prisma.TransactionClient`. On infere directement depuis
 * la signature de `$transaction` pour rester en phase avec l'extension.
 */
export type AuditTransactionClient = Parameters<
  Parameters<typeof db.$transaction>[0]
>[0];

/**
 * Service du journal d'audit (US-ADM-004).
 *
 * Responsabilites :
 *   - `logAudit` : ecrit une entree d'audit. Peut etre invoque dans une
 *     transaction Prisma (`tx` fourni) pour atomicite avec la mutation
 *     metier, ou hors transaction (best-effort, l'erreur d'audit ne
 *     bloque pas l'utilisateur).
 *   - `listAuditLogs` : listing pagine filtrable, pour la page admin.
 *   - `getEntityHistory` : historique complet d'une entite (max 100
 *     entrees recentes), utile pour les pages de detail.
 *
 * Conventions :
 *   - Tracabilite immuable HACCP : aucune signature update/delete
 *     exposee. Cf. CCF "Regle Critique #1".
 *   - Pas d'auth check ici : delegue aux Server Actions appelantes.
 */

/**
 * Limite haute pour l'historique d'une entite (page detail). Borne
 * defensive : eviter de dump un million de lignes si une regression
 * appelait `getEntityHistory` sans pagination.
 */
const ENTITY_HISTORY_LIMIT = 100;

interface LogAuditInput {
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel?: string | null;
  readonly motif?: string | null;
  readonly metadata?: Prisma.InputJsonValue;
  readonly performedById: string;
  /**
   * Client Prisma transactionnel optionnel. Quand fourni, l'erreur
   * d'ecriture est propagee pour faire rollback de la mutation metier.
   * Hors transaction, l'erreur est journalisee mais NON propagee
   * (best-effort : la trace audit ne doit pas bloquer le metier).
   */
  readonly tx?: AuditTransactionClient;
}

interface ListAuditLogsArgs {
  readonly query: PaginationQuery;
  readonly entityType?: AuditEntityType;
  readonly action?: AuditAction;
  readonly entityId?: string;
  readonly performedById?: string;
}

interface AuditLogWithPerformer {
  readonly id: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel: string | null;
  readonly motif: string | null;
  readonly performedById: string;
  readonly createdAt: Date;
  readonly performedBy: { readonly email: string; readonly name: string };
}

function mapAuditLog(row: AuditLogWithPerformer): AuditLogListItem {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    motif: row.motif,
    performedById: row.performedById,
    performedByEmail: row.performedBy.email,
    performedByName: row.performedBy.name,
    createdAt: row.createdAt,
  };
}

function buildAuditData(
  input: LogAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  return {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel ?? null,
    motif: input.motif ?? null,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    performedById: input.performedById,
  };
}

/**
 * Ecrit une entree d'audit.
 *
 * IMPORTANT : deux modes selon la presence de `tx`.
 *
 * - Si `tx` est fourni (mode transactionnel, REGLE PAR DEFAUT pour
 *   toutes les mutations admin sensibles) :
 *     - L'erreur d'ecriture est PROPAGEE.
 *     - La mutation metier (Boutique/Equipement/User update) rollback
 *       avec elle, garantissant l'atomicite "pas de mutation sans
 *       trace".
 *
 * - Si `tx` est absent (mode best-effort) :
 *     - L'erreur est journalisee dans console.error et avalee.
 *     - La trace audit peut etre PERDUE. C'est un compromis explicite :
 *       on prefere ne pas bloquer l'utilisateur quand la DB est
 *       degradee. Cote HACCP, ce trou est tolere uniquement pour les
 *       evenements non-mutants (ex. simple visualisation) car les
 *       ecritures Postgres ne sont quasiment jamais en panne.
 *
 * Regle d'or : pour TOUTE mutation admin qui DOIT laisser une trace
 * (CREATE/UPDATE/DISABLE/ENABLE sur Boutique/Equipement/User), passer
 * un `tx` provenant de `db.$transaction(...)`.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  const data = buildAuditData(input);
  if (input.tx) {
    await input.tx.auditLog.create({ data });
    return;
  }
  try {
    await db.auditLog.create({ data });
  } catch (error) {
    console.error('[audit-log] write failed', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * Liste paginee du journal d'audit (page `/admin/audit-log`).
 */
export async function listAuditLogs({
  query,
  entityType,
  action,
  entityId,
  performedById,
}: ListAuditLogsArgs): Promise<PaginatedResult<AuditLogListItem>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action } : {}),
    ...(entityId ? { entityId } : {}),
    ...(performedById ? { performedById } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.pageSize,
      include: { performedBy: { select: { email: true, name: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return buildPaginated(rows.map(mapAuditLog), total, query);
}

/**
 * Historique complet d'une entite (max ENTITY_HISTORY_LIMIT entrees,
 * ordre createdAt desc). Utile pour afficher "qui a fait quoi" sur la
 * page de detail d'une boutique/equipement/user.
 */
export async function getEntityHistory(
  entityType: AuditEntityType,
  entityId: string
): Promise<readonly AuditLogListItem[]> {
  const rows = await db.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: ENTITY_HISTORY_LIMIT,
    include: { performedBy: { select: { email: true, name: true } } },
  });
  return rows.map(mapAuditLog);
}
