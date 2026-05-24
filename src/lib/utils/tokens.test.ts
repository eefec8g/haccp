import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { generateResetToken, hashToken } from './tokens';

const SHA256_HEX_LENGTH = 64;

describe('[tokens util]', () => {
  describe('generateResetToken', () => {
    it('should return a plain token of at least 32 chars (base64url of 32 bytes)', () => {
      const { plain } = generateResetToken();

      // base64url of 32 bytes -> 43 chars without padding.
      expect(plain.length).toBeGreaterThanOrEqual(43);
      // base64url alphabet only (A-Z a-z 0-9 - _).
      expect(/^[A-Za-z0-9_-]+$/.test(plain)).toBe(true);
    });

    it('should produce a hash equal to sha256(plain) in hex', () => {
      const { plain, hash } = generateResetToken();

      const expected = createHash('sha256').update(plain).digest('hex');
      expect(hash).toBe(expected);
      expect(hash.length).toBe(SHA256_HEX_LENGTH);
    });

    it('should produce a different token on each call', () => {
      const a = generateResetToken();
      const b = generateResetToken();

      expect(a.plain).not.toBe(b.plain);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe('hashToken', () => {
    it('should compute a deterministic sha256 hex hash', () => {
      const plain = 'some-known-token-value';

      const h1 = hashToken(plain);
      const h2 = hashToken(plain);

      expect(h1).toBe(h2);
      expect(h1.length).toBe(SHA256_HEX_LENGTH);
      expect(/^[a-f0-9]+$/.test(h1)).toBe(true);
    });

    it('should produce different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });
});
