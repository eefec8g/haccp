import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/services/auth.service', () => ({
  changePassword: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { changePassword } from '@/lib/services/auth.service';
import { changePasswordAction } from './change-password';
import { INITIAL_CHANGE_PASSWORD_STATE } from './change-password.types';

const USER_ID = 'user-1';
const CURRENT_PASSWORD = 'CurrentPass1!aZ';
const STRONG_NEW_PASSWORD = 'BrandNewPass1!aZ';
const SESSION = { user: { id: USER_ID, role: 'SALARIE' as const } };

function makeFormData(
  fields: Partial<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>
): FormData {
  const fd = new FormData();
  if (fields.currentPassword !== undefined) {
    fd.set('currentPassword', fields.currentPassword);
  }
  if (fields.newPassword !== undefined) {
    fd.set('newPassword', fields.newPassword);
  }
  if (fields.confirmPassword !== undefined) {
    fd.set('confirmPassword', fields.confirmPassword);
  }
  return fd;
}

function makeValidFormData(): FormData {
  return makeFormData({
    currentPassword: CURRENT_PASSWORD,
    newPassword: STRONG_NEW_PASSWORD,
    confirmPassword: STRONG_NEW_PASSWORD,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[changePasswordAction]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(
      changePasswordAction(INITIAL_CHANGE_PASSWORD_STATE, makeValidFormData())
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when the new password is too weak', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeFormData({
        currentPassword: CURRENT_PASSWORD,
        newPassword: 'weak',
        confirmPassword: 'weak',
      })
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('should return VALIDATION when confirmation does not match', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeFormData({
        currentPassword: CURRENT_PASSWORD,
        newPassword: STRONG_NEW_PASSWORD,
        confirmPassword: 'DifferentPass1!aZ',
      })
    );

    expect(result).toEqual({ status: 'error', code: 'VALIDATION' });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('should call the service with the session userId (never from the form)', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);
    vi.mocked(changePassword).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeValidFormData()
    );

    expect(changePassword).toHaveBeenCalledWith({
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: STRONG_NEW_PASSWORD,
    });
    expect(result).toEqual({ status: 'success' });
  });

  it('should map INVALID_CURRENT_PASSWORD service error to its UI code', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'INVALID_CURRENT_PASSWORD',
    });

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeValidFormData()
    );

    expect(result).toEqual({
      status: 'error',
      code: 'INVALID_CURRENT_PASSWORD',
    });
  });

  it('should map SAME_PASSWORD service error to its UI code', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'SAME_PASSWORD',
    });

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeValidFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'SAME_PASSWORD' });
  });

  it('should map INTERNAL service error to its UI code', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as never);
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'INTERNAL',
    });

    const result = await changePasswordAction(
      INITIAL_CHANGE_PASSWORD_STATE,
      makeValidFormData()
    );

    expect(result).toEqual({ status: 'error', code: 'INTERNAL' });
  });
});
