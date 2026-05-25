'use client';

import { useTransition } from 'react';
import {
  disableBoutiqueAction,
  enableBoutiqueAction,
} from '@/app/actions/admin-boutique';
import { EntityDisableButton } from './EntityDisableButton';

interface BoutiqueToggleActiveButtonProps {
  readonly boutiqueId: string;
  readonly boutiqueNom: string;
  readonly actif: boolean;
}

const ENABLE_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#13DEB9]/40 bg-white px-3 py-1.5 text-sm font-semibold text-[#0F9F86] transition-colors hover:bg-[#E6FBF6] focus:outline-none focus:ring-2 focus:ring-[#13DEB9] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Wrapper client pour activer/desactiver une boutique depuis la liste
 * ou la page de detail.
 *
 * - Si la boutique est active : delegue a `EntityDisableButton` qui
 *   gere le ConfirmDialog + l'aria-label.
 * - Si la boutique est desactivee : bouton "Reactiver" direct (action
 *   non destructive, pas de confirmation necessaire).
 *
 * On capture l'id dans une closure plutot que via FormData pour rester
 * compatible avec la signature `() => Promise<void>` attendue par
 * `EntityDisableButton`.
 */
export function BoutiqueToggleActiveButton({
  boutiqueId,
  boutiqueNom,
  actif,
}: BoutiqueToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  if (actif) {
    return (
      <EntityDisableButton
        entityType="boutique"
        entityId={boutiqueId}
        entityLabel={boutiqueNom}
        onConfirm={(motif) => disableBoutiqueAction(boutiqueId, motif)}
      />
    );
  }

  function handleEnable() {
    startTransition(async () => {
      await enableBoutiqueAction(boutiqueId);
    });
  }

  return (
    <button
      type="button"
      className={ENABLE_BUTTON_CLASSES}
      onClick={handleEnable}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={`Reactiver ${boutiqueNom}`}
      data-testid={`enable-boutique-${boutiqueId}`}
    >
      {isPending ? 'En cours...' : 'Reactiver'}
    </button>
  );
}
