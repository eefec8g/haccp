'use client';

import { useActionState, useId } from 'react';
import { forgotPasswordAction } from '@/app/actions/password-reset';
import {
  INITIAL_FORGOT_PASSWORD_STATE,
  type ForgotPasswordActionState,
} from '@/app/actions/password-reset.types';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';

const GENERIC_SUCCESS_MESSAGE =
  'Si un compte existe pour cet email, un lien de reinitialisation vient de vous etre envoye.';
const VALIDATION_ERROR_MESSAGE = "L'email est invalide.";
const INTERNAL_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const INPUT_BASE_CLASSES =
  'block w-full border border-mg-noir/15 bg-transparent px-4 py-3 text-mg-noir font-light transition-colors placeholder:text-mg-noir/40 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:opacity-60';
const LABEL_CLASSES =
  'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';

interface DerivedMessage {
  readonly text: string | null;
  readonly tone: 'success' | 'error' | null;
}

function deriveMessage(state: ForgotPasswordActionState): DerivedMessage {
  if (state.status === 'success') {
    return { text: GENERIC_SUCCESS_MESSAGE, tone: 'success' };
  }
  if (state.status !== 'error') {
    return { text: null, tone: null };
  }
  if (state.code === 'RATE_LIMITED') {
    return {
      text: buildRateLimitMessage(state.retryAfterSeconds ?? 0),
      tone: 'error',
    };
  }
  if (state.code === 'VALIDATION') {
    return { text: VALIDATION_ERROR_MESSAGE, tone: 'error' };
  }
  return { text: INTERNAL_ERROR_MESSAGE, tone: 'error' };
}

function getMessageClasses(tone: 'success' | 'error' | null): string {
  if (tone === 'success') {
    return 'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-light text-mg-noir';
  }
  if (tone === 'error') {
    return 'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-light text-mg-noir';
  }
  return 'sr-only';
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    INITIAL_FORGOT_PASSWORD_STATE
  );

  const messageId = useId();
  const { text: message, tone } = deriveMessage(state);
  const isError = tone === 'error';

  return (
    <form
      action={formAction}
      aria-label="Formulaire de demande de reinitialisation"
      className="space-y-6"
      data-testid="forgot-form"
      noValidate
    >
      <div>
        <label htmlFor="forgot-email" className={LABEL_CLASSES}>
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          placeholder="prenom@maison-givre.fr"
          aria-invalid={isError}
          aria-describedby={message ? messageId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="forgot-email"
        />
      </div>

      <div
        id={messageId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={getMessageClasses(tone)}
        data-testid="forgot-message"
      >
        {message}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={SUBMIT_CLASSES}
        data-testid="forgot-submit"
      >
        {isPending ? 'Envoi en cours...' : 'Envoyer le lien'}
      </button>
    </form>
  );
}
