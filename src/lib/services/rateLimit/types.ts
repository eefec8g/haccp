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
 * - `LOGIN`              : 5 / 15 min, anti brute-force /login.
 * - `PASSWORD_RESET`     : 3 / 1h,    anti spam reset mdp.
 * - `USER_INVITE`        : 10 / 1h,   anti spam admin invitations.
 * - `INVITATION_ACCEPT`  : 5 / 15 min, anti brute-force token.
 * - `RELEVE_CREATE`      : 60 / 5 min, sature pour saisie operationnelle
 *                         (cas reel : ~15 releves/jour/salarie). Garde-fou
 *                         anti-script/replay, pas contrainte UX.
 * - `RELEVE_ANNULATION`  : 10 / 1h,   action rare (correction responsable).
 * - `ALERTE_RESOLVE`     : 30 / 1h,   responsable resout en pic d'activite.
 * - `EXPORT_CSV`         : 5 / 1h,    Epic EXPORT (CSV streaming, cout DB
 *                         + I/O moyen, garde-fou OOM serverless).
 * - `EXPORT_PDF`         : 2 / 1h,    Epic EXPORT (PDF registre journalier,
 *                         cout pdfmake/fonts plus eleve, audit DDPP rare).
 * - `PHOTO_UPLOAD`       : 20 / 1h,   Epic PHOTOS (US-PHO-001). Garde-fou
 *                         anti-spam upload + cout storage Vercel Blob.
 *                         Avec 3 photos max par alerte, ~6 alertes max
 *                         documentees a la photo par heure (large marge).
 * - `SIGNATURE_UPLOAD`   : 10 / 1h,   Epic SIGNATURE (US-SIG-001). Plus
 *                         strict que PHOTO_UPLOAD : signature DDPP rare
 *                         (1 par boutique/jour), garde-fou anti-spam
 *                         renforce sur action critique.
 * - `EXPORT_REGISTRE_CONSOLIDE` : 5 / 1h, Epic REGISTRE (US-REG-001). PDF
 *                         consolide multi-jours (jusqu'a 31 j x N boutiques),
 *                         cout pdfmake + I/O Vercel Blob signatures + audit
 *                         DDPP rare. Meme budget que EXPORT_CSV.
 */
export type RateLimitType =
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'USER_INVITE'
  | 'INVITATION_ACCEPT'
  | 'RELEVE_CREATE'
  | 'RELEVE_ANNULATION'
  | 'ALERTE_RESOLVE'
  | 'EXPORT_CSV'
  | 'EXPORT_PDF'
  | 'PHOTO_UPLOAD'
  | 'SIGNATURE_UPLOAD'
  | 'EXPORT_REGISTRE_CONSOLIDE';

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
