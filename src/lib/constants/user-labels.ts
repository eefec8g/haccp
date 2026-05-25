import type { UserRole } from '@prisma/client';

/**
 * Libelles francais pour les roles utilisateur, centralises pour
 * eviter les duplications dans les pages admin, le formulaire
 * d'invitation et le service d'email (DRY, Clean Code #4).
 * Source de verite unique.
 */
export const USER_ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  SALARIE: 'Salarie',
  RESPONSABLE: 'Responsable',
  ADMIN: 'Administrateur',
} as const;
