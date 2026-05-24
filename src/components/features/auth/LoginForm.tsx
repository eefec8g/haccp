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
      className="space-y-4"
      data-testid="login-form"
      noValidate
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
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
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className="w-full px-4 py-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="login-email"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className="w-full px-4 py-3 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="login-password"
        />
      </div>

      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={errorMessage ? 'text-sm text-red-600' : 'sr-only'}
        data-testid="login-error"
      >
        {errorMessage}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full py-3 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="login-submit"
      >
        {isPending ? 'Connexion en cours...' : 'Se connecter'}
      </button>

      <div className="text-center">
        <Link
          href={FORGOT_PASSWORD_HREF}
          className="text-sm text-blue-600 hover:underline"
          data-testid="login-forgot-password"
        >
          Mot de passe oublie ?
        </Link>
      </div>
    </form>
  );
}
