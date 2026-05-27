/**
 * Constantes de l'Epic DASHBOARD (Phase 1 - socle commun).
 *
 * Centralisees ici pour eviter les magic numbers dans les services et la
 * UI (Clean Code #2). Valeurs `as const` pour preserver l'immutabilite
 * (Clean Code #8).
 */

/**
 * Nombre maximum d'alertes recentes affichees sur le dashboard. Au-dela
 * on renvoie l'utilisateur vers `/alertes` (vue complete paginee).
 */
export const DASHBOARD_ALERT_DISPLAY_LIMIT = 5 as const;

/**
 * Nombre maximum d'entrees d'audit affichees sur le dashboard Admin.
 * Vue resumee, l'admin va sur `/admin/audit-log` pour l'historique
 * complet.
 */
export const DASHBOARD_AUDIT_LOG_LIMIT = 5 as const;

/**
 * Nombre maximum d'equipements en defaut listes dans le tableau "saisies
 * manquantes". Borne haute pour eviter le dump d'une page massive si un
 * parc complet est en defaut.
 */
export const DASHBOARD_MISSING_RELEVE_LIMIT = 20 as const;

/**
 * Fenetre temporelle (en jours) des graphiques de tendance du dashboard.
 * Aligne sur `DAYS_RECENT_HISTORY` (Epic RELEVE) pour coherence des
 * fenetres metiers.
 */
export const DASHBOARD_TREND_DAYS = 7 as const;
