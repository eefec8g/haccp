import type { Creneau, TypeEquipement } from '@prisma/client';

/**
 * Types projetes pour l'Epic RELEVE. Volontairement minimaux : pas
 * de timestamps Prisma internes hors `createdAt`/`date`, pas d'IP, pas
 * de signature dans les listings (donnees sensibles).
 */

/** Etat d'un creneau d'equipement pour la tournee du jour. */
export type CreneauStatus =
  /** Releve actif existant sans alerte. */
  | 'DONE'
  /** Releve actif existant mais hors seuils. */
  | 'ALERTE'
  /** Aucun releve actif sur ce creneau. */
  | 'MISSING';

/**
 * Etat d'un creneau pour un equipement donne (US-REL-001).
 * `releveId`/`temperature`/`alerte` ne sont renseignes que si
 * `status !== 'MISSING'`.
 */
export interface TourneeCreneauInfo {
  readonly creneau: Creneau;
  readonly status: CreneauStatus;
  readonly releveId: string | null;
  readonly temperature: number | null;
  readonly alerte: boolean;
}

/** Une carte equipement avec ses 3 creneaux du jour (US-REL-001). */
export interface TourneeEquipementCard {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly type: TypeEquipement;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  /** Toujours dans l'ordre MATIN, MIDI, SOIR (cf. CRENEAU_ORDER). */
  readonly creneaux: readonly TourneeCreneauInfo[];
}

/**
 * Ligne d'historique/listing releve (US-REL-003, US-REL-004 admin).
 * `salarieEmail`/`salarieName` ne sont renseignes que pour les vues
 * Responsable/Admin (non leakees au salarie qui n'aurait vu que ses
 * propres releves).
 */
export interface ReleveListItem {
  readonly id: string;
  readonly date: Date;
  readonly creneau: Creneau;
  readonly temperature: number;
  readonly alerteHorsSeuils: boolean;
  readonly commentaire: string | null;
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly equipementType: TypeEquipement;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly salarieEmail: string | null;
  readonly salarieName: string | null;
  readonly annule: boolean;
  readonly annuleParReleveId: string | null;
  readonly motifAnnulation: string | null;
  readonly createdAt: Date;
}

/**
 * Contexte de saisie d'un releve (US-REL-002). Fourni au formulaire
 * pour afficher les seuils + libelle equipement + creneau cible.
 */
export interface SaisieContext {
  readonly equipement: {
    readonly id: string;
    readonly nom: string;
    readonly type: TypeEquipement;
    readonly seuilMin: number;
    readonly seuilMax: number;
    readonly boutiqueId: string;
    readonly boutiqueNom: string;
  };
  readonly creneau: Creneau;
  /** Date du jour Europe/Paris, format YYYY-MM-DD. */
  readonly dateISO: string;
}

/** Resultat d'un createReleve : indique si une alerte a ete creee. */
export interface ReleveCreatedResult {
  readonly releveId: string;
  readonly alerteCreated: boolean;
  readonly alerteId: string | null;
}

/** Resultat d'un annulerReleve : ids du releve d'annulation et du remplacement eventuel. */
export interface ReleveAnnulationResult {
  readonly annulationReleveId: string;
  readonly replacementReleveId: string | null;
}
