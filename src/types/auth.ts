import type { UserRole } from '@prisma/client';

/**
 * Representation d'un utilisateur authentifie cote application.
 * Derive du modele Prisma User mais expose uniquement les champs
 * necessaires aux services et composants (pas de password hash).
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly boutiqueIds: readonly string[];
  readonly actif: boolean;
}

/**
 * Sous-ensemble d'AuthUser stocke dans la session NextAuth (JWT).
 * Sert de payload minimal pour les middlewares et la couche permissions.
 */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly boutiqueIds: readonly string[];
}
