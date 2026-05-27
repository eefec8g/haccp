import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests SignatureUploadForm (US-SIG-001).
 *
 * Client Component utilisant `useActionState` + `SignaturePad`. SSR
 * statique : on couvre les invariants visibles initialement et le
 * mapping des codes d'erreur de la Server Action.
 *
 * Le pipeline canvas -> Blob -> FormData -> formAction n'est pas
 * testable en SSR (depend de pointer events client-side). Couverture E2E
 * Playwright (hors perimetre unit).
 */

interface UploadTestState {
  readonly status: 'idle' | 'success' | 'error';
  readonly code?: string;
  readonly retryAfterSeconds?: number;
}

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as UploadTestState,
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

vi.mock('@/app/actions/signature', () => ({
  signatureUploadAction: vi.fn(),
}));

import { SignatureUploadForm } from '../SignatureUploadForm';

const BOUTIQUE_ID = 'b1';
const DATE_ISO = '2026-05-27';

describe('[Signature] SignatureUploadForm', () => {
  it('should render the form with the SignaturePad and the section heading (idle state)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('data-testid="signature-upload-form"');
    expect(html).toContain('data-testid="signature-pad"');
    expect(html).toContain('Signer le registre du jour');
  });

  it('should map FORBIDDEN error code to the French message and render the error box', () => {
    mockState.current = { status: 'error', code: 'FORBIDDEN' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('data-testid="signature-upload-form-error"');
    expect(html).toContain('Vous n&#x27;avez pas la permission de signer');
  });

  it('should map SIGNATURE_ALREADY_EXISTS to the explicit French message', () => {
    mockState.current = { status: 'error', code: 'SIGNATURE_ALREADY_EXISTS' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('deja ete signe');
  });

  it('should map RATE_LIMITED to the rate-limit message including retry duration', () => {
    mockState.current = {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 45,
    };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('Trop de tentatives');
    expect(html).toContain('45 seconde');
  });

  it('should map TOO_LARGE to the French file-size message', () => {
    mockState.current = { status: 'error', code: 'TOO_LARGE' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('trop volumineux');
  });

  it('should map MAGIC_BYTES_FAIL to the French magic-bytes message', () => {
    mockState.current = { status: 'error', code: 'MAGIC_BYTES_FAIL' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('signature PNG valide');
  });

  it('should hide the success status block when the form has not been submitted yet (idle)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).not.toContain('data-testid="signature-upload-form-status"');
  });

  it('should disable the SignaturePad submit button when isPending is true', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = true;

    const html = renderToStaticMarkup(
      <SignatureUploadForm boutiqueId={BOUTIQUE_ID} dateISO={DATE_ISO} />
    );

    expect(html).toContain('aria-busy="true"');
  });

  it('should honor a custom testId prop', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <SignatureUploadForm
        boutiqueId={BOUTIQUE_ID}
        dateISO={DATE_ISO}
        testId="custom-sig-form"
      />
    );

    expect(html).toContain('data-testid="custom-sig-form"');
  });
});
