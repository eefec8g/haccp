import { z } from 'zod';

/**
 * Schemas Zod pour les Server Actions Signature (US-SIG-001).
 *
 * Convention HACCP :
 *   - On valide les champs scalaires (boutiqueId, dateISO).
 *   - Le `File` est extrait separement de `FormData` et valide dans le
 *     service (`uploadSignatureToRegistre`) via :
 *       1. `file instanceof File` (narrowing)
 *       2. `file.size <= MAX_SIGNATURE_BYTES`
 *       3. `isPngMimeType(file.type)`
 *       4. `verifyPngMagicBytes(buffer)` (defense en profondeur).
 *
 *   Cette responsabilite est cantonnee au service (pas Zod) pour eviter
 *   un schema mixte serveur-only (File n'existe pas partout dans Zod).
 *
 * Format `dateISO` : `YYYY-MM-DD` strict (regex). Ne valide PAS la
 * coherence calendrier (mois 13, jour 32) ; cette responsabilite revient
 * au service appelant qui peut comparer a la date du jour si necessaire.
 */

const BOUTIQUE_ID_INVALID = 'Identifiant boutique invalide';
const DATE_ISO_INVALID = 'Date invalide (format attendu : YYYY-MM-DD)';

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const signatureUploadSchema = z.object({
  boutiqueId: z.string().uuid(BOUTIQUE_ID_INVALID),
  dateISO: z.string().regex(DATE_ISO_REGEX, DATE_ISO_INVALID),
});

export type SignatureUploadInput = z.infer<typeof signatureUploadSchema>;
