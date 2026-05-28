/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests page de changement de mot de passe (feat/change-password).
 *
 * Verifie l'orchestration Server Component :
 *   - Garde auth : redirect /login si pas de session.
 *   - Render du header + du formulaire pour un utilisateur connecte.
 *
 * `ChangePasswordForm` est stub (Client Component) pour assert sur
 * l'orchestration sans monter l'arbre `useActionState`.
 */

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/components/features/auth/ChangePasswordForm', () => ({
  ChangePasswordForm: () => <div data-testid="change-password-form-stub" />,
}));

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChangePasswordPage from '../page';

const SESSION = { user: { id: 'u1', role: 'SALARIE' as const } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[ChangePasswordPage]', () => {
  it('should redirect to /login when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(ChangePasswordPage()).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render the header and the change-password form for a logged-in user', async () => {
    vi.mocked(auth).mockResolvedValue(SESSION as any);

    const element = await ChangePasswordPage();
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="change-password-page"');
    expect(html).toContain('Mon mot de passe');
    expect(html).toContain('data-testid="change-password-form-stub"');
  });
});
