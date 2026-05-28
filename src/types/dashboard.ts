/**
 * Types partages de l'Epic DASHBOARD (US-DAS-001 Responsable, US-DAS-002
 * Admin).
 *
 * Conventions :
 *   - Tous les champs `readonly` (Clean Code #8 - immutabilite).
 *   - Pas de Date directe en sortie des projections : on expose des
 *     chaines ISO `YYYY-MM-DD` pour les series temporelles, conforme a
 *     la convention de l'Epic RELEVE (`@/lib/utils/dates`).
 *   - Les KPIs "taux" sont des pourcentages 0..100 (entiers ou decimaux,
 *     la couche UI decide du format d'affichage).
 */
import type { Creneau } from '@prisma/client';

/** Indicateurs cles du dashboard Responsable (US-DAS-001). */
export interface ResponsableDashboardKpis {
  /** Taux de conformite (%) des releves du jour sur le scope. */
  readonly tauxConformiteJour: number;
  /** Nombre d'alertes OUVERTES sur le scope, tous jours confondus. */
  readonly alertesOuvertesCount: number;
  /** Nombre de creneaux jour manquants (sur tous les equipements actifs). */
  readonly relevesManquantsJourCount: number;
  /** Nombre de boutiques surveillees (taille du scope viewer). */
  readonly boutiquesCount: number;
}

/** Indicateurs cles du dashboard Admin (US-DAS-002). */
export interface AdminDashboardKpis {
  /** Utilisateurs actifs (toutes roles confondus). */
  readonly utilisateursActifs: number;
  /** Boutiques actives. */
  readonly boutiquesActives: number;
  /** Equipements actifs (somme cross-boutique). */
  readonly equipementsActifs: number;
  /** Alertes ouvertes creees dans la fenetre 7 jours. */
  readonly alertes7jOuvertes: number;
  /** Alertes resolues creees dans la fenetre 7 jours. */
  readonly alertes7jResolues: number;
  /** Taux de conformite global jour (%) sur tout le parc actif. */
  readonly tauxConformiteGlobal: number;
}

/**
 * Une ligne du tableau "saisies manquantes" pour le jour courant.
 *
 * Modelise un equipement actif qui a AU MOINS un creneau non saisi.
 * Si tous les creneaux sont remplis, l'equipement n'apparait pas (-> UI
 * vide quand `entries.length === 0`).
 */
export interface MissingReleveEntry {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly creneauxManquants: readonly Creneau[];
}

/**
 * Point d'une serie temporelle (LineChart, BarChart...).
 *
 * `dateISO` au format `YYYY-MM-DD` Europe/Paris pour eviter tout
 * decalage timezone cote affichage.
 */
export interface TrendPoint {
  readonly dateISO: string;
  readonly value: number;
}

/**
 * Erreurs renvoyees par les fonctions du `dashboard.service`.
 *
 * - FORBIDDEN : le viewer n'a pas le role requis (Salarie qui appelle
 *   Responsable, Responsable qui appelle Admin, ou Responsable hors
 *   scope sur un filtre boutique).
 * - INTERNAL : reserve aux echecs DB non recuperables (le service relog,
 *   les Server Components remontent une page d'erreur sobre).
 */
export type DashboardError = 'FORBIDDEN' | 'INTERNAL';

/**
 * Statut d'une cellule "equipement x creneau" sur le tableau du jour.
 *
 * - SAISI    : un releve actif existe (annuleParId IS NULL), pas hors seuils.
 * - ALERTE   : un releve actif existe ET il est hors seuils
 *              (`alerteHorsSeuils === true`).
 * - MANQUANT : aucun releve actif n'existe pour ce creneau -> CTA "Saisir".
 */
export type EquipementsTodayCellStatut = 'SAISI' | 'ALERTE' | 'MANQUANT';

/**
 * Une cellule (equipement x creneau) du tableau "Releves du jour".
 *
 * Quand `statut === 'MANQUANT'`, `temperature` et `releveId` sont `null`.
 * Quand `statut === 'SAISI' | 'ALERTE'`, `temperature` est defini et
 * `releveId` permet a l'UI de pointer vers la fiche releve (consultation).
 *
 * `creneau` est duplique sur la cellule (en plus de la cle parent) pour
 * faciliter le rendu sans destructuration verbeuse cote composant.
 */
export interface EquipementsTodayCell {
  readonly statut: EquipementsTodayCellStatut;
  readonly temperature: number | null;
  readonly releveId: string | null;
  readonly creneau: Creneau;
}

/**
 * Une ligne du tableau "Releves du jour" : un equipement actif x ses 3
 * creneaux. La cle `cells` est un Record exhaustif des 3 creneaux (pas
 * de cellule absente -> la UI peut indexer en toute securite).
 */
export interface EquipementsTodayRow {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly seuilMin: number;
  readonly seuilMax: number;
  readonly cells: Readonly<Record<Creneau, EquipementsTodayCell>>;
}

/**
 * Tableau "equipements x creneaux du jour" pour le dashboard accueil
 * (feat/dashboard-as-home).
 *
 * `dateISO` est la date Europe/Paris (`YYYY-MM-DD`) utilisee pour le
 * scope releve (typiquement `todayParisISO()`). Expose pour permettre a
 * l'UI d'afficher la date du jour et tester la coherence.
 *
 * `rows` est trie de facon stable : boutique nom asc puis equipement
 * nom asc (l'ordre est garanti par la requete Prisma).
 */
export interface EquipementsTodayBoard {
  readonly dateISO: string;
  readonly rows: readonly EquipementsTodayRow[];
}
