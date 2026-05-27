import { randomUUID } from 'node:crypto';
import {
  ALLOWED_SIGNATURE_MIME_TYPES,
  PNG_MAGIC_BYTES,
} from '@/lib/constants/signature';
import type { SignatureMimeType } from '@/types/signature';

/**
 * Helpers Signature (US-SIG-001) - cote serveur.
 *
 * `sanitizeFilename` : protege contre l'injection de chemin
 *   (`../../etc/passwd`) en remplacant tous les caracteres hors
 *   `[a-zA-Z0-9._-]` par `_`. Tronque a 100 caracteres pour eviter de
 *   stocker des noms abusifs en DB.
 *
 * `generateStorageKey` : pathname canonique non-guessable pour Vercel
 *   Blob, du type `signatures/<boutiqueId>/<dateISO>/<timestamp>-<uuid>.png`.
 *   Le couple `<timestamp>-<uuid>` (16+ bytes d'entropie) evite les
 *   collisions et empeche l'enum par scraping d'URL. Le `dateISO` dans
 *   le chemin facilite le debug operationnel (audit DDPP) sans cout
 *   securite (la date d'un registre est non-sensible).
 *
 * `isPngMimeType` : type guard. Refuse tout MIME hors whitelist.
 *
 * `verifyPngMagicBytes` : defense en profondeur. Le `file.type` declare
 *   par le browser ne fait pas foi : on lit les 8 premiers bytes pour
 *   confirmer la signature PNG (RFC 2083). Refus si la signature ne
 *   matche pas.
 */

const FILENAME_SAFE_REGEX = /[^a-zA-Z0-9._-]/g;
const MAX_FILENAME_LENGTH = 100;
const PNG_EXTENSION = 'png';

export function sanitizeFilename(name: string): string {
  const replaced = name.replace(FILENAME_SAFE_REGEX, '_');
  if (replaced.length === 0) {
    return 'signature';
  }
  return replaced.slice(0, MAX_FILENAME_LENGTH);
}

interface GenerateStorageKeyArgs {
  readonly boutiqueId: string;
  readonly dateISO: string;
}

export function generateStorageKey({
  boutiqueId,
  dateISO,
}: GenerateStorageKeyArgs): string {
  const timestamp = Date.now();
  const uniqueId = randomUUID();
  return `signatures/${boutiqueId}/${dateISO}/${timestamp}-${uniqueId}.${PNG_EXTENSION}`;
}

export function isPngMimeType(value: string): value is SignatureMimeType {
  return (ALLOWED_SIGNATURE_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Verifie la signature binaire PNG (RFC 2083 : 89 50 4E 47 0D 0A 1A 0A)
 * sur les 8 premiers bytes du buffer. Retourne `true` uniquement si la
 * signature est complete et exacte.
 */
export function verifyPngMagicBytes(buffer: Uint8Array): boolean {
  if (buffer.length < PNG_MAGIC_BYTES.length) {
    return false;
  }
  for (let i = 0; i < PNG_MAGIC_BYTES.length; i += 1) {
    if (buffer[i] !== PNG_MAGIC_BYTES[i]) {
      return false;
    }
  }
  return true;
}
