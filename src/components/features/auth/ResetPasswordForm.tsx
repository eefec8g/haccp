'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import {
  resetPasswordAction,
  INITIAL_RESET_PASSWORD_STATE,
  type ResetPasswordActionState,
} from '@/app/actions/password-reset';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

const GENERIC_ERROR_MESSAGE =
  'Lien invalide ou expire. Demandez un nouveau lien depuis la page Mot de passe oublie.';
const VALIDATION_ERROR_MESSAGE =
  'Le mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special, et la confirmation doit correspondre.';
const INTERNAL_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

const INPUT_BASE_CLASSES =
  'block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-[#2A3547] shadow-sm transition-colors placeholder:text-gray-400 focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] disabled:cursor-not-allowed disabled:bg-gray-50';
const LABEL_CLASSES = 'mb-1 block text-sm font-medium text-[#2A3547]';
const SUBMIT_CLASSES =
  'inline-flex w-full items-center justify-center rounded-[7px] bg-[#5D87FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

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
      // Hard navigation : force le rejeu du middleware sans cache RSC.
      window.location.assign(state.redirectTo);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      aria-label="Formulaire de reinitialisation du mot de passe"
      className="space-y-5"
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
            placeholder="............"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!errorMessage}
            aria-describedby={`${rulesId}${errorMessage ? ` ${errorId}` : ''}`}
            className={INPUT_BASE_CLASSES + ' pr-20'}
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
            className="absolute inset-y-0 right-0 flex items-center px-4 text-sm font-medium text-[#5D87FF] hover:text-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2"
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
          placeholder="............"
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
        className={
          errorMessage
            ? 'rounded-[7px] border border-[#FA896B]/20 bg-[#FFF0EC] px-4 py-3 text-sm text-[#FA896B]'
            : 'sr-only'
        }
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
        {isPending
          ? 'Reinitialisation en cours...'
          : 'Reinitialiser le mot de passe'}
      </button>
    </form>
  );
}
