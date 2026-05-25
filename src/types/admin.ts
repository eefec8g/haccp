import type { TypeEquipement, UserRole } from '@prisma/client';

/**
 * Types projetes pour les listings admin. On expose le minimum
 * necessaire a l'UI : pas de password, pas de tokens en clair, pas de
 * timestamps Prisma internes hors `createdAt`. Tous les champs sont
 * `readonly` (immutabilite cote consommateur).
 */

export interface BoutiqueListItem {
  readonly id: string;
  readonly nom: string;
  readonly adresse: string | null;
  readonly ville: string | null;
  readonly actif: boolean;
  readonly createdAt: Date;
  readonly equipementsCount: number;
}

export interface EquipementListItem {
  readonly id: string;
  readonly nom: string;
  readonly type: TypeEquipement;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly actif: boolean;
  readonly createdAt: Date;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
}

export interface UserListItem {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly actif: boolean;
  readonly createdAt: Date;
  readonly boutiqueSalarieId: string | null;
  readonly boutiqueIdsResponsable: readonly string[];
}

export interface PaginationQuery {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * Payload renvoye par `validateInvitationToken`. Pas le token en clair,
 * uniquement les infos necessaires pour afficher la page d'acceptation
 * et debrayer la creation du compte.
 */
export interface InvitationPayload {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly role: UserRole;
  readonly expiresAt: Date;
  readonly boutiqueSalarieId: string | null;
  readonly boutiquesResponsable: readonly string[];
}
