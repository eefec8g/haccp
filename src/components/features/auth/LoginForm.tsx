'use client';

import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { signIn } from 'next-auth/react';
import { sanitizeCallbackUrl } from '@/lib/utils/sanitize-callback-url';
import { fetchPostLoginRoute } from '@/lib/utils/authRedirect';
import { extractErrorMessage } from '@/lib/api/error';

const FORGOT_PASSWORD_HREF = '/forgot-password' as Route;

const GENERIC_ERROR = 'Email ou mot de passe incorrect';
const RETRY_ERROR =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const INPUT_BASE_CLASSES =
  'block w-full border border-mg-noir/15 bg-transparent px-4 py-3 text-mg-noir font-light transition-colors placeholder:text-mg-noir/40 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:opacity-60';
const LABEL_CLASSES =
  'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';
const LINK_CLASSES =
  'text-[11px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:text-mg-or';

type FormStatus = 'idle' | 'submitting' | 'error';

interface FormState {
  readonly status: FormStatus;
  readonly errorMessage: string;
}

const INITIAL_FORM_STATE: FormState = {
  status: 'idle',
  errorMessage: '',
};

interface RateLimitErrorPayload {
  readonly error?: string;
}

/**
 * Lit le message d'erreur retourne par `/api/auth/login` (typiquement un
 * rate-limit FR formatte cote serveur). Tolerant aux payloads malformes :
 * fallback sur un message generique pour ne jamais bloquer l'UX.
 */
async function readRateLimitError(response: Response): Promise<string> {
  try {
    const payload: RateLimitErrorPayload = await response.json();
    return typeof payload.error === 'string' && payload.error.length > 0
      ? payload.error
      : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

/**
 * Formulaire de connexion HACCP (style Maison Givre).
 *
 * Pattern : pre-check rate-limit via fetch `/api/auth/login`, puis
 * `signIn('credentials', { redirect: false })` cote CLIENT (next-auth/react)
 * pour que NextAuth pose proprement le cookie de session via sa propre
 * route API. Une fois le cookie pose, on demande au serveur la cible de
 * redirection (`fetchPostLoginRoute`) puis `window.location.assign` pour
 * forcer une vraie navigation (rejeu du middleware + reset cache RSC).
 */
export function LoginForm(): React.ReactElement {
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const errorId = useId();

  const isSubmitting = formState.status === 'submitting';
  const errorMessage =
    formState.status === 'error' ? formState.errorMessage : null;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    setFormState({ status: 'submitting', errorMessage: '' });

    try {
      const rateLimitResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!rateLimitResponse.ok) {
        const message = await readRateLimitError(rateLimitResponse);
        setFormState({ status: 'error', errorMessage: message });
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setFormState({ status: 'error', errorMessage: GENERIC_ERROR });
        return;
      }

      const callback = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
      const destination = callback ?? (await fetchPostLoginRoute());

      window.location.assign(destination);
    } catch (error: unknown) {
      setFormState({
        status: 'error',
        errorMessage: extractErrorMessage(error, RETRY_ERROR),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulaire de connexion"
      className="space-y-6"
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
          disabled={isSubmitting}
          className={INPUT_BASE_CLASSES}
          data-testid="login-email"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="password" className={LABEL_CLASSES + ' mb-0'}>
            Mot de passe
          </label>
          <Link
            href={FORGOT_PASSWORD_HREF}
            className={LINK_CLASSES}
            data-testid="login-forgot-password"
          >
            Oublie ?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={String.fromCharCode(8226).repeat(12)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          disabled={isSubmitting}
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
            ? 'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-light text-mg-noir'
            : 'sr-only'
        }
        data-testid="login-error"
      >
        {errorMessage}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className={SUBMIT_CLASSES}
        data-testid="login-submit"
      >
        {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
      </button>
    </form>
  );
}
