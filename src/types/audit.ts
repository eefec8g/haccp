import type { AuditAction, AuditEntityType } from '@prisma/client';

/**
 * Types projetes pour le journal d'audit (US-ADM-004).
 *
 * Les enums Prisma sont reexportes pour eviter aux callers d'importer
 * `@prisma/client` directement (separation des couches : la couche UI
 * ne connait que les types domaine).
 */
export type { AuditAction, AuditEntityType };

/**
 * Projection complete : utilisee par la page admin `/admin/audit-log`
 * qui affiche email + motif dans une table. NE PAS exposer dans des
 * composants qui n'affichent ni l'email ni le motif (RGPD : principe
 * de minimisation, cf. `AuditLogCompactItem` pour les vues compactes).
 */
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

/**
 * Projection minimaliste : utilisee par les vues compactees du dashboard
 * (US-DAS-002) qui n'affichent que le nom de l'acteur. EXCLUT l'email
 * et le motif pour eviter de les serialiser dans le RSC payload (RGPD :
 * principe de minimisation des donnees).
 */
export interface AuditLogCompactItem {
  readonly id: string;
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel: string | null;
  readonly performedById: string;
  readonly performedByName: string;
  readonly createdAt: Date;
}
