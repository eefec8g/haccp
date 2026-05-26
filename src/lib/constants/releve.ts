import type { Creneau } from '@prisma/client';

/**
 * Constantes de l'Epic RELEVE (socle commun).
 *
 * Centralisees ici pour eviter les magic numbers/strings dans les
 * services, validations et UI (Clean Code #2). Toutes les valeurs sont
 * readonly (`as const`) pour l'immutabilite (Clean Code #8).
 */

/** Libelle francais d'un creneau, utilise par l'UI tournee + historique. */
export const CRENEAU_LABELS: Readonly<Record<Creneau, string>> = {
  MATIN: 'Matin',
  MIDI: 'Midi',
  SOIR: 'Soir',
} as const;

/** Ordre d'affichage canonique des 3 creneaux d'une journee. */
export const CRENEAU_ORDER: readonly Creneau[] = [
  'MATIN',
  'MIDI',
  'SOIR',
] as const;

/**
 * Bornes horaires des creneaux en heure locale Europe/Paris (decision
 * technique #1 validee user). Intervalles disjoints `[start, end[` :
 *   - MATIN [5h, 12h[
 *   - MIDI  [12h, 17h[
 *   - SOIR  [17h, 23h[
 *
 * Hors plage (23h-5h) : pas de creneau "courant" (cf. getCurrentCreneau).
 */
export const CRENEAU_HEURES: Readonly<
  Record<Creneau, { readonly start: number; readonly end: number }>
> = {
  MATIN: { start: 5, end: 12 },
  MIDI: { start: 12, end: 17 },
  SOIR: { start: 17, end: 23 },
} as const;

/** Fuseau horaire reference pour les regles metier HACCP. */
export const TIMEZONE = 'Europe/Paris' as const;

/**
 * Commentaire obligatoire si releve hors seuils (alerte). La borne min
 * empeche les commentaires inutiles "ok" / "rien" et force le salarie
 * a documenter la cause (RG-COMM-001).
 */
export const COMMENTAIRE_MIN_CHARS = 10;
export const COMMENTAIRE_MAX_CHARS = 500;

/**
 * Nombre de jours visibles dans l'historique recent du salarie
 * (US-REL-003). 7 jours = visibilite raisonnable sans pagination lourde.
 */
export const DAYS_RECENT_HISTORY = 7;

/**
 * Motif obligatoire pour annuler un releve (US-REL-004). Force le
 * responsable a documenter pourquoi (audit HACCP).
 */
export const MOTIF_ANNULATION_MIN_CHARS = 10;
export const MOTIF_ANNULATION_MAX_CHARS = 500;

/**
 * Bornes temperature pour Zod. Plus larges que les seuils equipement
 * (`SEUIL_TEMP_MIN/MAX` -50/50) pour tolerer la saisie d'erreurs
 * legeres et laisser le service trancher "hors seuils".
 */
export const TEMPERATURE_MIN = -60;
export const TEMPERATURE_MAX = 60;

/**
 * Si l'ecart absolu entre la temperature saisie et le seuil le plus
 * proche depasse ce seuil (en degC), l'UI affiche un warning UX
 * "etes-vous sur ?" (cas classique : 180 au lieu de 18.0). Pure UX,
 * n'empeche pas la soumission.
 */
export const TEMPERATURE_WARNING_THRESHOLD = 20;
