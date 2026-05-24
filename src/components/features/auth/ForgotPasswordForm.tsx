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

const INPUT_BASE_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const LABEL_CLASSES = 'mb-1 block text-sm font-medium text-[#2A3547]';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center rounded-[7px] bg-[#5D87FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

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
    return 'rounded-[7px] border border-[#13DEB9]/20 bg-[#E6FFFA] px-4 py-3 text-sm text-[#0a9d83]';
  }
  if (tone === 'error') {
    return 'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]';
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
      className="space-y-5"
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
        {isPending
          ? 'Envoi en cours...'
          : 'Envoyer le lien de reinitialisation'}
      </button>
    </form>
  );
}
