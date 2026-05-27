import type { Creneau } from '@prisma/client';

/**
 * Types de la page "Listing releves multi-jours" (Epic LISTING, Phase 1).
 *
 * Objet metier :
 *   Page de consultation INTERACTIVE des releves d'un RESPONSABLE/ADMIN
 *   sur leur scope multi-tenant complet (toutes les boutiques accessibles
 *   ET tous les salaries de ces boutiques). Complete les exports PDF/CSV
 *   en offrant une vue navigable jour-par-jour avec filtres (boutique,
 *   equipement, creneau, statut) et pagination.
 *
 * Decouple intentionnellement de `RegistreConsolide` (Epic REGISTRE) :
 *   - Forme tabulaire ligne-a-ligne (1 item = 1 cellule equipement x creneau)
 *     au lieu de la matrice jours x equipements du registre PDF audit.
 *   - Inclut explicitement les MANQUANTS comme items virtuels (PDF n'a
 *     pas besoin de cette projection).
 *   - Inclut les releves ANNULES en items distincts (1 cellule peut
 *     contenir 1 releve actif + N releves annules dans l'historique).
 *   - Pagination obligatoire (peut tirer 92 jours x N equipements x 3
 *     creneaux x 2 boutiques).
 *
 * Decisions Phase 0.5 :
 *   - Periode par defaut 30 jours, max 92 jours.
 *   - Scope strict RESPONSABLE/ADMIN via `getAccessibleBoutiqueIds`.
 *   - Tous les statuts (SAISI / ALERTE / MANQUANT / ANNULE) sont
 *     listables ; filtrer par statut est optionnel.
 *
 * Tous les types sont `readonly` (Clean Code #8 -- immuabilite).
 */

/**
 * Statut d'un item de listing.
 *
 * - `SAISI`    : releve actif (non annule) ET dans les seuils.
 * - `ALERTE`   : releve actif (non annule) ET hors seuils
 *                (`alerteHorsSeuils === true`).
 * - `MANQUANT` : creneau attendu mais aucun releve actif sur (equipement,
 *                date, creneau) -- item virtuel synthetise par le service.
 * - `ANNULE`   : releve qui a ete annule (`annuleParId !== null`). Plusieurs
 *                annules peuvent exister pour un meme (equipement, date,
 *                creneau).
 */
export type ReleveListingStatut = 'SAISI' | 'ALERTE' | 'MANQUANT' | 'ANNULE';

/**
 * Query brute (parsee par `releveListingQuerySchema`) qui pilote le listing.
 *
 * - `boutiqueId` / `equipementId` optionnels : filtres. Si absents, le
 *   service applique tout le scope viewer (toutes les boutiques accessibles
 *   et tous leurs equipements actifs).
 * - `creneau` optionnel : filtre MATIN / MIDI / SOIR.
 * - `statut` optionnel : filtre cote service apres aggregation.
 * - `dateStart` / `dateEnd` : ISO `YYYY-MM-DD`, defaut = 30 derniers jours.
 *   Borne `dateEnd >= dateStart`, periode <= 92 jours, dateEnd <= today.
 * - `page` / `pageSize` : pagination. Borne `pageSize <= 200`.
 */
export interface ReleveListingQuery {
  readonly boutiqueId?: string;
  readonly equipementId?: string;
  readonly creneau?: Creneau;
  readonly statut?: ReleveListingStatut;
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Un item du listing = une ligne du tableau dans l'UI.
 *
 * Une ligne represente une (date, equipement, creneau) particuliere :
 *   - Si releve actif present : `id`/`temperature`/`salarieNom` remplis,
 *     `statut = 'SAISI'` ou `'ALERTE'`.
 *   - Si aucun releve actif : item virtuel `statut = 'MANQUANT'`, `id`,
 *     `temperature` et `salarieNom` sont `null`. `createdAt` est aussi
 *     `null` (pas d'evenement reel).
 *   - Si releve annule : `id` non-null (id du releve original), `statut
 *     = 'ANNULE'`, `motifAnnulation` rempli. Pour un meme (date, equipement,
 *     creneau), il peut y avoir 1 ligne ANNULE + 1 ligne SAISI/ALERTE
 *     (l'annulation et le releve actif coexistent).
 */
export interface ReleveListingItem {
  /** `null` UNIQUEMENT pour `statut === 'MANQUANT'`. */
  readonly id: string | null;
  readonly dateISO: string;
  readonly creneau: Creneau;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly equipementId: string;
  readonly equipementNom: string;
  /** `null` si MANQUANT. */
  readonly temperature: number | null;
  readonly alerteHorsSeuils: boolean;
  readonly statut: ReleveListingStatut;
  /** `null` si MANQUANT. */
  readonly salarieNom: string | null;
  /** Rempli UNIQUEMENT pour `statut === 'ANNULE'`. */
  readonly motifAnnulation: string | null;
  /** `null` si MANQUANT. */
  readonly createdAt: Date | null;
}

/**
 * Statistiques globales du listing (sur l'ENSEMBLE des items, pas seulement
 * la page courante). Affichees en tete de la page pour synthese rapide.
 */
export interface ReleveListingStats {
  readonly totalSaisis: number;
  readonly totalAlertes: number;
  readonly totalManquants: number;
  readonly totalAnnules: number;
}

/**
 * Resultat complet renvoye par `listRelevesForListing`.
 *
 * `total`/`totalPages` refletent l'ensemble des items APRES filtres mais
 * AVANT pagination. `items` ne contient que la page courante.
 */
export interface ReleveListingResult {
  readonly items: readonly ReleveListingItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly stats: ReleveListingStats;
}

/**
 * Codes d'erreur du service listing.
 *
 * Volontairement distincts de `ExportError` / `ExportConsolideError` --
 * memes noms parfois (PERIODE_*), mais semantique propre au listing
 * pour eviter un couplage entre Epics.
 *
 * - `FORBIDDEN`              : viewer SALARIE (listing reserve RESPONSABLE/ADMIN).
 * - `PERIODE_INVALID`        : dateEnd < dateStart.
 * - `PERIODE_TOO_LARGE`      : diff > 92 jours.
 * - `PERIODE_IN_FUTURE`      : dateEnd > today Europe/Paris.
 * - `BOUTIQUE_NOT_FOUND`     : boutiqueId hors scope viewer (anti-enum).
 * - `EQUIPEMENT_NOT_FOUND`   : equipementId hors scope viewer (anti-enum).
 * - `TOO_MANY_RESULTS`       : volume releves > `HARD_LIMIT_RELEVES`
 *                              (protection memoire Vercel Hobby 256MB).
 *                              Caller doit suggerer un filtre plus
 *                              etroit (boutique/equipement) ou periode
 *                              plus courte.
 * - `INTERNAL`               : erreur DB / inattendue.
 */
export type ReleveListingError =
  | 'FORBIDDEN'
  | 'PERIODE_INVALID'
  | 'PERIODE_TOO_LARGE'
  | 'PERIODE_IN_FUTURE'
  | 'BOUTIQUE_NOT_FOUND'
  | 'EQUIPEMENT_NOT_FOUND'
  | 'TOO_MANY_RESULTS'
  | 'INTERNAL';
