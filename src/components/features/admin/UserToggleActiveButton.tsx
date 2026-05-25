'use client';

import { useState, useTransition } from 'react';
import { disableUserAction, enableUserAction } from '@/app/actions/admin-user';
import { EntityDisableButton } from './EntityDisableButton';

interface UserToggleActiveButtonProps {
  readonly userId: string;
  readonly userLabel: string;
  readonly actif: boolean;
}

const ENABLE_BUTTON_CLASSES =
  'inline-flex items-center justify-center border border-mg-or/40 bg-transparent px-4 py-1.5 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-60';
const ERROR_BOX_CLASSES =
  'mt-2 border border-mg-or/40 bg-mg-or/5 px-3 py-2 text-[10px] font-light uppercase tracking-[0.15em] text-mg-or';

/**
 * Wrapper client pour activer/desactiver un utilisateur.
 *
 * Pattern symetrique a BoutiqueToggleActiveButton / EquipementToggleActiveButton.
 * Specifique users : on capture explicitement les erreurs LAST_ADMIN
 * (dernier admin actif refus) pour afficher un feedback dedie en regard
 * du bouton, plutot que de laisser remonter une exception non geree.
 */
export function UserToggleActiveButton({
  userId,
  userLabel,
  actif,
}: UserToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function clearError() {
    setErrorMessage(null);
  }

  async function handleDisable(motif?: string): Promise<void> {
    clearError();
    try {
      await disableUserAction(userId, motif);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Une erreur est survenue.';
      setErrorMessage(message);
      throw error;
    }
  }

  function handleEnable() {
    clearError();
    startTransition(async () => {
      try {
        await enableUserAction(userId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Une erreur est survenue.';
        setErrorMessage(message);
      }
    });
  }

  if (actif) {
    return (
      <div className="flex flex-col items-end">
        <EntityDisableButton
          entityType="utilisateur"
          entityId={userId}
          entityLabel={userLabel}
          onConfirm={handleDisable}
        />
        {errorMessage ? (
          <p
            role="alert"
            aria-live="polite"
            className={ERROR_BOX_CLASSES}
            data-testid={`disable-user-${userId}-error`}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        className={ENABLE_BUTTON_CLASSES}
        onClick={handleEnable}
        disabled={isPending}
        aria-busy={isPending}
        aria-label={`Reactiver ${userLabel}`}
        data-testid={`enable-user-${userId}`}
      >
        {isPending ? 'En cours...' : 'Reactiver'}
      </button>
      {errorMessage ? (
        <p
          role="alert"
          aria-live="polite"
          className={ERROR_BOX_CLASSES}
          data-testid={`enable-user-${userId}-error`}
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
