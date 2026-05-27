import { randomUUID } from 'node:crypto';
import { ALLOWED_PHOTO_MIME_TYPES } from '@/lib/constants/photo';
import type { PhotoMimeType } from '@/types/photo';

/**
 * Helpers Photo (US-PHO-001) - cote serveur.
 *
 * `sanitizeFilename` : protege contre l'injection de chemin
 *   (`../../etc/passwd`) en remplacant tous les caracteres hors
 *   `[a-zA-Z0-9._-]` par `_`. Tronque a 100 caracteres pour eviter de
 *   stocker des noms abusifs en DB. Le filename n'est jamais utilise
 *   directement comme chemin de stockage (cf. `generateStorageKey`),
 *   mais on conserve une version safe pour l'audit/affichage.
 *
 * `generateStorageKey` : pathname canonique non-guessable pour Vercel
 *   Blob, du type `photos/<alerteId>/<timestamp>-<uuid>.<ext>`. Le
 *   couple `<timestamp>-<uuid>` evite les collisions et empeche l'enum
 *   par scraping d'URL.
 *
 * `isPhotoMimeType` : type guard utilise par le service avant l'upload
 *   pour eviter un `as PhotoMimeType` non-securise.
 *
 * `verifyImageMagicBytes` : defense en profondeur contre le MIME
 *   spoofing. Le `file.type` declare par le browser ne fait pas foi :
 *   on lit les premiers bytes du buffer pour confirmer le type reel.
 *   Retourne le type detecte ou `null` si aucun magic bytes connu ne
 *   matche (= refus upload).
 */

const FILENAME_SAFE_REGEX = /[^a-zA-Z0-9._-]/g;
const MAX_FILENAME_LENGTH = 100;

const MIME_TO_EXTENSION: Readonly<Record<PhotoMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Signatures binaires (magic bytes) des formats autorises.
// References RFC :
//   - JPEG  : 0xFF 0xD8 0xFF (3 premiers bytes - SOI marker)
//   - PNG   : 89 50 4E 47 0D 0A 1A 0A (8 premiers bytes - signature)
//   - WebP  : "RIFF" (4 bytes) + 4 bytes size + "WEBP" (bytes 8-11)
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP"

export function sanitizeFilename(name: string): string {
  const replaced = name.replace(FILENAME_SAFE_REGEX, '_');
  if (replaced.length === 0) {
    return 'photo';
  }
  return replaced.slice(0, MAX_FILENAME_LENGTH);
}

export function generateStorageKey(
  alerteId: string,
  mimeType: PhotoMimeType
): string {
  const extension = MIME_TO_EXTENSION[mimeType];
  const timestamp = Date.now();
  const uniqueId = randomUUID();
  return `photos/${alerteId}/${timestamp}-${uniqueId}.${extension}`;
}

export function isPhotoMimeType(value: string): value is PhotoMimeType {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(value);
}

function startsWith(buffer: Uint8Array, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i += 1) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

function isWebpBuffer(buffer: Uint8Array): boolean {
  if (buffer.length < 12) {
    return false;
  }
  if (!startsWith(buffer, WEBP_RIFF)) {
    return false;
  }
  // "WEBP" tag attendu en bytes [8..12[, apres les 4 bytes de file size.
  for (let i = 0; i < WEBP_TAG.length; i += 1) {
    if (buffer[8 + i] !== WEBP_TAG[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detecte le type d'une image a partir de ses magic bytes. Retourne
 * `null` si aucun format autorise (JPEG/PNG/WebP) ne correspond.
 *
 * Le service doit comparer le retour au `file.type` declare par le
 * browser : un mismatch indique une tentative de MIME spoofing.
 */
export function verifyImageMagicBytes(
  buffer: Uint8Array
): PhotoMimeType | null {
  if (startsWith(buffer, JPEG_MAGIC)) {
    return 'image/jpeg';
  }
  if (startsWith(buffer, PNG_MAGIC)) {
    return 'image/png';
  }
  if (isWebpBuffer(buffer)) {
    return 'image/webp';
  }
  return null;
}
