import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    // Reproduit le comportement de next/navigation : redirect() lance une
    // exception avec un digest "NEXT_REDIRECT;..." pour interrompre le flow.
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw error;
  }),
}));

import { signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from './logout';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[logoutAction]', () => {
  it('should call signOut with redirect:false to clear the NextAuth cookie', async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
  });

  it('should redirect to /login on successful signOut', async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should still redirect to /login when signOut throws a non-redirect error', async () => {
    vi.mocked(signOut).mockRejectedValue(new Error('Redis unavailable'));

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should propagate a NEXT_REDIRECT error from signOut without swallowing it', async () => {
    const nextRedirect = new Error('NEXT_REDIRECT') as Error & {
      digest: string;
    };
    nextRedirect.digest = 'NEXT_REDIRECT;replace;/other;307;';
    vi.mocked(signOut).mockRejectedValue(nextRedirect);

    await expect(logoutAction()).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/other;307;',
    });

    // signOut a deja redirige, on ne doit pas appeler notre redirect a /login.
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should not log any session data (no console.* calls)', async () => {
    const noop = (): void => undefined;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(noop);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(noop);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(noop);
    vi.mocked(signOut).mockResolvedValue(undefined as never);

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
