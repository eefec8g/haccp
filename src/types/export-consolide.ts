import type { AlerteStatus, Creneau, UserRole } from '@prisma/client';

/**
 * Types du registre journalier consolide (Epic REGISTRE -- US-REG-001).
 *
 * Reference : `.claude/epic-state.md` (Phase 0.5 validee).
 *
 * Concept :
 *   - Periode `[dateStart, dateEnd]` (max `MAX_PERIODE_DAYS`).
 *   - Une ou plusieurs boutiques (mode "boutique unique" ou "toutes les
 *     boutiques accessibles au viewer").
 *   - Pour chaque jour de la periode, et chaque equipement actif des
 *     boutiques du scope : presence ou absence d'un releve pour chaque
 *     creneau (matin/midi/soir).
 *   - Toutes les alertes de la periode + toutes les signatures de la
 *     periode (annexe DDPP).
 *   - Statistiques agregees (taux conformite, taux resolution).
 *
 * Decouple intentionnellement de `RegistreJournalier` (export.service) :
 *   - Multi-boutiques + multi-jours : forme matricielle Jours x Equipements.
 *   - Pas de heureSaisie (volume releves x 31 jours = bruit visuel PDF).
 *   - Stats agregees specifiques (taux resolution alertes).
 *
 * Tous les types sont `readonly` (Clean Code #8 -- immuabilite).
 */

/**
 * Query brute (apres parsing Zod) qui declenche un export consolide.
 *
 * - `boutiqueId` optionnel : si absent => mode "toutes mes boutiques"
 *   (le service utilisera `getAccessibleBoutiqueIds`).
 * - `dateStart`/`dateEnd` : ISO `YYYY-MM-DD` (regex validee cote Zod).
 *   Borne `dateEnd >= dateStart`, periode <= `MAX_PERIODE_DAYS`, pas
 *   dans le futur (today inclus).
 */
export interface RegistreConsolideQuery {
  readonly boutiqueId?: string;
  readonly dateStart: string;
  readonly dateEnd: string;
}

/**
 * Viewer authentifie qui demande l'export. Subset minimal de la session
 * (cf. `SessionUser`) : on n'a besoin que de `id` (audit + scope) et
 * `role` (`canExport` guard).
 */
export interface RegistreConsolideViewer {
  readonly id: string;
  readonly role: UserRole;
}

/**
 * Resume d'une boutique presente dans la periode consolidee.
 * Affichee en en-tete du PDF (Phase 2).
 */
export interface BoutiqueSummary {
  readonly id: string;
  readonly nom: string;
  readonly ville: string | null;
}

/**
 * Cellule de la matrice consolidee : un releve pour un creneau donne.
 *
 * `null` (cf. `ConsolideJourEquipement.releves[creneau]`) signifie
 * "creneau manquant" -- cas dominant en HACCP (le PDF affichera "-").
 *
 * `alerte` est calcule depuis `Releve.alerteHorsSeuils` (pas une jointure
 * sur `Alerte` : un releve avec depassement seuil produit `alerte: true`
 * meme avant la creation eventuelle de l'`Alerte` rattachee).
 */
export interface ConsolideReleveCell {
  readonly temperature: number;
  readonly alerte: boolean;
  readonly salarieNom: string;
}

/**
 * Tableau des 3 creneaux d'une journee pour un equipement. Toujours 3
 * cles fixes (matin/midi/soir) -- les jours/creneaux non saisis sont
 * `null` (cf. `ConsolideReleveCell`).
 */
export interface ConsolideJourReleves {
  readonly matin: ConsolideReleveCell | null;
  readonly midi: ConsolideReleveCell | null;
  readonly soir: ConsolideReleveCell | null;
}

/**
 * Ligne de la matrice : un equipement d'une boutique pour un jour donne.
 *
 * `boutiqueId`/`boutiqueNom` denormalises pour faciliter le rendu PDF
 * groupe (Phase 2 : groupBy boutique > equipement > jours).
 */
export interface ConsolideJourEquipement {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly releves: ConsolideJourReleves;
}

/**
 * Une journee de la periode = N equipements x 3 creneaux.
 */
export interface ConsolideJour {
  readonly dateISO: string;
  readonly equipements: readonly ConsolideJourEquipement[];
}

/**
 * Entree alerte dans le bloc "Alertes de la periode" du PDF.
 *
 * `traiteeAt`/`traiteParNom` sont presents si l'alerte est RESOLUE ou
 * IGNOREE. `motif` est `commentaireResolution` de la table `Alerte`
 * (libelle DDPP : "motif" est plus parlant que "commentaire de
 * resolution" pour un auditeur).
 *
 * `signaleeAt` = `Alerte.createdAt` (le schema n'a pas de champ dedie ;
 * `createdAt` est l'instant de l'INSERT qui correspond a la saisie du
 * releve avec depassement -- cf. `alerte.service.create`).
 */
export interface ConsolideAlerte {
  readonly id: string;
  readonly dateISO: string;
  readonly equipementNom: string;
  readonly boutiqueNom: string;
  readonly temperature: number;
  readonly creneau: Creneau;
  readonly statut: AlerteStatus;
  readonly motif: string | null;
  readonly salarieNom: string;
  readonly signaleeAt: Date;
  readonly traiteeAt: Date | null;
  readonly traiteParNom: string | null;
}

/**
 * Entree signature dans l'annexe "Signatures du registre".
 *
 * 1 ligne par signature : dateISO, boutiqueNom, signataire, role, signedAt.
 * `signataireRoleSnapshot` est fige au moment de la signature (cf. schema
 * Signature) -- on l'expose tel quel pour preserver l'historique audit.
 */
export interface ConsolideSignature {
  readonly id: string;
  readonly dateISO: string;
  readonly boutiqueNom: string;
  readonly signataireNom: string;
  readonly signataireRoleSnapshot: UserRole;
  readonly signedAt: Date;
}

/**
 * Statistiques agregees du registre consolide.
 *
 * - `tauxConformite` (0..100) = totalRelevesSaisis / totalRelevesAttendus.
 * - `tauxResolutionAlertes` (0..100) = (totalAlertes - alertesOuvertes) /
 *   totalAlertes. 0 si pas d'alerte (vacuously conforme).
 *
 * `totalRelevesAttendus = jours x nbEquipementsActifs x 3` (formule
 * documentee dans `constants/export-consolide.ts`).
 */
export interface RegistreConsolideStats {
  readonly totalRelevesAttendus: number;
  readonly totalRelevesSaisis: number;
  readonly relevesManquants: number;
  readonly tauxConformite: number;
  readonly totalAlertes: number;
  readonly alertesOuvertes: number;
  readonly alertesTraitees: number;
  readonly tauxResolutionAlertes: number;
  readonly totalSignatures: number;
  readonly joursAvecSignature: number;
}

/**
 * Donnees de la periode (sortie du service `buildRegistreConsolide`).
 *
 * Forme finale consommee par le pdf-builder (Phase 2). Tous les champs
 * sont readonly : un export ne doit jamais etre mute apres construction.
 */
export interface RegistreConsolide {
  readonly periode: {
    readonly dateStart: string;
    readonly dateEnd: string;
    readonly jours: number;
  };
  readonly boutiques: readonly BoutiqueSummary[];
  readonly jours: readonly ConsolideJour[];
  readonly alertes: readonly ConsolideAlerte[];
  readonly signatures: readonly ConsolideSignature[];
  readonly stats: RegistreConsolideStats;
}

/**
 * Codes d'erreur du service consolide.
 *
 * Volontairement distincts de `ExportError` (epic EXPORT) pour eviter
 * un melange de semantique :
 *   - `PERIODE_INVALID`     : dateEnd < dateStart (incoherent).
 *   - `PERIODE_TOO_LARGE`   : diff > `MAX_PERIODE_DAYS`.
 *   - `PERIODE_IN_FUTURE`   : dateEnd > today Europe/Paris.
 *   - `BOUTIQUE_NOT_FOUND`  : boutiqueId hors scope (anti-enum).
 *   - `FORBIDDEN`           : viewer SALARIE ou role non autorise.
 *   - `INTERNAL`            : erreur DB / inattendue.
 */
export type ExportConsolideError =
  | 'FORBIDDEN'
  | 'BOUTIQUE_NOT_FOUND'
  | 'PERIODE_INVALID'
  | 'PERIODE_TOO_LARGE'
  | 'PERIODE_IN_FUTURE'
  | 'INTERNAL';
