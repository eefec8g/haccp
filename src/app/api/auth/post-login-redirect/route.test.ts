import { describe, it, expect, vi, beforeEach } from 'vitest';

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock('@/lib/auth', () => ({ auth }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[GET /api/auth/post-login-redirect]', () => {
  it('should return /dashboard for a SALARIE session', async () => {
    auth.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.fr', role: 'SALARIE', boutiqueIds: [] },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ redirectTo: '/dashboard' });
  });

  it('should return /dashboard for a RESPONSABLE session', async () => {
    auth.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.fr',
        role: 'RESPONSABLE',
        boutiqueIds: ['b1'],
      },
    });

    const body = await (await GET()).json();
    expect(body).toEqual({ redirectTo: '/dashboard' });
  });

  it('should return /dashboard for an ADMIN session', async () => {
    auth.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.fr', role: 'ADMIN', boutiqueIds: [] },
    });

    const body = await (await GET()).json();
    expect(body).toEqual({ redirectTo: '/dashboard' });
  });

  it('should fallback to /login when there is no session', async () => {
    auth.mockResolvedValue(null);

    const body = await (await GET()).json();
    expect(body).toEqual({ redirectTo: '/login' });
  });

  it('should fallback to /login when the role is unknown', async () => {
    auth.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.fr', role: 'UNKNOWN', boutiqueIds: [] },
    });

    const body = await (await GET()).json();
    expect(body).toEqual({ redirectTo: '/login' });
  });
});
