'use client';

import { useTransition } from 'react';
import {
  disableEquipementAction,
  enableEquipementAction,
} from '@/app/actions/admin-equipement';
import { EntityDisableButton } from './EntityDisableButton';

interface EquipementToggleActiveButtonProps {
  readonly equipementId: string;
  readonly equipementNom: string;
  readonly actif: boolean;
}

const ENABLE_BUTTON_CLASSES =
  'inline-flex h-11 w-44 items-center justify-center border border-mg-or/40 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Wrapper client pour activer/desactiver un equipement.
 *
 * - Si l'equipement est actif : delegue a `EntityDisableButton` qui gere
 *   le ConfirmDialog + l'aria-label.
 * - Si l'equipement est desactive : bouton "Reactiver" direct (action
 *   non destructive, pas de confirmation necessaire).
 *
 * Pattern symetrique a BoutiqueToggleActiveButton (DRY conceptuel).
 */
export function EquipementToggleActiveButton({
  equipementId,
  equipementNom,
  actif,
}: EquipementToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  if (actif) {
    return (
      <EntityDisableButton
        entityType="equipement"
        entityId={equipementId}
        entityLabel={equipementNom}
        onConfirm={(motif) => disableEquipementAction(equipementId, motif)}
      />
    );
  }

  function handleEnable() {
    startTransition(async () => {
      await enableEquipementAction(equipementId);
    });
  }

  return (
    <button
      type="button"
      className={ENABLE_BUTTON_CLASSES}
      onClick={handleEnable}
      disabled={isPending}
      aria-busy={isPending}
      aria-label={`Reactiver ${equipementNom}`}
      data-testid={`enable-equipement-${equipementId}`}
    >
      {isPending ? 'En cours...' : 'Reactiver'}
    </button>
  );
}
