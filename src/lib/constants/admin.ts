import type { UserRole } from '@prisma/client';

/**
 * Constantes de l'Epic ADMIN.
 *
 * Centralisees ici pour eviter les magic numbers/strings dans les
 * services, validations et UI (regle Clean Code #2). Toutes les valeurs
 * sont readonly (`as const`) pour l'immutabilite (regle #8).
 */

/**
 * Duree de validite d'un token d'invitation (24h). Au-dela, le lien
 * d'acceptation est refuse. Decision technique Epic ADMIN.
 */
export const INVITATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Pagination par defaut des listings admin (25 / page). La borne max
 * sert a refuser les requetes hostiles `?pageSize=10000`.
 */
export const ADMIN_PAGE_SIZE = 25;
export const ADMIN_PAGE_SIZE_MAX = 100;

/**
 * Rate limit envoi d'invitations : 10 / heure / admin. Evite qu'un
 * compte admin compromis (ou bot) spamme les invitations email.
 */
export const INVITATION_RATE_LIMIT_MAX = 10;
export const INVITATION_RATE_LIMIT_WINDOW = '1 h' as const;

/**
 * Rate limit acceptation d'invitation : 5 tentatives / 15 min / IP.
 * Anti-bruteforce sur le token (meme si 256 bits, defense en profondeur).
 */
export const ACCEPT_INVITATION_RATE_LIMIT_MAX = 5;
export const ACCEPT_INVITATION_RATE_LIMIT_WINDOW = '15 m' as const;

/**
 * Bornes de validation Zod pour les entites admin.
 */
export const BOUTIQUE_NOM_MIN = 2;
export const BOUTIQUE_NOM_MAX = 100;
export const BOUTIQUE_ADRESSE_MAX = 200;
export const BOUTIQUE_VILLE_MAX = 100;

export const EQUIPEMENT_NOM_MIN = 1;
export const EQUIPEMENT_NOM_MAX = 50;

/**
 * Bornes des seuils de temperature (en degC). -50/+50 couvre largement
 * tous les equipements alimentaires (chambres froides negatives jusqu'a
 * -40, vitrines positives jusqu'a +10).
 */
export const SEUIL_TEMP_MIN = -50;
export const SEUIL_TEMP_MAX = 50;

export const USER_NOM_MAX = 100;

/**
 * Borne max d'une adresse email (RFC 5321 : 254 caracteres). Sert
 * surtout d'attribut HTML `maxLength` cote formulaire ; le Zod
 * email valide deja la structure.
 */
export const EMAIL_MAX = 254;

export const ENTITY_DISABLE_MOTIF_MAX = 500;

/**
 * Taille de page utilisee quand on charge des boutiques pour alimenter
 * un selecteur (formulaire invitation, formulaire equipement, filtre
 * liste). 200 couvre largement le parc Maison Givre prevu (~30 sites
 * max a moyen terme) sans necessiter de paginer le selecteur.
 */
export const BOUTIQUE_OPTIONS_MAX = 200;

/**
 * Roles qu'un admin peut assigner via le module d'invitation.
 * On expose les 3 roles : un admin peut promouvoir un autre admin
 * (transmission), un RESPONSABLE et un SALARIE.
 */
export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  'SALARIE',
  'RESPONSABLE',
  'ADMIN',
] as const;
