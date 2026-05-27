/**
 * Types publics du domaine Photo (US-PHO-001).
 *
 * Conventions :
 *   - `PhotoMimeType` est une union literale (whitelist HACCP) plutot
 *     qu'un alias `string`. Le service refuse tout MIME hors de cette
 *     liste avant l'upload (defense en profondeur cote serveur, en plus
 *     de l'attribut `accept` du `<input type="file">`).
 *   - `PhotoListItem` embarque l'`imageUrl` deja calculee par le
 *     service. L'UI ne re-derive jamais d'URL elle-meme : centralisation
 *     du choix d'access (public non-listable vs URL signee).
 *
 *     Honnetete nominale (v1.1) : ce champ s'appelait `signedUrl` en v1
 *     mais l'URL n'est PAS signee. Vercel Blob est configure avec
 *     `access: 'public'` + pathname `<timestamp>-<uuid>` non-listable
 *     (16+ bytes d'entropie). Le rename `signedUrl -> imageUrl` evite
 *     un nom qui ment. Pre-cabling reste en place pour migration future
 *     vers `access: 'private'` + TTL si besoin reglementaire.
 *   - `PhotoError` enumere toutes les conditions metier remontees par
 *     le service via `Result<T, PhotoError>` (Clean Code #7).
 */

export type PhotoMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PhotoListItem {
  readonly id: string;
  readonly alerteId: string;
  readonly mimeType: PhotoMimeType;
  readonly sizeBytes: number;
  readonly filename: string;
  readonly uploadedByName: string;
  readonly uploadedByUserId: string;
  readonly createdAt: Date;
  readonly imageUrl: string;
}

export interface PhotoUploadResult {
  readonly id: string;
  readonly imageUrl: string;
}

export type PhotoError =
  | 'FORBIDDEN'
  | 'ALERTE_NOT_FOUND'
  | 'PHOTO_NOT_FOUND'
  | 'INVALID_MIME'
  | 'TOO_LARGE'
  | 'QUOTA_EXCEEDED'
  | 'STORAGE_FAILURE'
  | 'INTERNAL';
