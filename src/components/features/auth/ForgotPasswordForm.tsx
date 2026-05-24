'use client';

import { useActionState, useId } from 'react';
import {
  forgotPasswordAction,
  INITIAL_FORGOT_PASSWORD_STATE,
  type ForgotPasswordActionState,
} from '@/app/actions/password-reset';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';

const GENERIC_SUCCESS_MESSAGE =
  'Si un compte existe pour cet email, un lien de reinitialisation vient de vous etre envoye.';
const VALIDATION_ERROR_MESSAGE = "L'email est invalide.";
const INTERNAL_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

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
      className="space-y-4"
      data-testid="forgot-form"
      noValidate
    >
      <div>
        <label
          htmlFor="forgot-email"
          className="block text-sm font-medium mb-1"
        >
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
          aria-invalid={isError}
          aria-describedby={message ? messageId : undefined}
          className="w-full px-4 py-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="forgot-email"
        />
      </div>

      <div
        id={messageId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={
          message
            ? isError
              ? 'text-sm text-red-600'
              : 'text-sm text-green-700'
            : 'sr-only'
        }
        data-testid="forgot-message"
      >
        {message}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="forgot-submit"
      >
        {isPending
          ? 'Envoi en cours...'
          : 'Envoyer le lien de reinitialisation'}
      </button>
    </form>
  );
}
