/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests page detail utilisateur (US-ADM-006).
 *
 * Verifie l'orchestration Server Component :
 *   - notFound() quand l'utilisateur est introuvable.
 *   - Rendu du formulaire d'edition pre-rempli (role + boutiques) pour
 *     un utilisateur existant.
 *
 * `EditUserAssignmentForm` et `UserToggleActiveButton` (Client
 * Components) sont stub pour assert sur l'orchestration et le passage
 * des props sans monter l'arbre `useActionState`.
 */

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('__NOT_FOUND__');
  }),
}));

vi.mock('@/lib/services/user.service', () => ({
  getUserById: vi.fn(),
}));

vi.mock('@/lib/services/boutique.service', () => ({
  getBoutiquesByIds: vi.fn(),
  listBoutiquesForSelect: vi.fn(),
}));

vi.mock('@/components/features/admin/UserToggleActiveButton', () => ({
  UserToggleActiveButton: () => <div data-testid="user-toggle-stub" />,
}));

vi.mock('@/components/features/admin/EditUserAssignmentForm', () => ({
  EditUserAssignmentForm: (props: {
    readonly initialRole: string;
    readonly initialBoutiqueSalarieId: string | null;
    readonly boutiques: readonly { readonly id: string }[];
  }) => (
    <div
      data-testid="edit-user-form-stub"
      data-role={props.initialRole}
      data-boutique-salarie={props.initialBoutiqueSalarieId ?? ''}
      data-boutiques-count={props.boutiques.length}
    />
  ),
}));

import { getUserById } from '@/lib/services/user.service';
import {
  getBoutiquesByIds,
  listBoutiquesForSelect,
} from '@/lib/services/boutique.service';
import { notFound } from 'next/navigation';
import AdminUserDetailPage from '../page';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_A = '22222222-2222-4222-8222-222222222222';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    email: 'lea@maison-givre.fr',
    name: 'Lea',
    role: 'SALARIE',
    actif: true,
    createdAt: new Date('2026-01-01'),
    boutiqueSalarieId: BOUTIQUE_A,
    boutiqueIdsResponsable: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBoutiquesByIds).mockResolvedValue([
    { id: BOUTIQUE_A, nom: 'MG Paris 11', ville: 'Paris' },
  ]);
  vi.mocked(listBoutiquesForSelect).mockResolvedValue([
    { id: BOUTIQUE_A, nom: 'MG Paris 11', ville: 'Paris' },
  ]);
});

describe('[AdminUserDetailPage]', () => {
  it('should call notFound when the user does not exist', async () => {
    vi.mocked(getUserById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    });

    await expect(
      AdminUserDetailPage({ params: Promise.resolve({ id: USER_ID }) })
    ).rejects.toThrow('__NOT_FOUND__');
    expect(notFound).toHaveBeenCalled();
  });

  it('should render the edit form pre-filled with the current role and boutique', async () => {
    vi.mocked(getUserById).mockResolvedValue({
      success: true,
      data: makeUser() as any,
    });

    const element = await AdminUserDetailPage({
      params: Promise.resolve({ id: USER_ID }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-testid="user-edit-section"');
    expect(html).toContain('data-testid="edit-user-form-stub"');
    expect(html).toContain('data-role="SALARIE"');
    expect(html).toContain(`data-boutique-salarie="${BOUTIQUE_A}"`);
    // Les boutiques actives sont chargees et passees au formulaire.
    expect(html).toContain('data-boutiques-count="1"');
  });
});
