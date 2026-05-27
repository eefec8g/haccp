import { describe, it, expect } from 'vitest';
import {
  SIGNATURE_ERROR_MESSAGES,
  resolveSignatureErrorMessage,
} from './signature-error-messages';

/**
 * Tests `resolveSignatureErrorMessage` (US-SIG-001 DRY).
 *
 * Couvre les chemins :
 *   - code connu (FORBIDDEN, SIGNATURE_ALREADY_EXISTS, RATE_LIMITED, ...)
 *   - code inconnu -> fallback INTERNAL
 *   - undefined -> fallback INTERNAL
 *   - chaine vide -> fallback INTERNAL
 *   - integrite du dictionnaire (toutes les cles documentees presentes)
 */
describe('[Signature] resolveSignatureErrorMessage', () => {
  it('should return the mapped message for a known FORBIDDEN code', () => {
    expect(resolveSignatureErrorMessage('FORBIDDEN')).toBe(
      "Vous n'avez pas la permission de signer ce registre."
    );
  });

  it('should return the mapped message for SIGNATURE_ALREADY_EXISTS', () => {
    expect(resolveSignatureErrorMessage('SIGNATURE_ALREADY_EXISTS')).toBe(
      'Ce registre a deja ete signe pour cette journee.'
    );
  });

  it('should return the mapped message for MAGIC_BYTES_FAIL', () => {
    expect(resolveSignatureErrorMessage('MAGIC_BYTES_FAIL')).toBe(
      'Le fichier ne correspond pas a une signature PNG valide.'
    );
  });

  it('should return the mapped message for RATE_LIMITED', () => {
    expect(resolveSignatureErrorMessage('RATE_LIMITED')).toBe(
      'Trop de tentatives. Reessayez plus tard.'
    );
  });

  it('should fall back to INTERNAL when the code is unknown', () => {
    expect(resolveSignatureErrorMessage('UNKNOWN_CODE_42')).toBe(
      SIGNATURE_ERROR_MESSAGES.INTERNAL
    );
  });

  it('should fall back to INTERNAL when the code is undefined', () => {
    expect(resolveSignatureErrorMessage(undefined)).toBe(
      SIGNATURE_ERROR_MESSAGES.INTERNAL
    );
  });

  it('should fall back to INTERNAL when the code is an empty string', () => {
    expect(resolveSignatureErrorMessage('')).toBe(
      SIGNATURE_ERROR_MESSAGES.INTERNAL
    );
  });

  it('should expose all documented error codes in the dictionary', () => {
    const expectedKeys = [
      'FORBIDDEN',
      'VALIDATION',
      'INVALID_FILE',
      'BOUTIQUE_NOT_FOUND',
      'SIGNATURE_NOT_FOUND',
      'SIGNATURE_ALREADY_EXISTS',
      'INVALID_MIME',
      'TOO_LARGE',
      'MAGIC_BYTES_FAIL',
      'STORAGE_FAILURE',
      'RATE_LIMITED',
      'INTERNAL',
    ];
    for (const key of expectedKeys) {
      const message = SIGNATURE_ERROR_MESSAGES[key];
      expect(message).toBeDefined();
      expect(message?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
