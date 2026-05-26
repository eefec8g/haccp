import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ensureAdminOrError, ensureRoleOrError } from './server-action-guards';

interface ForbiddenState {
  readonly status: 'error';
  readonly code: 'FORBIDDEN';
}

const FORBIDDEN_STATE: ForbiddenState = {
  status: 'error',
  code: 'FORBIDDEN',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[server-action-guards]', () => {
  describe('ensureRoleOrError', () => {
    it('should redirect to /login when no session is present', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      await expect(
        ensureRoleOrError({
          allowedRoles: ['ADMIN'],
          forbiddenState: FORBIDDEN_STATE,
        })
      ).rejects.toMatchObject({
        digest: expect.stringContaining('NEXT_REDIRECT'),
      });
      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('should return the forbiddenState when role is not allowed', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'sal-1',
          email: 'sal@maison-givre.fr',
          role: 'SALARIE',
        },
      } as never);

      const result = await ensureRoleOrError({
        allowedRoles: ['RESPONSABLE', 'ADMIN'],
        forbiddenState: FORBIDDEN_STATE,
      });

      expect(result).toEqual({ ok: false, state: FORBIDDEN_STATE });
      expect(redirect).not.toHaveBeenCalled();
    });

    it('should return ok with session when role is allowed (RESPONSABLE)', async () => {
      const session = {
        user: {
          id: 'resp-1',
          email: 'resp@maison-givre.fr',
          role: 'RESPONSABLE',
        },
      } as never;
      vi.mocked(auth).mockResolvedValue(session);

      const result = await ensureRoleOrError({
        allowedRoles: ['RESPONSABLE', 'ADMIN'],
        forbiddenState: FORBIDDEN_STATE,
      });

      expect(result).toMatchObject({ ok: true });
      if (result.ok) {
        expect(result.session.user.id).toBe('resp-1');
      }
      expect(redirect).not.toHaveBeenCalled();
    });

    it('should return ok with session when role is allowed (ADMIN)', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@maison-givre.fr',
          role: 'ADMIN',
        },
      } as never);

      const result = await ensureRoleOrError({
        allowedRoles: ['ADMIN'],
        forbiddenState: FORBIDDEN_STATE,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('ensureAdminOrError', () => {
    it('should redirect /login when no session is present', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      await expect(
        ensureAdminOrError({ forbiddenState: FORBIDDEN_STATE })
      ).rejects.toMatchObject({
        digest: expect.stringContaining('NEXT_REDIRECT'),
      });
    });

    it('should return forbiddenState when role is RESPONSABLE', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'r-1', role: 'RESPONSABLE' },
      } as never);

      const result = await ensureAdminOrError({
        forbiddenState: FORBIDDEN_STATE,
      });

      expect(result).toEqual({ ok: false, state: FORBIDDEN_STATE });
    });

    it('should return ok when role is ADMIN', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
      } as never);

      const result = await ensureAdminOrError({
        forbiddenState: FORBIDDEN_STATE,
      });

      expect(result.ok).toBe(true);
    });
  });
});
