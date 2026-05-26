import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SaisieContext } from '@/types/releve';
import type { ReleveCreateActionState } from '@/app/actions/releve-create.types';

/**
 * Tests SaisieReleveForm (US-REL-002) :
 *   - Render initial (idle) : pas d'erreur, bouton submit present, hidden fields
 *   - Affichage des seuils + nom equipement + creneau
 *   - data-testid sur elements interactifs (temperature, commentaire, submit)
 *   - Charte Maison Givre : palette mg-ivoire/mg-noir/mg-or
 *   - Etat RATE_LIMITED : message dynamique via buildRateLimitMessage
 *
 * Le composant est un Client Component utilisant `useActionState`. Pour
 * eviter de tirer le runtime React-DOM client complet, on mocke
 * `useActionState` (via le mock de 'react') et le server action. On
 * controle l'etat passe au rendu via un `mockState` partage. Pattern
 * deja eprouve dans `ResolutionForm.test.tsx`.
 */

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as ReleveCreateActionState,
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

// La Server Action `createReleveAction` est `'use server'` et ne peut
// pas etre executee dans le SSR pur de test (necessite next/headers,
// next/cache, etc.). On la mocke vers une fonction passthrough : son
// integration est couverte par `releve-create.test.ts`.
vi.mock('@/app/actions/releve-create', () => ({
  createReleveAction: vi.fn(),
}));

import { SaisieReleveForm } from '../SaisieReleveForm';

function buildContext(overrides: Partial<SaisieContext> = {}): SaisieContext {
  return {
    equipement: {
      id: 'eq-1',
      nom: 'Congelateur A',
      type: 'CONGELATEUR',
      seuilMin: -25,
      seuilMax: -18,
      boutiqueId: 'b-1',
      boutiqueNom: 'MG Paris 11',
    },
    creneau: 'MATIN',
    dateISO: '2026-05-26',
    ...overrides,
  };
}

describe('[Releves] SaisieReleveForm', () => {
  it('should render the form with critical data-testid hooks', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('data-testid="saisie-form"');
    expect(html).toContain('data-testid="saisie-summary"');
    expect(html).toContain('data-testid="saisie-temperature"');
    expect(html).toContain('data-testid="saisie-commentaire"');
    expect(html).toContain('data-testid="saisie-submit"');
  });

  it('should render hidden inputs for equipementId and creneau', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('name="equipementId"');
    expect(html).toContain('value="eq-1"');
    expect(html).toContain('name="creneau"');
    expect(html).toContain('value="MATIN"');
  });

  it('should display the equipement name, boutique and seuils', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('Congelateur A');
    expect(html).toContain('MG Paris 11');
    expect(html).toContain('-25.0');
    expect(html).toContain('-18.0');
  });

  it('should display the creneau label "Matin" for MATIN', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext({ creneau: 'MATIN' })} />
    );

    expect(html).toContain('Matin');
  });

  it('should set required + step=0.1 + inputMode=decimal on temperature input', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('id="temperature"');
    expect(html).toContain('step="0.1"');
    expect(html).toContain('inputMode="decimal"');
  });

  it('should not show the alerte hint initially (temperature empty)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).not.toContain('data-testid="saisie-alerte-hint"');
  });

  it('should render the submit button with default "Enregistrer" label', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('Enregistrer le releve');
    // Initial isPending=false -> aria-busy=false (React renders booleans this way)
    expect(html).toContain('aria-busy="false"');
  });

  it('should expose the global error region with aria-live polite', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    expect(html).toContain('data-testid="saisie-error"');
    expect(html).toContain('aria-live="polite"');
  });

  it('should display a dynamic rate-limit message using retryAfterSeconds when state is RATE_LIMITED', () => {
    mockState.current = {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 45,
    };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SaisieReleveForm context={buildContext()} />
    );

    // Message construit via buildRateLimitMessage(45)
    expect(html).toContain('Trop de tentatives');
    expect(html).toContain('45 seconde');
  });
});
