import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  db: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userInvitation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    boutique: {
      count: vi.fn(),
    },
    boutiqueUser: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  logAudit: vi.fn(),
}));

import { db } from '@/lib/prisma';
import { logAudit } from '@/lib/services/audit-log.service';
import {
  acceptInvitation,
  disableUser,
  enableUser,
  getUserById,
  inviteUser,
  listUsers,
  validateInvitationToken,
} from './user.service';
import { hashToken } from '@/lib/utils/tokens';

const ADMIN_ID = 'admin-1';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_A = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_B = '33333333-3333-4333-8333-333333333333';
const VALID_TOKEN = 'a'.repeat(43);
const STRONG_PASSWORD = 'StrongPass1!aZ';

function makeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_ID,
    email: 'jane@example.com',
    name: 'Jane',
    role: 'SALARIE',
    actif: true,
    password: 'hashed',
    boutiqueSalarieId: BOUTIQUE_A,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    boutiquesResponsable: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Stub `$transaction` qui execute le callback en passant un `tx`
 * minimal expose pour les assertions sur logAudit/user.update.
 */
function arrangeUserTransaction() {
  const txStub = {
    user: db.user,
    userInvitation: db.userInvitation,
    auditLog: db.auditLog,
  };
  vi.mocked(db.$transaction).mockImplementation(
    async (cb: unknown) =>
      await (cb as (tx: unknown) => Promise<unknown>)(txStub)
  );
}

describe('[user.service]', () => {
  describe('listUsers', () => {
    it('should default to actif=true filter and paginate', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([makeUserRow()] as never);
      vi.mocked(db.user.count).mockResolvedValue(1);

      const result = await listUsers({ query: { page: 1, pageSize: 25 } });

      expect(result.items).toHaveLength(1);
      const args = vi.mocked(db.user.findMany).mock.calls[0]?.[0];
      expect(args?.where).toEqual({ actif: true });
    });

    it('should filter by role when role is provided', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([] as never);
      vi.mocked(db.user.count).mockResolvedValue(0);

      await listUsers({ query: { page: 1, pageSize: 25 }, role: 'ADMIN' });

      const args = vi.mocked(db.user.findMany).mock.calls[0]?.[0];
      expect(args?.where).toEqual({ role: 'ADMIN', actif: true });
    });

    it('should expose boutiqueIdsResponsable from BoutiqueUser join', async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([
        makeUserRow({
          role: 'RESPONSABLE',
          boutiqueSalarieId: null,
          boutiquesResponsable: [
            { boutiqueId: BOUTIQUE_A },
            { boutiqueId: BOUTIQUE_B },
          ],
        }),
      ] as never);
      vi.mocked(db.user.count).mockResolvedValue(1);

      const result = await listUsers({ query: { page: 1, pageSize: 25 } });

      expect(result.items[0]?.boutiqueIdsResponsable).toEqual([
        BOUTIQUE_A,
        BOUTIQUE_B,
      ]);
    });
  });

  describe('getUserById', () => {
    it('should return NOT_FOUND when user does not exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await getUserById(USER_ID);

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });
  });

  describe('inviteUser', () => {
    function baseInput(overrides: Record<string, unknown> = {}) {
      return {
        email: 'newbie@example.com',
        name: 'Newbie',
        role: 'SALARIE' as const,
        boutiqueSalarieId: BOUTIQUE_A,
        boutiquesResponsable: [],
        ...overrides,
      };
    }

    it('should refuse when email belongs to an active user', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'existing',
      } as never);

      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result).toEqual({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
      });
      expect(db.userInvitation.create).not.toHaveBeenCalled();
    });

    it('should return EMAIL_ALREADY_EXISTS when user exists inactive (MVP : no auto-reactivation)', async () => {
      // Defense en profondeur : meme si l'admin tente de "reinviter" un
      // user desactive, on bloque, car le flow d'acceptation echouerait
      // sur la contrainte unique User.email (cf. M1).
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'existing',
      } as never);

      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result).toEqual({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
      });
      expect(db.userInvitation.create).not.toHaveBeenCalled();
    });

    it('should invalidate previous pending invitations for same email before creating a new one', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.boutique.count).mockResolvedValue(1);
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
      const txCreate = vi.fn().mockResolvedValue({ id: 'inv-1' });
      let updateManyCalledAt = -1;
      let createCalledAt = -1;
      let order = 0;
      txUpdateMany.mockImplementation(async () => {
        updateManyCalledAt = order++;
        return { count: 2 };
      });
      txCreate.mockImplementation(async () => {
        createCalledAt = order++;
        return { id: 'inv-1' };
      });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            userInvitation: { updateMany: txUpdateMany, create: txCreate },
            auditLog: db.auditLog,
          })
      );

      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result.success).toBe(true);
      // updateMany invalide les pending precedentes AVANT le create.
      expect(updateManyCalledAt).toBeLessThan(createCalledAt);
      const updateArgs = txUpdateMany.mock.calls[0]?.[0];
      expect(updateArgs.where).toEqual(
        expect.objectContaining({
          email: 'newbie@example.com',
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        })
      );
      expect(updateArgs.data).toEqual({ usedAt: expect.any(Date) });
    });

    it('should persist the name from the invite input on UserInvitation', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.boutique.count).mockResolvedValue(1);
      vi.mocked(db.userInvitation.create).mockResolvedValue({
        id: 'inv-1',
      } as never);
      arrangeUserTransaction();

      const result = await inviteUser(
        baseInput({ name: 'Jane Dupont' }),
        ADMIN_ID
      );

      expect(result.success).toBe(true);
      const args = vi.mocked(db.userInvitation.create).mock.calls[0]?.[0];
      expect((args?.data as { name: string }).name).toBe('Jane Dupont');
    });

    it('should return BOUTIQUE_NOT_FOUND when at least one boutique is inactive or missing', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.boutique.count).mockResolvedValue(0);

      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result).toEqual({ success: false, error: 'BOUTIQUE_NOT_FOUND' });
    });

    it('should store the SHA256 hash of the token (never the plain token)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.boutique.count).mockResolvedValue(1);
      vi.mocked(db.userInvitation.create).mockResolvedValue({
        id: 'inv-1',
      } as never);
      arrangeUserTransaction();

      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const args = vi.mocked(db.userInvitation.create).mock.calls[0]?.[0];
      const storedHash = (args?.data as { token: string }).token;
      expect(storedHash).not.toBe(result.data.plainToken);
      expect(storedHash).toBe(hashToken(result.data.plainToken));
    });

    it('should set expiresAt 24h in the future, persist invitedById and log audit', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.boutique.count).mockResolvedValue(1);
      vi.mocked(db.userInvitation.create).mockResolvedValue({
        id: 'inv-1',
      } as never);
      arrangeUserTransaction();

      const before = Date.now();
      const result = await inviteUser(baseInput(), ADMIN_ID);

      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const ttl = result.data.expiresAt.getTime() - before;
      // 24h en ms = 86_400_000. Tolerance large pour eviter flakiness.
      expect(ttl).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
      const args = vi.mocked(db.userInvitation.create).mock.calls[0]?.[0];
      expect((args?.data as { invitedById: string }).invitedById).toBe(
        ADMIN_ID
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'INVITATION',
          performedById: ADMIN_ID,
        })
      );
    });
  });

  describe('validateInvitationToken', () => {
    it('should return INVALID when token is too short', async () => {
      const result = await validateInvitationToken('short');

      expect(result).toEqual({ success: false, error: 'INVALID' });
    });

    it('should return INVALID when token is not in DB', async () => {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue(null);

      const result = await validateInvitationToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'INVALID' });
    });

    it('should return USED when invitation was already accepted', async () => {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue({
        id: 'i1',
        email: 'x@example.com',
        token: hashToken(VALID_TOKEN),
        role: 'SALARIE',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
        boutiqueSalarieId: null,
        boutiquesResponsable: [],
      } as never);

      const result = await validateInvitationToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'USED' });
    });

    it('should return EXPIRED when expiresAt is in the past', async () => {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue({
        id: 'i1',
        email: 'x@example.com',
        token: hashToken(VALID_TOKEN),
        role: 'SALARIE',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        boutiqueSalarieId: null,
        boutiquesResponsable: [],
      } as never);

      const result = await validateInvitationToken(VALID_TOKEN);

      expect(result).toEqual({ success: false, error: 'EXPIRED' });
    });

    it('should return InvitationPayload when token is valid', async () => {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue({
        id: 'i1',
        email: 'x@example.com',
        name: 'Jane Dupont',
        token: hashToken(VALID_TOKEN),
        role: 'RESPONSABLE',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        boutiqueSalarieId: null,
        boutiquesResponsable: [BOUTIQUE_A, BOUTIQUE_B],
      } as never);

      const result = await validateInvitationToken(VALID_TOKEN);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('RESPONSABLE');
        expect(result.data.name).toBe('Jane Dupont');
        expect(result.data.boutiquesResponsable).toEqual([
          BOUTIQUE_A,
          BOUTIQUE_B,
        ]);
      }
    });
  });

  describe('acceptInvitation', () => {
    function arrangeValid(name: string | null = 'Jane Dupont') {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue({
        id: 'i1',
        email: 'x@example.com',
        name,
        token: hashToken(VALID_TOKEN),
        role: 'SALARIE',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        boutiqueSalarieId: BOUTIQUE_A,
        boutiquesResponsable: [],
      } as never);
    }

    it('should return INVALID_OR_EXPIRED when token cannot be validated', async () => {
      vi.mocked(db.userInvitation.findUnique).mockResolvedValue(null);

      const result = await acceptInvitation(VALID_TOKEN, STRONG_PASSWORD);

      expect(result).toEqual({ success: false, error: 'INVALID_OR_EXPIRED' });
    });

    it('should consume the invitation and create the User atomically', async () => {
      arrangeValid();
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txCreate = vi.fn().mockResolvedValue({ id: USER_ID });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            userInvitation: { updateMany: txUpdateMany },
            user: { create: txCreate },
            boutiqueUser: { createMany: vi.fn() },
          })
      );

      const result = await acceptInvitation(VALID_TOKEN, STRONG_PASSWORD);

      expect(result.success).toBe(true);
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { token: hashToken(VALID_TOKEN), usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      const createArgs = txCreate.mock.calls[0]?.[0];
      // Password en clair JAMAIS persiste : on doit voir un hash bcrypt.
      expect(createArgs.data.password).not.toBe(STRONG_PASSWORD);
      expect(createArgs.data.password.startsWith('$2')).toBe(true);
      // Le name persiste depuis l'invitation est propage sur User.
      expect(createArgs.data.name).toBe('Jane Dupont');
    });

    it('should fallback name to email when invitation has no name (legacy tokens)', async () => {
      arrangeValid(null);
      const txCreate = vi.fn().mockResolvedValue({ id: USER_ID });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            userInvitation: {
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            user: { create: txCreate },
            boutiqueUser: { createMany: vi.fn() },
          })
      );

      const result = await acceptInvitation(VALID_TOKEN, STRONG_PASSWORD);

      expect(result.success).toBe(true);
      const createArgs = txCreate.mock.calls[0]?.[0];
      expect(createArgs.data.name).toBe('x@example.com');
    });

    it('should map race condition (count!==1) to INVALID_OR_EXPIRED', async () => {
      arrangeValid();
      const txUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
      vi.mocked(db.$transaction).mockImplementation(
        async (cb: unknown) =>
          await (cb as (tx: unknown) => Promise<unknown>)({
            userInvitation: { updateMany: txUpdateMany },
            user: { create: vi.fn() },
            boutiqueUser: { createMany: vi.fn() },
          })
      );

      const result = await acceptInvitation(VALID_TOKEN, STRONG_PASSWORD);

      expect(result).toEqual({ success: false, error: 'INVALID_OR_EXPIRED' });
    });
  });

  describe('disableUser', () => {
    it('should return NOT_FOUND when user does not exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await disableUser({
        id: USER_ID,
        performedById: ADMIN_ID,
      });

      expect(result).toEqual({ success: false, error: 'NOT_FOUND' });
    });

    it('should refuse to disable the last active admin (LAST_ADMIN)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(
        makeUserRow({ role: 'ADMIN' }) as never
      );
      vi.mocked(db.user.count).mockResolvedValue(0);

      const result = await disableUser({
        id: USER_ID,
        performedById: ADMIN_ID,
      });

      expect(result).toEqual({ success: false, error: 'LAST_ADMIN' });
      expect(db.user.update).not.toHaveBeenCalled();
      expect(logAudit).not.toHaveBeenCalled();
    });

    it('should allow disabling an admin and log DISABLE with motif when other actives exist', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(
        makeUserRow({ role: 'ADMIN' }) as never
      );
      vi.mocked(db.user.count).mockResolvedValue(2);
      vi.mocked(db.user.update).mockResolvedValue(makeUserRow() as never);
      arrangeUserTransaction();

      const result = await disableUser({
        id: USER_ID,
        performedById: ADMIN_ID,
        motif: 'Depart de la societe',
      });

      expect(result.success).toBe(true);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISABLE',
          entityType: 'USER',
          entityId: USER_ID,
          motif: 'Depart de la societe',
          performedById: ADMIN_ID,
        })
      );
    });

    it('should disable a SALARIE without admin count check', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(
        makeUserRow({ role: 'SALARIE' }) as never
      );
      vi.mocked(db.user.update).mockResolvedValue(makeUserRow() as never);
      arrangeUserTransaction();

      const result = await disableUser({
        id: USER_ID,
        performedById: ADMIN_ID,
      });

      expect(result.success).toBe(true);
      expect(db.user.count).not.toHaveBeenCalled();
    });
  });

  describe('enableUser', () => {
    it('should set actif=true and log ENABLE when user exists', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(
        makeUserRow({ actif: false }) as never
      );
      vi.mocked(db.user.update).mockResolvedValue(makeUserRow() as never);
      arrangeUserTransaction();

      const result = await enableUser({
        id: USER_ID,
        performedById: ADMIN_ID,
      });

      expect(result.success).toBe(true);
      const args = vi.mocked(db.user.update).mock.calls[0]?.[0];
      expect(args?.data).toEqual({ actif: true });
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENABLE',
          entityType: 'USER',
          performedById: ADMIN_ID,
        })
      );
    });
  });
});
