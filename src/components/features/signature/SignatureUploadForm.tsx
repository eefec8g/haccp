'use client';

import { startTransition, useActionState, useId, useState } from 'react';
import { signatureUploadAction } from '@/app/actions/signature';
import {
  INITIAL_SIGNATURE_UPLOAD_STATE,
  type SignatureUploadActionState,
} from '@/app/actions/signature.types';
import { resolveSignatureErrorMessage } from '@/lib/utils/signature-error-messages';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { ERROR_BOX_CLASSES } from '@/components/features/ui/form-styles';
import { MG_EYEBROW_CLASSES } from '@/lib/constants/styles';
import { SignaturePad } from './SignaturePad';

/**
 * Formulaire d'upload de signature manuscrite (US-SIG-001).
 *
 * Wrapper qui combine :
 *   - `SignaturePad` (capture canvas client-side -> Blob PNG).
 *   - `useActionState(signatureUploadAction, ...)` pour le pipeline
 *     server-side (auth + rate-limit + magic bytes + INSERT + audit).
 *
 * Quand `SignaturePad.onSign(blob)` est declenche :
 *   - On construit un `FormData` avec `boutiqueId` + `dateISO` + `file`.
 *   - On invoque `formAction(formData)` (transition React 19).
 *   - L'UI passe en `aria-busy` et le SignaturePad devient `disabled`.
 *
 * Etats UI exposes :
 *   - idle      : SignaturePad actif.
 *   - signing   : transition en cours -> SignaturePad disabled.
 *   - success   : message confirmation `data-testid=signature-upload-status`.
 *   - error     : message FR via `resolveSignatureErrorMessage`.
 *
 * a11y :
 *   - `aria-live="polite"` sur status (success + error).
 *   - `aria-busy` sur le wrapper pendant la transition.
 *   - Boutons disabled = focus retenu sur le canvas.
 *
 * Note design : un signataire qui a deja signe ce registre (le cas
 * dominant apres premier signe) ne devrait pas voir ce formulaire. Le
 * Server Component parent (`SignatureSection`) rend `SignatureDisplay`
 * dans ce cas. On reste defensif : si l'erreur SIGNATURE_ALREADY_EXISTS
 * remonte (race condition), on affiche le message FR.
 */

const FORM_CLASSES =
  'flex flex-col gap-4 border border-mg-noir/10 bg-mg-ivoire/40 p-5';
const HEADER_CLASSES = 'flex flex-col gap-1';
const TITLE_CLASSES =
  'text-base font-light uppercase tracking-[0.2em] text-mg-noir';
const SUCCESS_BOX_CLASSES =
  'border border-mg-noir/15 bg-mg-ivoire px-4 py-3 text-xs font-light uppercase tracking-[0.15em] text-mg-noir';

const HEADER_EYEBROW = 'Maison Givre - Audit HACCP';
const HEADER_TITLE = 'Signer le registre du jour';
const SUCCESS_MESSAGE =
  'Signature enregistree. Le registre est verrouille pour cette journee.';

function getGlobalErrorMessage(
  state: SignatureUploadActionState
): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'RATE_LIMITED') {
    return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
  }
  return resolveSignatureErrorMessage(state.code);
}

function buildFormData(args: {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly blob: Blob;
}): FormData {
  const formData = new FormData();
  formData.set('boutiqueId', args.boutiqueId);
  formData.set('dateISO', args.dateISO);
  formData.set('file', args.blob, 'signature.png');
  return formData;
}

export interface SignatureUploadFormProps {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly testId?: string;
}

export function SignatureUploadForm({
  boutiqueId,
  dateISO,
  testId,
}: SignatureUploadFormProps) {
  const [state, formAction, isPending] = useActionState(
    signatureUploadAction,
    INITIAL_SIGNATURE_UPLOAD_STATE
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const statusId = useId();

  const globalError = getGlobalErrorMessage(state);
  const isSuccess = state.status === 'success';
  const showSuccess = isSuccess && hasSubmitted;
  const resolvedTestId = testId ?? 'signature-upload-form';

  function handleSign(blob: Blob): void {
    setHasSubmitted(true);
    startTransition(() => {
      formAction(buildFormData({ boutiqueId, dateISO, blob }));
    });
  }

  return (
    <section
      aria-label="Formulaire de signature du registre"
      aria-busy={isPending}
      className={FORM_CLASSES}
      data-testid={resolvedTestId}
    >
      <header className={HEADER_CLASSES}>
        <p className={MG_EYEBROW_CLASSES}>{HEADER_EYEBROW}</p>
        <h2 className={TITLE_CLASSES}>{HEADER_TITLE}</h2>
      </header>

      <SignaturePad onSign={handleSign} disabled={isPending || isSuccess} />

      {globalError ? (
        <div
          id={statusId}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          className={ERROR_BOX_CLASSES}
          data-testid={`${resolvedTestId}-error`}
        >
          {globalError}
        </div>
      ) : null}

      {showSuccess ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={SUCCESS_BOX_CLASSES}
          data-testid={`${resolvedTestId}-status`}
        >
          {SUCCESS_MESSAGE}
        </div>
      ) : null}
    </section>
  );
}
