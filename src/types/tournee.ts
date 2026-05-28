import type { Creneau, UserRole } from '@prisma/client';

/**
 * Types du domaine "tournee guidee" (feat/tournee-guidee).
 *
 * La tournee guidee est une vue mono-equipement, mono-creneau qui
 * remplace les boutons "Saisir" inline du tableau dashboard : le
 * SALARIE clique sur "Tournee matin / midi / soir" et est guide
 * equipement par equipement, puis termine par la signature obligatoire
 * du registre.
 *
 * Conventions :
 *   - readonly partout (CC-8 immutabilite).
 *   - Pas de Date brute : `signedAt` est expose en Date par le service
 *     (cohrence avec SignatureRow existante).
 *   - `releves` est un Record indexe par equipementId (lookup O(1)
 *     cote client React sans transformation supplementaire).
 */

/** Un equipement actif a parcourir dans la tournee guidee. */
export interface TourneeEquipement {
  readonly id: string;
  readonly nom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
}

/**
 * Snapshot d'un releve actif du jour pour un equipement, projete pour
 * l'ecran de tournee guidee. `null` au niveau du Record signifie qu'il
 * n'y a pas encore de releve actif (creneau a saisir).
 *
 * `saisiAt` correspond a `Releve.createdAt` cote DB (instant exact de
 * saisie) et permet a l'UI d'afficher l'heure HH:mm sous la temperature
 * en mode lecture seule.
 */
export interface TourneeReleve {
  readonly id: string;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly saisiAt: Date;
}

/**
 * Snapshot de la signature du jour (boutique + dateISO + creneau-
 * agnostique : la signature couvre la journee entiere conformement
 * a la regle 1 signature par registre par jour).
 */
export interface TourneeSignature {
  readonly id: string;
  readonly signedAt: Date;
  readonly signataireNom: string;
  readonly signataireRoleSnapshot: UserRole;
}

/**
 * Etat complet de la tournee guidee pour un creneau donne sur une
 * boutique donnee.
 */
export interface TourneeStatus {
  readonly dateISO: string;
  readonly creneau: Creneau;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly equipements: readonly TourneeEquipement[];
  /** Indexe par equipementId. `null` = pas de releve actif sur ce creneau. */
  readonly releves: Readonly<Record<string, TourneeReleve | null>>;
  readonly signature: TourneeSignature | null;
}

/**
 * Erreurs metier du service tournee.
 *
 * - BOUTIQUE_NOT_FOUND : aucun perimetre boutique resolvable (SALARIE
 *   sans BoutiqueUser, ou RESPONSABLE multi-boutiques sans selection).
 * - FORBIDDEN          : boutiqueId fourni hors-scope.
 * - INTERNAL           : erreur DB non recuperable.
 */
export type TourneeError = 'BOUTIQUE_NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL';
