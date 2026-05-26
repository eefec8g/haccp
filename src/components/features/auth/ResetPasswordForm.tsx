'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { resetPasswordAction } from '@/app/actions/password-reset';
import {
  INITIAL_RESET_PASSWORD_STATE,
  type ResetPasswordActionState,
} from '@/app/actions/password-reset.types';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

const GENERIC_ERROR_MESSAGE =
  'Lien invalide ou expire. Demandez un nouveau lien depuis la page Mot de passe oublie.';
const VALIDATION_ERROR_MESSAGE =
  'Le mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special, et la confirmation doit correspondre.';
const INTERNAL_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const INPUT_BASE_CLASSES =
  'block w-full border border-mg-noir/15 bg-transparent px-4 py-3 text-mg-noir font-light transition-colors placeholder:text-mg-noir/40 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:opacity-60';
const LABEL_CLASSES =
  'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';
const TOGGLE_CLASSES =
  'absolute inset-y-0 right-0 flex items-center px-4 text-[10px] font-medium uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or';
const ERROR_BOX_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-light text-mg-noir';

function deriveErrorMessage(state: ResetPasswordActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_ERROR_MESSAGE;
  }
  if (state.code === 'INTERNAL') {
    return INTERNAL_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

interface ResetPasswordFormProps {
  readonly token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    INITIAL_RESET_PASSWORD_STATE
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const errorId = useId();
  const rulesId = useId();
  const errorMessage = deriveErrorMessage(state);

  useEffect(() => {
    if (state.status === 'success') {
      window.location.assign(state.redirectTo);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      aria-label="Formulaire de reinitialisation du mot de passe"
      className="space-y-6"
      data-testid="reset-form"
      noValidate
    >
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="reset-password" className={LABEL_CLASSES}>
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input
            id="reset-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder={String.fromCharCode(8226).repeat(12)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!errorMessage}
            aria-describedby={`${rulesId}${errorMessage ? ` ${errorId}` : ''}`}
            className={INPUT_BASE_CLASSES + ' pr-24'}
            data-testid="reset-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
            aria-label={
              showPassword
                ? 'Masquer le mot de passe'
                : 'Afficher le mot de passe'
            }
            className={TOGGLE_CLASSES}
            data-testid="reset-toggle-visibility"
          >
            {showPassword ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      </div>

      <PasswordStrengthIndicator password={password} id={rulesId} />

      <div>
        <label htmlFor="reset-confirm-password" className={LABEL_CLASSES}>
          Confirmer le mot de passe
        </label>
        <input
          id="reset-confirm-password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder={String.fromCharCode(8226).repeat(12)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="reset-confirm-password"
        />
      </div>

      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={errorMessage ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="reset-error"
      >
        {errorMessage}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={SUBMIT_CLASSES}
        data-testid="reset-submit"
      >
        {isPending ? 'Reinitialisation en cours...' : 'Reinitialiser'}
      </button>
    </form>
  );
}
