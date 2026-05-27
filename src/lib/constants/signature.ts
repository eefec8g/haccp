import type { SignatureMimeType } from '@/types/signature';

/**
 * Constantes du domaine Signature (US-SIG-001).
 *
 * Sources de verite uniques pour les limites et formats :
 *   - `MAX_SIGNATURE_BYTES` : 200 KB. Le canvas 500x200 PNG sans
 *     compression genere typiquement 20-80 KB ; 200 KB laisse une marge
 *     confortable tout en evitant un upload abusif (anti-spam DDoS).
 *   - `SIGNATURE_MIME` : exclusivement `image/png` (canvas natif
 *     `HTMLCanvasElement.toBlob('image/png')`).
 *   - `PNG_MAGIC_BYTES` : signature binaire RFC 2083 (89 50 4E 47 0D 0A
 *     1A 0A). Verifiee server-side avant l'upload Blob (defense en
 *     profondeur contre le MIME spoofing).
 *   - Dimensions canvas : 500x200 (aspect 2.5:1). Lisible dans le PDF
 *     registre journalier sans rescaling (validee Phase 0.5 - decision 6).
 *   - `MAX_SIGNATURE_HISTORY` : borne defensive pour `listSignaturesForBoutique`.
 *     Au-dela de 50, la pagination devrait etre implementee.
 */

const BYTES_PER_KB = 1024;

export const MAX_SIGNATURE_BYTES = 200 * BYTES_PER_KB;
export const SIGNATURE_MIME: SignatureMimeType = 'image/png';

export const PNG_MAGIC_BYTES = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
] as const;

export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 200;

export const MAX_SIGNATURE_HISTORY = 50;

/**
 * Borne defensive sur la longueur de l'en-tete `User-Agent` persiste en
 * base. Les UA modernes sont generalement < 250 caracteres ; on plafonne
 * a 500 pour absorber les variantes longues (extensions, encart custom)
 * sans risquer un payload abusif (defense en profondeur DoS / DB bloat).
 */
export const MAX_USER_AGENT_LENGTH = 500;

export const ALLOWED_SIGNATURE_MIME_TYPES: readonly SignatureMimeType[] = [
  'image/png',
] as const;

/**
 * Allowlist des hostnames autorises pour le fetch d'une image de
 * signature lors de la generation PDF (SSRF protection). Les URLs Vercel
 * Blob suivent le pattern `<store>.public.blob.vercel-storage.com`.
 * Toute autre origine est refusee : le PDF affiche alors "Signature
 * indisponible".
 */
export const ALLOWED_SIGNATURE_BLOB_HOST_SUFFIX =
  '.public.blob.vercel-storage.com';

/**
 * Timeouts (ms) appliques aux operations reseau externes dans le pipeline
 * signature. Valeurs alignees sur les limites serverless Vercel :
 *   - Fetch GET du PNG dans pdf-builder : 5 s.
 *   - Upload Vercel Blob `put()`        : 8 s (laisse du buffer avant la
 *     limite par defaut de 10 s sur Vercel Hobby).
 */
export const SIGNATURE_FETCH_TIMEOUT_MS = 5_000;
export const SIGNATURE_PUT_TIMEOUT_MS = 8_000;
