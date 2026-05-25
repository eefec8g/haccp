import { z } from 'zod';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { ADMIN_PAGE_SIZE, ADMIN_PAGE_SIZE_MAX } from '@/lib/constants/admin';

/**
 * Schema de filtre du listing AuditLog (`/admin/audit-log`).
 *
 * Tous les filtres sont optionnels. Les valeurs invalides sont silently
 * dropped via `.optional()` apres parsing : la page tombe alors sur un
 * listing complet plutot que d'envoyer une 400 a un admin.
 */
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_PAGE_SIZE_MAX)
    .default(ADMIN_PAGE_SIZE),
  entityType: z.nativeEnum(AuditEntityType).optional(),
  action: z.nativeEnum(AuditAction).optional(),
  entityId: z.string().uuid().optional(),
  performedById: z.string().uuid().optional(),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
