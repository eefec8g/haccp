import type { AuditAction, AuditEntityType } from '@prisma/client';

/**
 * Types projetes pour le journal d'audit (US-ADM-004).
 *
 * Les enums Prisma sont reexportes pour eviter aux callers d'importer
 * `@prisma/client` directement (separation des couches : la couche UI
 * ne connait que les types domaine).
 */
export type { AuditAction, AuditEntityType };

export interface AuditLogListItem {
  readonly id: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel: string | null;
  readonly motif: string | null;
  readonly performedById: string;
  readonly performedByEmail: string;
  readonly performedByName: string;
  readonly createdAt: Date;
}
