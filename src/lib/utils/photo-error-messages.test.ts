import { describe, it, expect } from 'vitest';
import {
  PHOTO_ERROR_MESSAGES,
  resolvePhotoErrorMessage,
} from './photo-error-messages';

/**
 * Tests `resolvePhotoErrorMessage` (US-PHO-001 DRY refactor).
 *
 * Couvre les chemins :
 *   - code connu (FORBIDDEN, QUOTA_EXCEEDED, RATE_LIMITED, ...)
 *   - code inconnu -> fallback INTERNAL
 *   - undefined -> fallback INTERNAL
 *   - chaine vide -> fallback INTERNAL
 *   - integrite du dictionnaire (toutes les cles documentees presentes)
 */
describe('[Photos] resolvePhotoErrorMessage', () => {
  it('should return the mapped message for a known FORBIDDEN code', () => {
    expect(resolvePhotoErrorMessage('FORBIDDEN')).toBe(
      "Vous n'avez pas la permission d'effectuer cette action."
    );
  });

  it('should return the mapped message for QUOTA_EXCEEDED', () => {
    expect(resolvePhotoErrorMessage('QUOTA_EXCEEDED')).toBe(
      'Quota de photos atteint sur cette alerte (3 maximum).'
    );
  });

  it('should return the mapped message for PHOTO_NOT_FOUND (delete-only code)', () => {
    expect(resolvePhotoErrorMessage('PHOTO_NOT_FOUND')).toBe(
      'Photo introuvable ou deja supprimee.'
    );
  });

  it('should return the mapped message for RATE_LIMITED', () => {
    expect(resolvePhotoErrorMessage('RATE_LIMITED')).toBe(
      'Trop de tentatives. Reessayez plus tard.'
    );
  });

  it('should fall back to INTERNAL when the code is unknown', () => {
    expect(resolvePhotoErrorMessage('UNKNOWN_CODE_42')).toBe(
      PHOTO_ERROR_MESSAGES.INTERNAL
    );
  });

  it('should fall back to INTERNAL when the code is undefined', () => {
    expect(resolvePhotoErrorMessage(undefined)).toBe(
      PHOTO_ERROR_MESSAGES.INTERNAL
    );
  });

  it('should fall back to INTERNAL when the code is an empty string', () => {
    expect(resolvePhotoErrorMessage('')).toBe(PHOTO_ERROR_MESSAGES.INTERNAL);
  });

  it('should expose all documented error codes in the dictionary', () => {
    const expectedKeys = [
      'FORBIDDEN',
      'VALIDATION',
      'ALERTE_NOT_FOUND',
      'INVALID_MIME',
      'TOO_LARGE',
      'QUOTA_EXCEEDED',
      'STORAGE_FAILURE',
      'RATE_LIMITED',
      'PHOTO_NOT_FOUND',
      'INTERNAL',
    ];
    for (const key of expectedKeys) {
      const message = PHOTO_ERROR_MESSAGES[key];
      expect(message).toBeDefined();
      expect(message?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
