import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock du singleton Prisma : doit etre declare AVANT l'import du SUT.
vi.mock('@/lib/prisma', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    boutiqueUser: {
      findMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { db } from '@/lib/prisma';
import {
  authenticateUser,
  generatePasswordResetToken,
  validateResetToken,
  resetPassword,
} from './auth.service';
import { hashToken } from '@/lib/utils/tokens';

const TEST_EMAIL = 'jane@example.com';
const TEST_PASSWORD = 'CorrectPassword!9aZ';
const VALID_TOKEN = 'a'.repeat(43);
const STRONG_NEW_PASSWORD = 'BrandNewPass1!aZ';

async function makeUserRow(
  overrides: Partial<{
    id: string;
    email: string;
    password: string;
    role: 'SALARIE' | 'RESPONSABLE' | 'ADMIN';
    actif: boolean;
    boutiqueSalarieId: string | null;
  }> = {}
) {
  const hashed = await bcrypt.hash(TEST_PASSWORD, 4);
  return {
    id: 'user-1',
    email: TEST_EMAIL,
    password: hashed,
    name: 'Jane',
    role: 'SALARIE' as const,
    actif: true,
    boutiqueSalarieId: 'boutique-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[auth.service]', () => {
  describe('authenticateUser', () => {
    it('should return INVALID_CREDENTIALS when user does not exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authenticateUser('unknown@example.com', 'whatever');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_CREDENTIALS',
      });
    });

    it('should NOT expose existence : same error for wrong password as for unknown user', async () => {
      const userRow = await makeUserRow();
      vi.mocked(db.user.findUnique).mockResolvedValue(userRow);

      const result = await authenticateUser(TEST_EMAIL, 'WrongPassword!1aZ');

      expect(result).toEqual({
        success: false,
        error: 'INVALID_CREDENTIALS',
      });
    });

    it('should return INACTIVE_ACCOUNT when password is correct but account is disabled', async () => {
      const userRow = await makeUserRow({ actif: false });
      vi.mocked(db.user.findUnique).mockResolvedValue(userRow);

      const result = await authenticateUser(TEST_EMAIL, TEST_PASSWORD);

      expect(result).toEqual({ success: false, error: 'INACTIVE_ACCOUNT' });
    });

    it('should return success with SALARIE boutiqueIds derived from boutiqueSalarieId', async () => {
      const userRow = await makeUserRow();
      vi.mocked(db.user.findUnique).mockResolvedValue(userRow);

      const result = await authenticateUser(TEST_EMAIL, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.role).toBe('SALARIE');
        expect(result.data.user.boutiqueIds).toEqual(['boutique-1']);
      }
    });

    it('should return success with RESPONSABLE boutiqueIds resolved via BoutiqueUser', async () => {
      const userRow = await makeUserRow({
        role: 'RESPONSABLE',
        boutiqueSalarieId: null,
      });
      vi.mocked(db.user.findUnique).mockResolvedValue(userRow);
      vi.mocked(db.boutiqueUser.findMany).mockResolvedValue([
        { boutiqueId: 'b1' },
        { boutiqueId: 'b2' },
      ] as never);

      const result = await authenticateUser(TEST_EMAIL, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.boutiqueIds).toEqual(['b1', 'b2']);
      }
    });

    it('should return success with empty boutiqueIds for ADMIN (resolved later by permissions)', async () => {
      const userRow = await makeUserRow({
        role: 'ADMIN',
        boutiqueSalarieId: null,
      });
      vi.mocked(db.user.findUnique).mockResolvedValue(userRow);

      const result = await authenticateUser(TEST_EMAIL, TEST_PASSWORD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.boutiqueIds).toEqual([]);
      }
    });

    it('should normalize email (lowercase + trim) before lookup', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      await authenticateUser('  USER@Example.COM  ', 'whatever');

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });
  });

  describe('generatePasswordResetToken', () => {
    it('should return success with null token for unknown email (anti-enum)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await generatePasswordResetToken('ghost@example.com');

      expect(result).toEqual({
        success: true,
        data: { plainToken: null, expiresAt: null },
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('should return success with null token for inactive user (anti-enum)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'u1',
        email: TEST_EMAIL,
        actif: false,
      } as never);

      const result = await generatePasswordResetToken(TEST_EMAIL);

      expect(result).toEqual({
        success: true,
        data: { plainToken: null, expiresAt: null },
      });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('should invalidate previous unused tokens and create a fresh one for active user', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'u1',
        email: TEST_EMAIL,
        actif: true,
      } as never);
      vi.mocked(db.$transaction).mockResolvedValue([]);

      const result = await generatePasswordResetToken(TEST_EMAIL);

      expect(result.success).toBe(true);
      if (result.success && result.data.expiresAt) {
        expect(result.data.plainToken).toBeTruthy();
        expect(result.data.expiresAt).toBeInstanceOf(Date);
        expect(result.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
      }
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateResetToken', () => {
    it('should return INVALID_TOKEN for empty token', async () => {
      const result = await validateResetToken('');

      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
    });

    it('should return INVALID_TOKEN when token is not found in DB', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(null);

      const result = await validateResetToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
    });

    it('should return TOKEN_ALREADY_USED when usedAt is set', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 't1',
        email: TEST_EMAIL,
        token: hashToken(VALID_TOKEN),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        createdAt: new Date(),
      } as never);

      const result = await validateResetToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'TOKEN_ALREADY_USED' });
    });

    it('should return EXPIRED_TOKEN when expiresAt is in the past', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 't1',
        email: TEST_EMAIL,
        token: hashToken(VALID_TOKEN),
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdAt: new Date(),
      } as never);

      const result = await validateResetToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'EXPIRED_TOKEN' });
    });

    it('should return INVALID_TOKEN when associated user is inactive', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 't1',
        email: TEST_EMAIL,
        token: hashToken(VALID_TOKEN),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      } as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'u1',
        email: TEST_EMAIL,
        actif: false,
      } as never);

      const result = await validateResetToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
    });

    it('should return userId + email when token is valid', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 't1',
        email: TEST_EMAIL,
        token: hashToken(VALID_TOKEN),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      } as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'u1',
        email: TEST_EMAIL,
        actif: true,
      } as never);

      const result = await validateResetToken(VALID_TOKEN);

      expect(result).toEqual({
        success: true,
        data: { userId: 'u1', email: TEST_EMAIL },
      });
    });
  });

  describe('resetPassword', () => {
    function arrangeValidToken() {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 't1',
        email: TEST_EMAIL,
        token: hashToken(VALID_TOKEN),
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      } as never);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'u1',
        email: TEST_EMAIL,
        actif: true,
      } as never);
    }

    it('should propagate validation error when token is invalid', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(null);

      const result = await resetPassword(VALID_TOKEN, STRONG_NEW_PASSWORD);

      expect(result).toEqual({ success: false, error: 'INVALID_TOKEN' });
    });

    it('should consume the token and update the user password atomically', async () => {
      arrangeValidToken();
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txUpdate = vi.fn().mockResolvedValue({});
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            passwordResetToken: { updateMany: txUpdateMany },
            user: { update: txUpdate },
          })
      );

      const result = await resetPassword(VALID_TOKEN, STRONG_NEW_PASSWORD);

      expect(result).toEqual({ success: true, data: { userId: 'u1' } });
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { token: hashToken(VALID_TOKEN), usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(txUpdate).toHaveBeenCalledWith({
        where: { email: TEST_EMAIL },
        data: { password: expect.any(String) },
      });
      // Le hash effectivement persiste ne doit PAS etre le password en clair.
      const updateArg = txUpdate.mock.calls[0]?.[0];
      expect(updateArg.data.password).not.toBe(STRONG_NEW_PASSWORD);
      expect(updateArg.data.password.startsWith('$2')).toBe(true);
    });

    it('should return TOKEN_ALREADY_USED if a race consumed the token mid-transaction', async () => {
      arrangeValidToken();
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            passwordResetToken: { updateMany: txUpdateMany },
            user: { update: vi.fn() },
          })
      );

      const result = await resetPassword(VALID_TOKEN, STRONG_NEW_PASSWORD);

      expect(result).toEqual({ success: false, error: 'TOKEN_ALREADY_USED' });
    });
  });
});
