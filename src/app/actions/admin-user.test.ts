import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '1.2.3.4' })),
}));

vi.mock('next/server', () => ({
  // Execute la callback synchroniquement pour pouvoir l'observer dans les
  // assertions des tests (en prod, Next.js l'execute post-response).
  after: vi.fn((cb: () => Promise<void> | void) => {
    void cb();
  }),
}));

vi.mock('@/lib/utils/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  createRateLimiter: vi.fn(() => ({})),
}));

vi.mock('@/lib/services/user.service', () => ({
  inviteUser: vi.fn(),
  acceptInvitation: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
}));

vi.mock('@/lib/services/email-invitation.service', () => ({
  sendUserInvitationEmail: vi.fn(async () => ({ success: true })),
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import {
  acceptInvitation,
  disableUser,
  enableUser,
  inviteUser,
} from '@/lib/services/user.service';
import { sendUserInvitationEmail } from '@/lib/services/email-invitation.service';
import {
  acceptInvitationAction,
  disableUserAction,
  enableUserAction,
  inviteUserAction,
  INITIAL_ACCEPT_INVITATION_STATE,
  INITIAL_USER_INVITE_STATE,
} from './admin-user';

const ADMIN_ID = 'admin-1';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_A = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_B = '33333333-3333-4333-8333-333333333333';
const VALID_TOKEN = 'a'.repeat(43);
const STRONG_PASSWORD = 'StrongPass1!aZ';

function adminSession() {
  return {
    user: {
      id: ADMIN_ID,
      email: 'admin@maison-givre.fr',
      role: 'ADMIN',
      name: 'Admin Ref',
    },
  } as never;
}

function salarieSession() {
  return {
    user: { id: 'sal-1', email: 'lea@maison-givre.fr', role: 'SALARIE' },
  } as never;
}

function makeFormData(
  values: Record<string, string | string[] | undefined>
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        fd.append(key, item);
      }
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

function rateOk() {
  return { success: true, retryAfterSeconds: 0 };
}

function rateBlocked() {
  return { success: false, retryAfterSeconds: 42 };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue(rateOk());
});

describe('[inviteUserAction]', () => {
  it('should return FORBIDDEN when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it('should return FORBIDDEN when the user role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'FORBIDDEN' });
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it('should return RATE_LIMITED with retryAfterSeconds when limiter blocks', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(checkRateLimit).mockResolvedValue(rateBlocked());

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when email is invalid', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'not-an-email',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.email).toBeDefined();
    }
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when role is SALARIE without boutiqueSalarieId', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.boutiqueSalarieId).toBeDefined();
    }
  });

  it('should return VALIDATION when role is RESPONSABLE with empty boutiquesResponsable', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'RESPONSABLE',
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.boutiquesResponsable).toBeDefined();
    }
  });

  it('should map EMAIL_ALREADY_EXISTS service error to EMAIL_ALREADY_EXISTS code', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(inviteUser).mockResolvedValue({
      success: false,
      error: 'EMAIL_ALREADY_EXISTS',
    });

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result).toEqual({
      status: 'error',
      code: 'EMAIL_ALREADY_EXISTS',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(sendUserInvitationEmail).not.toHaveBeenCalled();
  });

  it('should map BOUTIQUE_NOT_FOUND service error to BOUTIQUE_NOT_FOUND code', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(inviteUser).mockResolvedValue({
      success: false,
      error: 'BOUTIQUE_NOT_FOUND',
    });

    const result = await inviteUserAction(
      INITIAL_USER_INVITE_STATE,
      makeFormData({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'BOUTIQUE_NOT_FOUND' });
  });

  it('should dispatch email, revalidate and redirect when invite succeeds for SALARIE', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(inviteUser).mockResolvedValue({
      success: true,
      data: {
        invitationId: 'inv-1',
        plainToken: VALID_TOKEN,
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      },
    });

    await expect(
      inviteUserAction(
        INITIAL_USER_INVITE_STATE,
        makeFormData({
          email: 'jane@example.com',
          name: 'Jane',
          role: 'SALARIE',
          boutiqueSalarieId: BOUTIQUE_A,
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        name: 'Jane',
        role: 'SALARIE',
        boutiqueSalarieId: BOUTIQUE_A,
      }),
      ADMIN_ID
    );
    expect(sendUserInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        role: 'SALARIE',
        inviterName: 'Admin Ref',
        inviteUrl: expect.stringContaining(`/accept-invitation/${VALID_TOKEN}`),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    expect(redirect).toHaveBeenCalledWith('/admin/users');
  });

  it('should accept multiple boutiquesResponsable for RESPONSABLE role', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(inviteUser).mockResolvedValue({
      success: true,
      data: {
        invitationId: 'inv-2',
        plainToken: VALID_TOKEN,
        expiresAt: new Date('2026-12-31T00:00:00Z'),
      },
    });

    await expect(
      inviteUserAction(
        INITIAL_USER_INVITE_STATE,
        makeFormData({
          email: 'bob@example.com',
          name: 'Bob',
          role: 'RESPONSABLE',
          boutiquesResponsable: [BOUTIQUE_A, BOUTIQUE_B],
        })
      )
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });

    expect(inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'RESPONSABLE',
        boutiquesResponsable: [BOUTIQUE_A, BOUTIQUE_B],
      }),
      ADMIN_ID
    );
  });
});

describe('[acceptInvitationAction]', () => {
  it('should return RATE_LIMITED with retryAfterSeconds when limiter blocks', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(rateBlocked());

    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: VALID_TOKEN,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      })
    );

    expect(result).toEqual({
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 42,
    });
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when password is too weak', async () => {
    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: VALID_TOKEN,
        password: 'weak',
        confirmPassword: 'weak',
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.password).toBeDefined();
    }
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when passwords do not match', async () => {
    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: VALID_TOKEN,
        password: STRONG_PASSWORD,
        confirmPassword: `${STRONG_PASSWORD}X`,
      })
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.confirmPassword).toBeDefined();
    }
  });

  it('should return INVALID when token format fails Zod (path=token)', async () => {
    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: 'short',
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
  });

  it('should return INVALID (generique) when service returns INVALID_OR_EXPIRED', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      success: false,
      error: 'INVALID_OR_EXPIRED',
    });

    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: VALID_TOKEN,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      })
    );

    expect(result).toEqual({ status: 'error', code: 'INVALID' });
  });

  it('should return success with redirectTo /login?welcome=true when service succeeds', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      success: true,
      data: { user: { id: USER_ID } as never },
    });

    const result = await acceptInvitationAction(
      INITIAL_ACCEPT_INVITATION_STATE,
      makeFormData({
        token: VALID_TOKEN,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      })
    );

    expect(result).toEqual({
      status: 'success',
      redirectTo: '/login?welcome=true',
    });
    expect(acceptInvitation).toHaveBeenCalledWith(VALID_TOKEN, STRONG_PASSWORD);
  });
});

describe('[disableUserAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(disableUserAction(USER_ID)).rejects.toBeDefined();
    expect(disableUser).not.toHaveBeenCalled();
  });

  it('should throw a LAST_ADMIN-specific message when service refuses', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableUser).mockResolvedValue({
      success: false,
      error: 'LAST_ADMIN',
    });

    await expect(disableUserAction(USER_ID)).rejects.toThrow(
      /dernier administrateur/i
    );
  });

  it('should throw when the user does not exist', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableUser).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(disableUserAction(USER_ID)).rejects.toThrow(/introuvable/i);
  });

  it('should disable the user and revalidate both paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(disableUser).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await disableUserAction(USER_ID, 'Depart societe');

    expect(disableUser).toHaveBeenCalledWith({
      id: USER_ID,
      performedById: 'admin-1',
      motif: 'Depart societe',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/users/${USER_ID}`);
  });
});

describe('[enableUserAction]', () => {
  it('should throw when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue(salarieSession());

    await expect(enableUserAction(USER_ID)).rejects.toBeDefined();
    expect(enableUser).not.toHaveBeenCalled();
  });

  it('should enable the user and revalidate paths on success', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableUser).mockResolvedValue({
      success: true,
      data: undefined,
    });

    await enableUserAction(USER_ID);

    expect(enableUser).toHaveBeenCalledWith({
      id: USER_ID,
      performedById: 'admin-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('should throw when the user is not found', async () => {
    vi.mocked(auth).mockResolvedValue(adminSession());
    vi.mocked(enableUser).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(enableUserAction(USER_ID)).rejects.toThrow(/introuvable/i);
  });
});
