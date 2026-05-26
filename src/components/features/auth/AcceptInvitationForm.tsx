'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import type { UserRole } from '@prisma/client';
import { acceptInvitationAction } from '@/app/actions/admin-user';
import {
  INITIAL_ACCEPT_INVITATION_STATE,
  type AcceptInvitationActionState,
} from '@/app/actions/admin-user.types';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

interface AcceptInvitationFormProps {
  readonly token: string;
  readonly email: string;
  readonly role: UserRole;
}

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
const SUMMARY_CLASSES =
  'border border-mg-or/30 bg-mg-ivoire px-4 py-3 text-xs font-light tracking-wide text-mg-noir';

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  SALARIE: 'salarie',
  RESPONSABLE: 'responsable',
  ADMIN: 'administrateur',
} as const;

const INVALID_MESSAGE =
  'Lien invalide ou expire. Demandez une nouvelle invitation a votre administrateur.';
const VALIDATION_MESSAGE =
  'Le mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special, et la confirmation doit correspondre.';
const RATE_LIMITED_MESSAGE =
  'Trop de tentatives. Reessayez dans quelques minutes.';
const GENERIC_ERROR_MESSAGE =
  'Une erreur est survenue. Merci de reessayer dans quelques instants.';

function deriveErrorMessage(state: AcceptInvitationActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'VALIDATION') {
    return VALIDATION_MESSAGE;
  }
  if (state.code === 'RATE_LIMITED') {
    return RATE_LIMITED_MESSAGE;
  }
  if (state.code === 'INVALID') {
    return INVALID_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Formulaire d'acceptation d'invitation (US-ADM-003), style Maison Givre.
 *
 * - Public (l'utilisateur n'est pas encore connecte).
 * - Le token est passe en hidden + valide cote serveur.
 * - On reutilise PasswordStrengthIndicator (DRY avec ResetPasswordForm).
 * - Apres succes : hard navigation vers /login?welcome=true pour forcer
 *   un rejeu du middleware (cookie session non encore pose).
 */
export function AcceptInvitationForm({
  token,
  email,
  role,
}: AcceptInvitationFormProps) {
  const [state, formAction, isPending] = useActionState(
    acceptInvitationAction,
    INITIAL_ACCEPT_INVITATION_STATE
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
      aria-label="Formulaire d'acceptation d'invitation"
      className="space-y-6"
      data-testid="accept-form"
      noValidate
    >
      <input type="hidden" name="token" value={token} />

      <p className={SUMMARY_CLASSES} data-testid="accept-invitation-summary">
        Vous etes invite a creer un compte{' '}
        <strong className="font-medium tracking-wide text-mg-or uppercase">
          {ROLE_LABELS[role]}
        </strong>{' '}
        pour <strong className="font-medium text-mg-noir">{email}</strong>.
      </p>

      <div>
        <label htmlFor="accept-password" className={LABEL_CLASSES}>
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="accept-password"
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
            data-testid="accept-password"
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
            data-testid="accept-toggle-visibility"
          >
            {showPassword ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      </div>

      <PasswordStrengthIndicator password={password} id={rulesId} />

      <div>
        <label htmlFor="accept-confirm-password" className={LABEL_CLASSES}>
          Confirmer le mot de passe
        </label>
        <input
          id="accept-confirm-password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder={String.fromCharCode(8226).repeat(12)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? errorId : undefined}
          className={INPUT_BASE_CLASSES}
          data-testid="accept-confirm-password"
        />
      </div>

      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={errorMessage ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="accept-error"
      >
        {errorMessage}
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={SUBMIT_CLASSES}
        data-testid="accept-submit"
      >
        {isPending ? 'Activation en cours...' : 'Activer mon compte'}
      </button>
    </form>
  );
}
