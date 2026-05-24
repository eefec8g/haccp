'use client';

import { useActionState, useEffect, useId } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import {
  INITIAL_LOGIN_STATE,
  loginAction,
  type LoginActionState,
} from '@/app/actions/auth';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { sanitizeCallbackUrl } from '@/lib/utils/sanitize-callback-url';

const FORGOT_PASSWORD_HREF = '/forgot-password' as Route;

const GENERIC_ERROR = 'Email ou mot de passe incorrect';
const INTERNAL_ERROR =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const INPUT_BASE_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const LABEL_CLASSES = 'mb-1 block text-sm font-medium text-[#2A3547]';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center rounded-[7px] bg-[#5D87FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

function getErrorMessage(state: LoginActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'RATE_LIMITED') {
    return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
  }
  if (state.code === 'INTERNAL') {
    return INTERNAL_ERROR;
  }
  return GENERIC_ERROR;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_LOGIN_STATE
  );

  const errorId = useId();
  const errorMessage = getErrorMessage(state);

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }
    const callback = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
    const destination = callback ?? state.redirectTo;
    // Hard navigation : force le rejeu du middleware avec la nouvelle session JWT
    // (router.push() conserve le cache RSC pre-auth).
    window.location.assign(destination);
  }, [state, searchParams]);

  return (
    <form
      action={formAction}
      aria-label="Formulaire de connexion"
      className="space-y-5"
      data-testid="login-form"
      noValidate
    >
      <div>
        <label htmlFor="email" className={LABEL_CLASSES}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          placeholder="prenom@maison-givre.fr"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="login-email"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="password" className={LABEL_CLASSES + ' mb-0'}>
            Mot de passe
          </label>
          <Link
            href={FORGOT_PASSWORD_HREF}
            className="text-sm font-medium text-[#5D87FF] hover:text-[#4570e6]"
            data-testid="login-forgot-password"
          >
            Mot de passe oublie ?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="............"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="login-password"
        />
      </div>

      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={
          errorMessage
            ? 'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]'
            : 'sr-only'
        }
        data-testid="login-error"
      >
        {errorMessage}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={SUBMIT_CLASSES}
        data-testid="login-submit"
      >
        {isPending ? 'Connexion en cours...' : 'Se connecter'}
      </button>
    </form>
  );
}
