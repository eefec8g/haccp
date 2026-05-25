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
import { assertAdminOrRedirect } from './admin-auth';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[assertAdminOrRedirect]', () => {
  it('should redirect to /login when session is null', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    await expect(assertAdminOrRedirect()).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /login when role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', email: 'x@x.fr', role: 'SALARIE' },
    } as never);

    await expect(assertAdminOrRedirect()).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_REDIRECT'),
    });
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should return the userId when session has role ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'a@a.fr', role: 'ADMIN' },
    } as never);

    const result = await assertAdminOrRedirect();

    expect(result).toEqual({ userId: 'admin-1' });
    expect(redirect).not.toHaveBeenCalled();
  });
});
