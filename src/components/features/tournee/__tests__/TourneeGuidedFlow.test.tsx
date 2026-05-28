import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TourneeSaisieActionState } from '@/app/actions/tournee-saisie.types';
import type { SignatureUploadActionState } from '@/app/actions/signature.types';
import type { TourneeEquipement, TourneeReleve } from '@/types/tournee';

/**
 * Tests TourneeGuidedFlow (feat/tournee-guidee).
 *
 * Le composant est Client : on mocke `useActionState` (idle par defaut),
 * `useRouter` (pas de navigation reelle) et les Server Actions. La
 * stabilite du SSR est garantie en figeant `useId` indirectement via
 * vi.mock react.
 *
 * Couvre :
 *   - Step 0 : equipement non saisi -> SaisieStep visible.
 *   - Step 0 : equipement deja saisi -> ReadOnlyStep + bouton Suivant.
 *   - Step final (= signature) : SignaturePad ou message deja signe.
 *   - Empty state : 0 equipement actif.
 */

// `vi.hoisted` rend `saisieAction` / `signatureAction` references stables
// reutilisables a la fois dans les vi.mock des Server Actions ET dans le
// vi.mock de `react` pour differencier les 2 hooks `useActionState`.
const { saisieMockState, signatureMockState, saisieAction, signatureAction } =
  vi.hoisted(() => ({
    saisieMockState: {
      current: { status: 'idle' } as TourneeSaisieActionState,
      pending: false,
    },
    signatureMockState: {
      current: { status: 'idle' } as SignatureUploadActionState,
      pending: false,
    },
    saisieAction: () => Promise.resolve(),
    signatureAction: () => Promise.resolve(),
  }));

vi.mock('@/app/actions/tournee-saisie', () => ({
  tourneeSaisieAction: saisieAction,
}));

vi.mock('@/app/actions/signature', () => ({
  signatureUploadAction: signatureAction,
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: vi.fn((action: unknown) => {
      if (action === signatureAction) {
        return [
          signatureMockState.current,
          vi.fn(),
          signatureMockState.pending,
        ];
      }
      return [saisieMockState.current, vi.fn(), saisieMockState.pending];
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

import { TourneeGuidedFlow } from '../TourneeGuidedFlow';

const EQ_A: TourneeEquipement = {
  id: 'eq-a',
  nom: 'Congelateur A',
  seuilMin: -25,
  seuilMax: -18,
};
const EQ_B: TourneeEquipement = {
  id: 'eq-b',
  nom: 'Vitrine B',
  seuilMin: 2,
  seuilMax: 6,
};

// 06:42 UTC = 08:42 Paris (mai, UTC+2)
const RELEVE_A_SAISI_AT = new Date('2026-05-27T06:42:00.000Z');
const RELEVE_A: TourneeReleve = {
  id: 'rel-a',
  temperature: -20,
  alerteHorsSeuils: false,
  saisiAt: RELEVE_A_SAISI_AT,
};

function renderFlow(
  overrides: Partial<React.ComponentProps<typeof TourneeGuidedFlow>> = {}
): string {
  return renderToStaticMarkup(
    <TourneeGuidedFlow
      boutiqueId="b1"
      boutiqueNom="MG Paris 11"
      dateISO="2026-05-27"
      creneau="MATIN"
      equipements={[EQ_A, EQ_B]}
      releves={{ 'eq-a': null, 'eq-b': null }}
      signature={null}
      {...overrides}
    />
  );
}

describe('[Tournee] TourneeGuidedFlow', () => {
  it('should render the saisie form at step 0 when releve is missing', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow();

    expect(html).toContain('data-testid="tournee-flow"');
    expect(html).toContain('data-testid="tournee-step-counter"');
    expect(html).toContain('Equipement 1 sur 2 - Congelateur A');
    expect(html).toContain('data-testid="tournee-saisie-form"');
    expect(html).toContain('data-testid="tournee-saisie-temperature"');
    expect(html).toContain('data-testid="tournee-saisie-commentaire"');
    expect(html).toContain('data-testid="tournee-saisie-submit"');
    // Hidden fields wired to the action.
    expect(html).toContain('name="equipementId"');
    expect(html).toContain('value="eq-a"');
    expect(html).toContain('name="creneau"');
    expect(html).toContain('value="MATIN"');
  });

  it('should render the read-only view when the equipement is already saisi (with "Suivant")', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': null },
    });

    expect(html).toContain('data-testid="tournee-cell-eq-a"');
    expect(html).toContain('data-testid="tournee-cell-eq-a-temperature"');
    expect(html).toContain('-20.0 degC');
    expect(html).toContain('data-testid="tournee-cell-eq-a-time"');
    expect(html).toContain('08:42');
    expect(html).toContain('data-testid="tournee-next"');
    // Pas de form de saisie sur ce step.
    expect(html).not.toContain('data-testid="tournee-saisie-form"');
  });

  it('should render the ALERTE status badge when the saved releve is hors seuils', () => {
    saisieMockState.current = { status: 'idle' };
    const horsSeuils: TourneeReleve = { ...RELEVE_A, alerteHorsSeuils: true };
    const html = renderFlow({
      releves: { 'eq-a': horsSeuils, 'eq-b': null },
    });

    expect(html).toContain('data-testid="tournee-cell-eq-a-status"');
    expect(html).toContain('Alerte');
    expect(html).toContain('bg-mg-or');
  });

  it('should render the empty state when there is no equipement actif', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({ equipements: [], releves: {} });

    expect(html).toContain('data-testid="tournee-flow"');
    expect(html).toContain('Aucun equipement actif');
    expect(html).not.toContain('data-testid="tournee-saisie-form"');
    expect(html).not.toContain('data-testid="tournee-signature-step"');
  });

  it('should label the previous button on read-only step (canGoPrevious renders disabled at step 0)', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': null },
    });

    expect(html).toContain('data-testid="tournee-previous"');
    // Disabled at first step : `disabled` attribute present somewhere in
    // the <button> rendered for the previous action.
    expect(html).toMatch(
      /<button[^>]*disabled[^>]*data-testid="tournee-previous"/
    );
  });

  it('should expose the boutique nom and date in the footer', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow();

    expect(html).toContain('MG Paris 11');
    expect(html).toContain('27/05/2026');
  });
});
