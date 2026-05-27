import type { PhotoMimeType } from '@/types/photo';

/**
 * Constantes du domaine Photo (US-PHO-001).
 *
 * Sources de verite uniques pour les limites et formats :
 *   - Limites alignees Phase 0 (Epic PHOTOS state) : 3 photos max par
 *     alerte, 2 MB par photo post-compression, 20 uploads/h par user.
 *   - Compression client (canvas API, Phase 1 partie 2) : resize max
 *     1920 px (cote le plus long) + qualite JPEG 80 %. Ces constantes
 *     sont exportees ici pour rester sous controle backend (cohesion
 *     domain), meme si elles ne sont consommees que par le composant
 *     `'use client'` `PhotoUploadForm`.
 *   - L'URL Vercel Blob `access: 'public'` est non-listable mais
 *     accessible permanente : `PHOTO_SIGNED_URL_TTL_SECONDS` est expose
 *     en prevision d'une migration vers `access: 'private'` ulterieure
 *     (cf. justification dans `photo.service.ts`).
 */

const BYTES_PER_MB = 1024 * 1024;

export const MAX_PHOTO_SIZE_MB = 2;
export const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * BYTES_PER_MB;
export const MAX_PHOTOS_PER_ALERTE = 3;

export const ALLOWED_PHOTO_MIME_TYPES: readonly PhotoMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const PHOTO_SIGNED_URL_TTL_SECONDS = 3600;
export const PHOTO_CLIENT_RESIZE_MAX_PX = 1920;
export const PHOTO_CLIENT_QUALITY = 0.8;
