import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests EditUserAssignmentForm (US-ADM-006).
 *
 * Client Component a base de `useActionState` (etat de l'action) +
 * `useState` (role pilotant le rendu conditionnel). On rend en static
 * markup : `renderToStaticMarkup` execute les hooks une fois, donc le
 * rendu conditionnel reflete le role INITIAL (initialRole). On couvre
 * un role par rendu pour valider l'affichage conditionnel des
 * selecteurs, le pre-remplissage et les data-testid.
 */

interface FormTestState {
  readonly status: 'idle' | 'success' | 'error';
  readonly code?: string;
  readonly fieldErrors?: {
    readonly role?: readonly string[];
    readonly boutiqueSalarieId?: readonly string[];
    readonly boutiquesResponsable?: readonly string[];
  };
}

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as FormTestState,
    pending: false,
  };
  return {
    mockState: state,
    useActionStateMock: vi.fn(() => [state.current, vi.fn(), state.pending]),
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, useActionState: useActionStateMock };
});

vi.mock('@/app/actions/admin-user', () => ({
  updateUserAssignmentAction: vi.fn(),
}));

import { EditUserAssignmentForm } from '../EditUserAssignmentForm';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_A = '22222222-2222-4222-8222-222222222222';
const BOUTIQUE_B = '33333333-3333-4333-8333-333333333333';
const BOUTIQUES = [
  { id: BOUTIQUE_A, nom: 'MG Paris 11', ville: 'Paris' },
  { id: BOUTIQUE_B, nom: 'MG Lyon', ville: null },
] as const;

beforeEach(() => {
  mockState.current = { status: 'idle' };
  mockState.pending = false;
});

describe('[Admin] EditUserAssignmentForm', () => {
  it('should render the hidden userId, role selector and submit (SALARIE)', () => {
    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="SALARIE"
        initialBoutiqueSalarieId={BOUTIQUE_A}
        initialBoutiqueIdsResponsable={[]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-form"');
    expect(html).toContain('name="userId"');
    expect(html).toContain(`value="${USER_ID}"`);
    expect(html).toContain('data-testid="edit-user-role"');
    expect(html).toContain('data-testid="edit-user-submit"');
  });

  it('should show the boutique salarie selector and pre-select the current boutique (SALARIE)', () => {
    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="SALARIE"
        initialBoutiqueSalarieId={BOUTIQUE_B}
        initialBoutiqueIdsResponsable={[]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-boutique-salarie"');
    expect(html).not.toContain('data-testid="edit-user-boutiques-responsable"');
    // Le <select> SSR marque l'option courante comme selected.
    expect(html).toContain(`value="${BOUTIQUE_B}" selected`);
  });

  it('should show the multi-select and pre-check current boutiques (RESPONSABLE)', () => {
    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="RESPONSABLE"
        initialBoutiqueSalarieId={null}
        initialBoutiqueIdsResponsable={[BOUTIQUE_A]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-boutiques-responsable"');
    expect(html).not.toContain('data-testid="edit-user-boutique-salarie"');
    expect(html).toContain(
      `data-testid="edit-user-boutique-responsable-${BOUTIQUE_A}"`
    );
    // La boutique courante est cochee, l'autre non (ordre d'attributs
    // SSR : `checked` precede `value`).
    expect(html).toContain(`checked="" value="${BOUTIQUE_A}"`);
    expect(html).not.toContain(`checked="" value="${BOUTIQUE_B}"`);
  });

  it('should show the admin hint and no boutique selector (ADMIN)', () => {
    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="ADMIN"
        initialBoutiqueSalarieId={null}
        initialBoutiqueIdsResponsable={[]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-admin-hint"');
    expect(html).not.toContain('data-testid="edit-user-boutique-salarie"');
    expect(html).not.toContain('data-testid="edit-user-boutiques-responsable"');
  });

  it('should render the LAST_ADMIN error message when the action refuses', () => {
    mockState.current = { status: 'error', code: 'LAST_ADMIN' };

    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="ADMIN"
        initialBoutiqueSalarieId={null}
        initialBoutiqueIdsResponsable={[]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-error"');
    expect(html).toContain('dernier administrateur actif');
  });

  it('should render the success message when the action succeeds', () => {
    mockState.current = { status: 'success' };

    const html = renderToStaticMarkup(
      <EditUserAssignmentForm
        userId={USER_ID}
        initialRole="SALARIE"
        initialBoutiqueSalarieId={BOUTIQUE_A}
        initialBoutiqueIdsResponsable={[]}
        boutiques={BOUTIQUES}
      />
    );

    expect(html).toContain('data-testid="edit-user-success"');
    expect(html).toContain('mis a jour');
  });
});
