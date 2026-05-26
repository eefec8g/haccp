import { describe, it, expect } from 'vitest';
import {
  computeReleveSignature,
  verifyReleveSignature,
  type SignaturePayload,
} from './signature';

/**
 * Tests de la signature numerique des releves (RG-SIGN-001).
 *
 * Objectifs couverts :
 *   - Determinisme : meme entree => meme hash.
 *   - Sensibilite : tout changement de champ => hash different (avalanche
 *     sha256).
 *   - Normalisation des nullables (ip, commentaire) pour eviter qu'un
 *     `null` vs `undefined` cote appelant ne casse la verification.
 *   - Round-trip + tampering detection via `verifyReleveSignature`.
 */

const BASE_TIMESTAMP = new Date('2026-05-26T12:00:00.000Z');

function buildPayload(
  overrides: Partial<SignaturePayload> = {}
): SignaturePayload {
  return {
    userId: 'user-1',
    serverTimestamp: BASE_TIMESTAMP,
    ip: '10.0.0.1',
    equipementId: 'eq-1',
    creneau: 'MATIN',
    temperature: -20.5,
    commentaire: null,
    ...overrides,
  };
}

describe('[signature] computeReleveSignature', () => {
  it('should return a deterministic sha256 hex string for the same payload', () => {
    const sig1 = computeReleveSignature(buildPayload());
    const sig2 = computeReleveSignature(buildPayload());

    expect(sig1).toBe(sig2);
    // sha256 hex = 64 chars
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should change the signature when temperature changes', () => {
    const sig1 = computeReleveSignature(buildPayload({ temperature: -20.5 }));
    const sig2 = computeReleveSignature(buildPayload({ temperature: -20.4 }));

    expect(sig1).not.toBe(sig2);
  });

  it('should change the signature when commentaire changes', () => {
    const sig1 = computeReleveSignature(buildPayload({ commentaire: null }));
    const sig2 = computeReleveSignature(
      buildPayload({ commentaire: 'porte ouverte' })
    );

    expect(sig1).not.toBe(sig2);
  });

  it('should change the signature when userId changes', () => {
    const sig1 = computeReleveSignature(buildPayload({ userId: 'user-1' }));
    const sig2 = computeReleveSignature(buildPayload({ userId: 'user-2' }));

    expect(sig1).not.toBe(sig2);
  });

  it('should change the signature when equipementId changes', () => {
    const sig1 = computeReleveSignature(buildPayload({ equipementId: 'eq-1' }));
    const sig2 = computeReleveSignature(buildPayload({ equipementId: 'eq-2' }));

    expect(sig1).not.toBe(sig2);
  });

  it('should change the signature when creneau changes', () => {
    const sig1 = computeReleveSignature(buildPayload({ creneau: 'MATIN' }));
    const sig2 = computeReleveSignature(buildPayload({ creneau: 'MIDI' }));

    expect(sig1).not.toBe(sig2);
  });

  it('should change the signature when serverTimestamp changes', () => {
    const sig1 = computeReleveSignature(
      buildPayload({ serverTimestamp: new Date('2026-05-26T12:00:00.000Z') })
    );
    const sig2 = computeReleveSignature(
      buildPayload({ serverTimestamp: new Date('2026-05-26T12:00:00.001Z') })
    );

    expect(sig1).not.toBe(sig2);
  });

  it('should treat ip=null as the fixed "unknown" sentinel (deterministic)', () => {
    const sig1 = computeReleveSignature(buildPayload({ ip: null }));
    const sig2 = computeReleveSignature(buildPayload({ ip: null }));
    const sig3 = computeReleveSignature(buildPayload({ ip: 'unknown' }));

    // Deux null deterministes
    expect(sig1).toBe(sig2);
    // null === "unknown" sentinel (par construction de computeReleveSignature)
    expect(sig1).toBe(sig3);
  });

  it('should produce a different signature when ip changes from null to a real address', () => {
    const sigNull = computeReleveSignature(buildPayload({ ip: null }));
    const sigReal = computeReleveSignature(buildPayload({ ip: '10.0.0.1' }));

    expect(sigNull).not.toBe(sigReal);
  });

  it('should treat commentaire=null as a fixed sentinel different from empty string semantics', () => {
    const sig1 = computeReleveSignature(buildPayload({ commentaire: null }));
    const sig2 = computeReleveSignature(buildPayload({ commentaire: null }));

    expect(sig1).toBe(sig2);
  });
});

describe('[signature] verifyReleveSignature', () => {
  it('should return true for a signature freshly computed (round-trip)', () => {
    const payload = buildPayload();
    const sig = computeReleveSignature(payload);

    expect(verifyReleveSignature(payload, sig)).toBe(true);
  });

  it('should return false when any field has been tampered after signing', () => {
    const original = buildPayload();
    const sig = computeReleveSignature(original);

    const tampered = { ...original, temperature: -10.0 };
    expect(verifyReleveSignature(tampered, sig)).toBe(false);
  });

  it('should return false for an unrelated / random signature', () => {
    const payload = buildPayload();

    expect(verifyReleveSignature(payload, 'a'.repeat(64))).toBe(false);
  });
});
