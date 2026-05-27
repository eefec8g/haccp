import type { AuditAction, AuditEntityType } from '@/types/audit';

/**
 * Constantes partagees du journal d'audit (US-ADM-004, US-DAS-002).
 *
 * Centralisees ici pour eviter les duplications entre la page admin
 * (`/admin/audit-log`) et la vue compactee du dashboard
 * (`AdminAuditLogCompact`). Clean Code #4 (DRY).
 *
 * Toutes les structures exposees sont `Readonly` / `as const` pour
 * preserver l'immutabilite (Clean Code #8).
 */

/**
 * Libelle FR des entites auditees. Source de verite unique pour la UI :
 * tout nouveau `AuditEntityType` ajoute cote Prisma DOIT etre reflete
 * ici (TypeScript verifie l'exhaustivite via `Record<...>`).
 */
export const AUDIT_ENTITY_LABEL: Readonly<Record<AuditEntityType, string>> = {
  BOUTIQUE: 'Boutique',
  EQUIPEMENT: 'Equipement',
  USER: 'Utilisateur',
  INVITATION: 'Invitation',
  EXPORT: 'Export',
  PHOTO: 'Photo',
};

/**
 * Libelle FR des actions auditees. Affichage UI (badges, libelles).
 * `Record<...>` impose l'exhaustivite : tout nouveau `AuditAction` ajoute
 * cote Prisma DOIT etre reflete ici.
 */
export const AUDIT_ACTION_LABEL: Readonly<Record<AuditAction, string>> = {
  CREATE: 'Creation',
  UPDATE: 'Mise a jour',
  DISABLE: 'Desactivation',
  ENABLE: 'Reactivation',
  DELETE: 'Suppression',
  EXPORT: 'Export',
  PHOTO_UPLOAD: 'Photo ajoutee',
  PHOTO_DELETE: 'Photo supprimee',
};

/**
 * Format date Europe/Paris standard pour le journal d'audit. Inclut
 * l'annee (Security L6) : les audits anciens doivent rester lisibles
 * meme en consultation tardive. Format final : `26/05/2026 10:30`.
 */
export const PARIS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
};
