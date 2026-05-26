import type { UserRole } from '@prisma/client';

/**
 * Cout bcrypt (rounds). >= 12 requis par EX-AUTH-005 (CCF.md).
 * 12 = ~250ms de hash sur CPU moderne, bon compromis securite/UX.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Longueur minimale d'un mot de passe utilisateur.
 */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Regle de complexite : au moins une minuscule, une majuscule,
 * un chiffre, un caractere special. Longueur >= PASSWORD_MIN_LENGTH.
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

/**
 * Validite d'un reset token (1h). Au-dela, le token est expire.
 */
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Duree max d'une session JWT (30 min, EX-AUTH-003).
 */
export const JWT_MAX_AGE_SECONDS = 30 * 60;

/**
 * Longueur (octets) du token reset avant encodage base64url.
 * 32 octets = 256 bits d'entropie, recommande par OWASP.
 */
export const RESET_TOKEN_BYTES = 32;

/**
 * Map de redirection post-login selon le role utilisateur.
 * Decision technique (epic-state.md) :
 * - SALARIE / RESPONSABLE -> /releves (la grille de saisie)
 * - ADMIN -> /admin (parametrage parc)
 */
export const POST_LOGIN_REDIRECT: Readonly<Record<UserRole, string>> = {
  SALARIE: '/releves',
  RESPONSABLE: '/releves',
  ADMIN: '/admin',
} as const;
