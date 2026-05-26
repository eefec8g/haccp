import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests ResolutionForm (US-ALE-002).
 *
 * Le composant est un Client Component utilisant `useActionState`. Pour
 * eviter de tirer le runtime React-DOM client complet, on mock le
 * server action et on rend en static markup les 3 etats canoniques :
 *   - idle      : form rendu, bouton actif, compteur a 0.
 *   - pending   : non testable via SSR (necessite dispatch transition),
 *                 substitue par une assertion sur la presence des
 *                 attributs `aria-busy` declares.
 *   - error     : etat injecte en mockant useActionState.
 *
 * Note : `renderToStaticMarkup` execute les hooks dans un cycle
 * unique ; on mock donc `useActionState` pour controler l'etat passe
 * au rendu.
 */

interface ResolutionTestState {
  readonly status: 'idle' | 'success' | 'error';
  readonly code?: string;
  readonly fieldErrors?: { readonly commentaireResolution?: readonly string[] };
  readonly retryAfterSeconds?: number;
  readonly redirectTo?: string;
}

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as ResolutionTestState,
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

vi.mock('@/app/actions/alerte', () => ({
  resolveAlerteAction: vi.fn(),
}));

import { ResolutionForm } from '../ResolutionForm';

const ALERTE_ID = '11111111-1111-4111-8111-111111111111';
const SUMMARY = {
  equipementNom: 'Congelateur A',
  boutiqueNom: 'MG Paris 11',
  temperature: -10,
  seuilMin: -25,
  seuilMax: -18,
} as const;

describe('[Alertes] ResolutionForm', () => {
  it('should render the form with the hidden alerteId, textarea and submit button (idle state)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('data-testid="alerte-resolution-form"');
    expect(html).toContain(`name="alerteId"`);
    expect(html).toContain(`value="${ALERTE_ID}"`);
    expect(html).toContain('data-testid="alerte-resolution-commentaire"');
    expect(html).toContain('data-testid="alerte-resolution-submit"');
    expect(html).toContain('Marquer comme resolue');
  });

  it('should render the read-only summary with equipement, boutique, temperature, seuils', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('data-testid="alerte-resolution-summary"');
    expect(html).toContain('Congelateur A');
    expect(html).toContain('MG Paris 11');
    expect(html).toContain('-10.0 degC');
    expect(html).toContain('-25.0 / -18.0 degC');
  });

  it('should render the counter starting at 0 / 500', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('data-testid="alerte-resolution-counter"');
    expect(html).toContain('0 / 500');
  });

  it('should disable the submit button and set aria-busy when pending', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = true;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
    expect(html).toContain('Enregistrement...');
  });

  it('should display a validation field error when present in state', () => {
    mockState.current = {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: {
        commentaireResolution: [
          'Le commentaire doit faire au moins 10 caracteres',
        ],
      },
    };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('Le commentaire doit faire au moins 10 caracteres');
    expect(html).toContain('Veuillez corriger les champs en erreur.');
  });

  it('should display a rate-limit message when state is RATE_LIMITED', () => {
    mockState.current = {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 45,
    };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <ResolutionForm alerteId={ALERTE_ID} summary={SUMMARY} />
    );

    expect(html).toContain('Trop de tentatives');
    expect(html).toContain('45 seconde');
  });
});
