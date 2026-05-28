import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChangePasswordActionState } from '@/app/actions/change-password.types';

/**
 * Tests ChangePasswordForm (feat/change-password).
 *
 * Client Component pour `useActionState(changePasswordAction, ...)`. On
 * rend en SSR (`renderToStaticMarkup`) et on pilote l'etat via un mock
 * hoiste de `useActionState`. Couvre :
 *   - rendu des 3 champs + testids attendus,
 *   - etat pending (bouton disable + aria-busy),
 *   - etat erreur (message FR + role alert + aria-invalid),
 *   - etat succes (message + role status).
 */

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as ChangePasswordActionState,
    pending: false,
  };
  return {
    mockState: state,
    useActionStateMock: vi.fn(() => [state.current, vi.fn(), state.pending]),
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock('@/app/actions/change-password', () => ({
  changePasswordAction: vi.fn(),
}));

import { ChangePasswordForm } from '../ChangePasswordForm';

beforeEach(() => {
  mockState.current = { status: 'idle' };
  mockState.pending = false;
});

describe('[ChangePasswordForm]', () => {
  it('should render the three password fields with their testids', () => {
    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('data-testid="change-password-form"');
    expect(html).toContain('data-testid="current-password"');
    expect(html).toContain('data-testid="new-password"');
    expect(html).toContain('data-testid="confirm-password"');
    expect(html).toContain('data-testid="change-password-submit"');
  });

  it('should default the password inputs to type=password (masked)', () => {
    const html = renderToStaticMarkup(<ChangePasswordForm />);

    const passwordTypeInputs = html.match(/type="password"/g) ?? [];
    expect(passwordTypeInputs).toHaveLength(3);
    expect(html).not.toContain('type="text"');
  });

  it('should expose the password complexity hint via PasswordStrengthIndicator', () => {
    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('data-testid="password-strength"');
    expect(html).toContain('Exigences du mot de passe');
  });

  it('should disable the submit button and set aria-busy when pending', () => {
    mockState.pending = true;

    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
    expect(html).toContain('Modification en cours');
  });

  it('should render the FR error message and aria-invalid when current password is wrong', () => {
    mockState.current = { status: 'error', code: 'INVALID_CURRENT_PASSWORD' };

    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('data-testid="change-password-error"');
    expect(html).toContain('Le mot de passe actuel est incorrect.');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
  });

  it('should render the FR error message for SAME_PASSWORD', () => {
    mockState.current = { status: 'error', code: 'SAME_PASSWORD' };

    const html = renderToStaticMarkup(<ChangePasswordForm />);

    // L'apostrophe est encodee en entite HTML (&#x27;) par le SSR React.
    expect(html).toContain('doit etre different de l&#x27;actuel');
  });

  it('should render the success message with role status on success', () => {
    mockState.current = { status: 'success' };

    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('data-testid="change-password-success"');
    expect(html).toContain('Mot de passe modifie.');
    expect(html).toContain('role="status"');
  });

  it('should keep error/success containers in the DOM (sr-only) when idle', () => {
    const html = renderToStaticMarkup(<ChangePasswordForm />);

    expect(html).toContain('data-testid="change-password-error"');
    expect(html).toContain('data-testid="change-password-success"');
    expect(html).toContain('sr-only');
  });
});
