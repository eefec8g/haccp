import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TourneeSaisieActionState } from '@/app/actions/tournee-saisie.types';
import type { TourneeCorrectionActionState } from '@/app/actions/tournee-correction.types';
import type { SignatureUploadActionState } from '@/app/actions/signature.types';
import type { TourneeEquipement, TourneeReleve } from '@/types/tournee';

/**
 * Tests TourneeGuidedFlow (fix/signature-action-context).
 *
 * Le composant est Client : on mocke `useActionState` (idle par defaut),
 * `useRouter` (pas de navigation reelle) et les Server Actions. La
 * stabilite du SSR est garantie en figeant `useId` indirectement via
 * vi.mock react.
 *
 * Le rendu est SSR (`renderToStaticMarkup`) : on valide donc l'ETAT
 * INITIAL du flow, calcule paresseusement par le `useState` initializer.
 * C'est exactement ce qui permet de prouver le "skip auto" des deja saisis
 * et l'affichage du recap quand tout est saisi.
 *
 * Couvre :
 *   - Demarrage sur le premier equipement MANQUANT (skip auto des saisis).
 *   - Demarrage direct sur le RECAP quand tout est deja saisi.
 *   - Recap : lignes par equipement + bouton "Signer la tournee".
 *   - Recap : bouton "Modifier" = bouton (rouvre la correction inline,
 *     plus de lien vers la page externe /releves/{id}/annuler reservee
 *     RESPONSABLE/ADMIN -> 404 pour le salarie).
 *   - Statut OK / Alerte dans le recap.
 *   - Empty state : 0 equipement actif.
 *   - Plus de ReadOnlyStep ni de navigation Precedent/Suivant.
 */

// `vi.hoisted` rend `saisieAction` / `signatureAction` references stables
// reutilisables a la fois dans les vi.mock des Server Actions ET dans le
// vi.mock de `react` pour differencier les 2 hooks `useActionState`.
const {
  saisieMockState,
  correctionMockState,
  signatureMockState,
  saisieAction,
  correctionAction,
  signatureAction,
} = vi.hoisted(() => ({
  saisieMockState: {
    current: { status: 'idle' } as TourneeSaisieActionState,
    pending: false,
  },
  correctionMockState: {
    current: { status: 'idle' } as TourneeCorrectionActionState,
    pending: false,
  },
  signatureMockState: {
    current: { status: 'idle' } as SignatureUploadActionState,
    pending: false,
  },
  saisieAction: () => Promise.resolve(),
  correctionAction: () => Promise.resolve(),
  signatureAction: () => Promise.resolve(),
}));

vi.mock('@/app/actions/tournee-saisie', () => ({
  tourneeSaisieAction: saisieAction,
}));

vi.mock('@/app/actions/tournee-correction', () => ({
  tourneeCorrigeAction: correctionAction,
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
      if (action === correctionAction) {
        return [
          correctionMockState.current,
          vi.fn(),
          correctionMockState.pending,
        ];
      }
      return [saisieMockState.current, vi.fn(), saisieMockState.pending];
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

import { CorrectionStep, TourneeGuidedFlow } from '../TourneeGuidedFlow';

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
const RELEVE_B: TourneeReleve = {
  id: 'rel-b',
  temperature: 4,
  alerteHorsSeuils: false,
  saisiAt: new Date('2026-05-27T07:10:00.000Z'),
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
  it('should render the saisie form at step 0 when no releve exists', () => {
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

  it('should skip already-saisi equipements and start on the first missing one', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': null },
    });

    // EQ_A is saisi -> skipped : on demarre directement sur EQ_B.
    expect(html).toContain('Equipement 2 sur 2 - Vitrine B');
    expect(html).toContain('data-testid="tournee-saisie-form"');
    expect(html).toContain('value="eq-b"');
    // Plus aucun ecran de lecture seule ni bouton de navigation.
    expect(html).not.toContain('data-testid="tournee-cell-eq-a"');
    expect(html).not.toContain('data-testid="tournee-next"');
    expect(html).not.toContain('data-testid="tournee-previous"');
  });

  it('should render the recap step when every equipement is already saisi', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': RELEVE_B },
    });

    expect(html).toContain('data-testid="tournee-recap-step"');
    expect(html).toContain('Recapitulatif de votre tournee Matin');
    expect(html).toContain('Recapitulatif - 2 sur 2');
    // Une ligne par equipement, dans l'ordre du parc.
    expect(html).toContain('data-testid="tournee-recap-row-eq-a"');
    expect(html).toContain('data-testid="tournee-recap-row-eq-b"');
    expect(html).toContain('-20.0 degC');
    expect(html).toContain('4.0 degC');
    expect(html).toContain('08:42');
    // Pas de form de saisie ni de signature a ce stade.
    expect(html).not.toContain('data-testid="tournee-saisie-form"');
    expect(html).not.toContain('data-testid="tournee-signature-step"');
  });

  it('should expose a "Signer la tournee" button on the recap step', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': RELEVE_B },
    });

    expect(html).toContain('data-testid="tournee-recap-signer"');
    expect(html).toContain('Signer la tournee');
  });

  it('should render a "Modifier" button (not a link to the annulation page) per recap row', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({
      releves: { 'eq-a': RELEVE_A, 'eq-b': RELEVE_B },
    });

    // Le bouton rouvre la correction inline dans le flow : ce n'est PLUS
    // un lien vers la page externe /releves/{id}/annuler (404 salarie).
    expect(html).toContain('data-testid="tournee-recap-modifier-eq-a"');
    expect(html).toContain('data-testid="tournee-recap-modifier-eq-b"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Modifier le releve de Congelateur A"');
    // Aucun lien vers l'ancienne page d'annulation reservee RESPONSABLE/ADMIN.
    expect(html).not.toContain('/annuler');
    expect(html).not.toContain('backTo=');
  });
});

describe('[Tournee] CorrectionStep', () => {
  function renderCorrection(
    overrides: Partial<React.ComponentProps<typeof CorrectionStep>> = {}
  ): string {
    return renderToStaticMarkup(
      <CorrectionStep
        equipement={EQ_A}
        creneau="MATIN"
        releve={RELEVE_A}
        onCorrected={vi.fn()}
        onCancel={vi.fn()}
        {...overrides}
      />
    );
  }

  it('should render the correction form with the visual "Correction de" indication', () => {
    correctionMockState.current = { status: 'idle' };
    const html = renderCorrection();

    expect(html).toContain('data-testid="tournee-correction-form"');
    expect(html).toContain('data-testid="tournee-correction-title"');
    expect(html).toContain('Correction de Congelateur A');
    expect(html).toContain('data-testid="tournee-correction-submit"');
    expect(html).toContain('data-testid="tournee-correction-cancel"');
  });

  it('should pre-fill the temperature input with the current releve value', () => {
    correctionMockState.current = { status: 'idle' };
    const html = renderCorrection();

    // -20 deja saisi : l'input doit etre pre-rempli pour une correction rapide.
    expect(html).toContain('data-testid="tournee-correction-temperature"');
    expect(html).toContain('value="-20"');
  });

  it('should wire the hidden fields (releveId, equipementId, creneau) for the action', () => {
    correctionMockState.current = { status: 'idle' };
    const html = renderCorrection();

    expect(html).toContain('name="releveId"');
    expect(html).toContain('value="rel-a"');
    expect(html).toContain('name="equipementId"');
    expect(html).toContain('value="eq-a"');
    expect(html).toContain('name="creneau"');
    expect(html).toContain('value="MATIN"');
  });

  it('should surface the service error message when the correction is rejected (deja signee)', () => {
    correctionMockState.current = {
      status: 'error',
      code: 'TOURNEE_DEJA_SIGNEE',
    };
    const html = renderCorrection();

    expect(html).toContain('data-testid="tournee-correction-error"');
    expect(html).toContain('deja signee');
  });

  it('should render the ALERTE status badge in the recap when a releve is hors seuils', () => {
    saisieMockState.current = { status: 'idle' };
    const horsSeuils: TourneeReleve = { ...RELEVE_A, alerteHorsSeuils: true };
    const html = renderFlow({
      releves: { 'eq-a': horsSeuils, 'eq-b': RELEVE_B },
    });

    expect(html).toContain('data-testid="tournee-recap-status-eq-a"');
    expect(html).toContain('Alerte');
    expect(html).toContain('bg-mg-or');
    // EQ_B reste OK.
    expect(html).toContain('data-testid="tournee-recap-status-eq-b"');
    expect(html).toContain('>OK</span>');
  });

  it('should render the empty state when there is no equipement actif', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow({ equipements: [], releves: {} });

    expect(html).toContain('data-testid="tournee-flow"');
    expect(html).toContain('Aucun equipement actif');
    expect(html).not.toContain('data-testid="tournee-saisie-form"');
    expect(html).not.toContain('data-testid="tournee-signature-step"');
    expect(html).not.toContain('data-testid="tournee-recap-step"');
  });

  it('should expose the boutique nom and date in the footer', () => {
    saisieMockState.current = { status: 'idle' };
    const html = renderFlow();

    expect(html).toContain('MG Paris 11');
    expect(html).toContain('27/05/2026');
  });
});
