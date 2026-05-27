import { z } from 'zod';

/**
 * Schemas Zod pour les Server Actions Photo (US-PHO-001).
 *
 * Convention HACCP :
 *   - On valide uniquement les champs scalaires (alerteId / photoId).
 *   - Le `File` est extrait separement de `FormData` puis valide dans
 *     le service (`uploadPhotoToAlerte`) via :
 *       1. `file instanceof File` (narrowing)
 *       2. `file.size <= MAX_PHOTO_SIZE_BYTES`
 *       3. `isPhotoMimeType(file.type)`
 *     Zod ne supporte pas nativement `File` cote serveur (env Node
 *     before 20 sans le globalThis File) ; on cantonne cette
 *     responsabilite a un seul endroit (le service), ce qui simplifie
 *     les tests et evite la duplication avec un schema mixte.
 */

const ALERTE_ID_INVALID = 'Identifiant alerte invalide';
const PHOTO_ID_INVALID = 'Identifiant photo invalide';

export const photoUploadSchema = z.object({
  alerteId: z.string().uuid(ALERTE_ID_INVALID),
});

export const photoDeleteSchema = z.object({
  photoId: z.string().uuid(PHOTO_ID_INVALID),
  alerteId: z.string().uuid(ALERTE_ID_INVALID),
});

export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;
export type PhotoDeleteInput = z.infer<typeof photoDeleteSchema>;
