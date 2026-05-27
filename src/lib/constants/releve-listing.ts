import type { ReleveListingStatut } from '@/types/releve-listing';

/**
 * Constantes de l'Epic LISTING (Phase 1).
 *
 * Centralisees ici pour eviter les magic numbers/strings dans le service
 * et les futurs composants UI (Phase 2). Toutes les valeurs sont `readonly`
 * (`as const`) pour l'immutabilite (Clean Code #2 + #8).
 *
 * Decisions Phase 0.5 validees user :
 *   - 30 jours par defaut (cas dominant "ce dernier mois").
 *   - 92 jours max (~3 mois) -- legerement plus large que les exports
 *     car la consultation interactive ne genere pas de fichier audit
 *     a relire (1 page UI, pas de PDF/CSV embarque). Volontairement
 *     decouple de `MAX_EXPORT_RANGE_DAYS` (=90) pour cette raison.
 *   - 50 items/page par defaut (compromis lisibilite/perf reseau).
 *   - 200 items/page max (hard limit anti-DoS sur ?pageSize=10000).
 *   - 50 000 releves max remontes par le service (hard limit memoire
 *     Vercel Hobby 256MB), cf. `HARD_LIMIT_RELEVES`.
 */

/**
 * Periode par defaut (en jours) quand la query ne specifie pas dateStart/dateEnd.
 *
 * 30 jours = mois calendaire glissant, granularite naturelle pour le
 * suivi HACCP courant (RG-LECT-001 du salarie est 7j ; on offre 4x plus
 * au responsable pour superviser l'historique).
 */
export const DEFAULT_PERIODE_DAYS = 30;

/**
 * Periode maximale autorisee.
 *
 * 92 jours = ~3 mois calendaires. Volontairement plus large que
 * `MAX_EXPORT_RANGE_DAYS` (=90) : la consultation interactive ne genere
 * pas de fichier audit a relire (1 page UI, pas de PDF/CSV embarque),
 * on tolere donc une fenetre legerement plus large pour permettre de
 * couvrir 31 jours mensuels + 30 jours adjacents + jours de marge.
 */
export const MAX_PERIODE_DAYS = 92;

/**
 * Hard limit du nombre de releves remontes par le service (defense
 * memoire Vercel Hobby 256MB).
 *
 * Worst-case ADMIN multi-tenant sur 92 jours x 100 boutiques x 500
 * equipements x 3 creneaux ~= 138 000 cellules + jusqu'a 150k releves
 * annules historiques -> environ 300 000 lignes potentielles. Bornes
 * cette materialisation a 50 000 lignes (chaque ligne ~= 200-300
 * octets en memoire => ~15MB max, marge confortable). Au-dela, le
 * service retourne `TOO_MANY_RESULTS` et invite a filtrer (boutique,
 * equipement, periode plus courte).
 */
export const HARD_LIMIT_RELEVES = 50_000;

/**
 * Pagination par defaut quand la query ne specifie pas `pageSize`.
 *
 * 50 = compromis "voir suffisamment de contexte sans saturer le DOM" sur
 * un tableau dense (matrice equipements x creneaux x jours).
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Borne dure de `pageSize` (hard limit anti-DoS).
 *
 * 200 = limite raisonnable pour un export type "voir 200 lignes d'un
 * coup". Au-dela, l'utilisateur doit utiliser l'export CSV/PDF dedie.
 */
export const MAX_PAGE_SIZE = 200;

/**
 * Libelles FR pour les badges statut dans l'UI (Phase 2). Centralises ici
 * pour DRY entre la table, les filtres et les stats.
 */
export const STATUT_LABELS: Readonly<Record<ReleveListingStatut, string>> = {
  SAISI: 'Saisi',
  ALERTE: 'Hors seuils',
  MANQUANT: 'Manquant',
  ANNULE: 'Annule',
} as const;

/**
 * Classes Tailwind charte Maison Givre pour les badges statut.
 *
 * - `SAISI`    : noir profond (neutre, conformite OK).
 * - `ALERTE`   : or Maison Givre (accent attention, RG-SEUIL-001).
 * - `MANQUANT` : noir attenue (40%) -- visible mais discret.
 * - `ANNULE`   : noir attenue (30%) + italic -- "barre" visuelle pour
 *                signaler l'invalidation tout en restant lisible.
 */
export const STATUT_COLORS: Readonly<Record<ReleveListingStatut, string>> = {
  SAISI: 'text-mg-noir',
  ALERTE: 'text-mg-or',
  MANQUANT: 'text-mg-noir/40',
  ANNULE: 'text-mg-noir/30 italic',
} as const;
