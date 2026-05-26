import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('[password util]', () => {
  describe('hashPassword', () => {
    it('should produce a bcrypt hash distinct from the plaintext', async () => {
      const plain = 'CorrectHorseBattery!9';

      const hash = await hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash.length).toBeGreaterThanOrEqual(60);
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should produce different hashes for the same input (random salt)', async () => {
      const plain = 'SamePassword42!@#';

      const hashA = await hashPassword(plain);
      const hashB = await hashPassword(plain);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('verifyPassword', () => {
    it('should return true when the password matches its hash', async () => {
      const plain = 'CorrectHorseBattery!9';
      const hash = await hashPassword(plain);

      const ok = await verifyPassword(plain, hash);

      expect(ok).toBe(true);
    });

    it('should return false when the password does not match', async () => {
      const hash = await hashPassword('CorrectHorseBattery!9');

      const ok = await verifyPassword('WrongPassword!9', hash);

      expect(ok).toBe(false);
    });

    it('should return false when the hash is empty', async () => {
      const ok = await verifyPassword('anything', '');

      expect(ok).toBe(false);
    });

    it('should return false when the hash is malformed (no throw)', async () => {
      const ok = await verifyPassword('anything', 'not-a-bcrypt-hash');

      expect(ok).toBe(false);
    });
  });
});
