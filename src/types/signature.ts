import type { UserRole } from '@prisma/client';

/**
 * Types publics du domaine Signature (US-SIG-001).
 *
 * Conventions :
 *   - `SignatureMimeType` est volontairement un litteral 'image/png'.
 *     Les signatures sont exclusivement PNG (canvas natif `toBlob`).
 *     Refus strict du service pour tout autre MIME.
 *   - `SignatureRow` embarque `imageUrl` deja calculee par le service
 *     (centralisation du choix d'access public non-listable, identique
 *     PHOTOS).
 *   - `SignatureError` enumere les conditions metier remontees via
 *     `Result<T, SignatureError>` (Clean Code #7).
 *   - Re-signature interdite : la collision sur `(boutiqueId, dateISO)`
 *     remonte `SIGNATURE_ALREADY_EXISTS` (premier qui signe verrouille).
 */

export type SignatureMimeType = 'image/png';

export interface SignaturePayload {
  readonly boutiqueId: string;
  readonly dateISO: string;
}

export interface SignatureViewer {
  readonly id: string;
  readonly role: UserRole;
}

export interface SignatureRequestMetadata {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface SignatureRow {
  readonly id: string;
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly signataireId: string;
  readonly signataireName: string;
  readonly signataireRoleSnapshot: UserRole;
  readonly imageUrl: string;
  readonly signedAt: Date;
}

export interface SignatureUploadResult {
  readonly id: string;
  readonly imageUrl: string;
  readonly signedAt: Date;
}

export type SignatureError =
  | 'FORBIDDEN'
  | 'BOUTIQUE_NOT_FOUND'
  | 'SIGNATURE_NOT_FOUND'
  | 'SIGNATURE_ALREADY_EXISTS'
  | 'INVALID_MIME'
  | 'TOO_LARGE'
  | 'MAGIC_BYTES_FAIL'
  | 'STORAGE_FAILURE'
  | 'INTERNAL';
