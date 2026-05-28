'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { changePasswordAction } from '@/app/actions/change-password';
import {
  INITIAL_CHANGE_PASSWORD_STATE,
  type ChangePasswordActionState,
} from '@/app/actions/change-password.types';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

const VALIDATION_ERROR_MESSAGE =
  'Le nouveau mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special, et la confirmation doit correspondre.';
const INVALID_CURRENT_MESSAGE = 'Le mot de passe actuel est incorrect.';
const SAME_PASSWORD_MESSAGE =
  "Le nouveau mot de passe doit etre different de l'actuel.";
const USER_NOT_FOUND_MESSAGE =
  'Votre compte est introuvable. Reconnectez-vous et reessayez.';
const INTERNAL_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';
const SUCCESS_MESSAGE = 'Mot de passe modifie.';

const INPUT_BASE_CLASSES =
  'block min-h-touch w-full border border-mg-noir/15 bg-transparent px-4 py-3 text-mg-noir font-light transition-colors placeholder:text-mg-noir/40 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:cursor-not-allowed disabled:opacity-60';
const LABEL_CLASSES =
  'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-mg-noir/70';
const SUBMIT_CLASSES =
  'inline-flex min-h-touch w-full items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';
const TOGGLE_CLASSES =
  'absolute inset-y-0 right-0 flex items-center px-4 text-[10px] font-medium uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or';
const ERROR_BOX_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/5 px-4 py-3 text-xs font-light text-mg-noir';
const SUCCESS_BOX_CLASSES =
  'border-l-2 border-mg-or bg-mg-or/10 px-4 py-3 text-xs font-light uppercase tracking-[0.15em] text-mg-noir';

const ERROR_MESSAGES = {
  VALIDATION: VALIDATION_ERROR_MESSAGE,
  INVALID_CURRENT_PASSWORD: INVALID_CURRENT_MESSAGE,
  SAME_PASSWORD: SAME_PASSWORD_MESSAGE,
  USER_NOT_FOUND: USER_NOT_FOUND_MESSAGE,
  INTERNAL: INTERNAL_ERROR_MESSAGE,
} as const;

function deriveErrorMessage(state: ChangePasswordActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  return ERROR_MESSAGES[state.code];
}

/**
 * Formulaire de changement de mot de passe pour l'utilisateur connecte
 * (Client Component : `useActionState` + visibilite + reset post-succes).
 *
 * Securite : seul le mot de passe ACTUEL + le nouveau (+ confirmation)
 * sont saisis ; l'identifiant du compte est resolu cote serveur via la
 * session (jamais transmis par le formulaire).
 *
 * a11y : `aria-invalid` + `aria-describedby` sur les champs, `role="alert"`
 * sur l'erreur, `role="status"` + `aria-live` sur le succes. Cibles
 * tactiles `min-h-touch`, focus ring or (charte Maison Givre).
 */
export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    INITIAL_CHANGE_PASSWORD_STATE
  );

  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const errorId = useId();
  const rulesId = useId();
  const successId = useId();
  const errorMessage = deriveErrorMessage(state);
  const isSuccess = state.status === 'success';

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
      setNewPassword('');
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="Formulaire de changement de mot de passe"
      className="space-y-6"
      data-testid="change-password-form"
      noValidate
    >
      <div>
        <label htmlFor="change-current-password" className={LABEL_CLASSES}>
          Mot de passe actuel
        </label>
        <input
          id="change-current-password"
          name="currentPassword"
          type={showPasswords ? 'text' : 'password'}
          required
          autoComplete="current-password"
          placeholder={String.fromCharCode(8226).repeat(12)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="current-password"
        />
      </div>

      <div>
        <label htmlFor="change-new-password" className={LABEL_CLASSES}>
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input
            id="change-new-password"
            name="newPassword"
            type={showPasswords ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder={String.fromCharCode(8226).repeat(12)}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            aria-invalid={!!errorMessage}
            aria-describedby={`${rulesId}${errorMessage ? ` ${errorId}` : ''}`}
            className={INPUT_BASE_CLASSES + ' pr-24'}
            data-testid="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            aria-pressed={showPasswords}
            aria-label={
              showPasswords
                ? 'Masquer les mots de passe'
                : 'Afficher les mots de passe'
            }
            className={TOGGLE_CLASSES}
            data-testid="change-password-toggle-visibility"
          >
            {showPasswords ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      </div>

      <PasswordStrengthIndicator password={newPassword} id={rulesId} />

      <div>
        <label htmlFor="change-confirm-password" className={LABEL_CLASSES}>
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="change-confirm-password"
          name="confirmPassword"
          type={showPasswords ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder={String.fromCharCode(8226).repeat(12)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="confirm-password"
        />
      </div>

      <div
        id={errorId}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={errorMessage ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="change-password-error"
      >
        {errorMessage}
      </div>

      <div
        id={successId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={isSuccess ? SUCCESS_BOX_CLASSES : 'sr-only'}
        data-testid="change-password-success"
      >
        {isSuccess ? SUCCESS_MESSAGE : ''}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={SUBMIT_CLASSES}
        data-testid="change-password-submit"
      >
        {isPending ? 'Modification en cours...' : 'Changer mon mot de passe'}
      </button>
    </form>
  );
}
