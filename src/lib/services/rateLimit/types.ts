/**
 * Types publics du module rate-limit HACCP.
 *
 * Le module expose une seule abstraction `RateLimitProvider` (port)
 * et plusieurs implementations (adapters) : Upstash Redis distribue
 * en production, in-memory sliding window en dev / fallback. Cette
 * separation respecte le principe DIP (Clean Code #5) : le code metier
 * (Server Actions) ne depend que de l'interface.
 */

/**
 * Identifie le type de rate-limit a appliquer. Chaque type a sa propre
 * configuration (maxRequests / window) declaree dans `config.ts`.
 *
 * - `LOGIN`             : 5 / 15 min, anti brute-force /login.
 * - `PASSWORD_RESET`    : 3 / 1h,    anti spam reset mdp.
 * - `USER_INVITE`       : 10 / 1h,   anti spam admin invitations.
 * - `INVITATION_ACCEPT` : 5 / 15 min, anti brute-force token.
 */
export type RateLimitType =
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'USER_INVITE'
  | 'INVITATION_ACCEPT';

/**
 * Resultat normalise d'une verification rate-limit.
 *
 * - `allowed`           : false => la requete doit etre refusee.
 * - `remainingRequests` : nb de requetes restantes dans la fenetre.
 * - `resetAtMs`         : epoch ms a laquelle le compteur sera reset.
 * - `retryAfterMs`      : delai (ms) avant de retenter (clamp a 0).
 *                         Present uniquement si `allowed=false`.
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remainingRequests: number;
  readonly resetAtMs: number;
  readonly retryAfterMs?: number;
}

/**
 * Port du module.
 *
 * - `checkAndRecord` : verifie l'eligibilite ET enregistre la tentative
 *   (atomique cote Redis avec sliding window). C'est l'operation
 *   principale du chemin d'auth (anti brute-force).
 * - `peek`           : verifie SANS incrementer (utile pour afficher l'etat
 *   d'un quota sans le consommer, par exemple sur une UI admin).
 * - `reset`          : remet le compteur a zero (utile en admin/tests).
 */
export interface RateLimitProvider {
  checkAndRecord(
    type: RateLimitType,
    identifier: string
  ): Promise<RateLimitResult>;
  peek(type: RateLimitType, identifier: string): Promise<RateLimitResult>;
  reset(type: RateLimitType, identifier: string): Promise<void>;
}
