'use client';

import { useState, useTransition } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

interface EntityDisableButtonProps {
  readonly entityType: 'boutique' | 'equipement' | 'utilisateur';
  readonly entityId: string;
  readonly entityLabel: string;
  /**
   * Callback de confirmation. Le motif optionnel saisi est transmis
   * pour journalisation HACCP (US-ADM-004).
   */
  readonly onConfirm: (motif?: string) => Promise<void>;
  readonly disabled?: boolean;
}

const BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#FA896B]/40 bg-white px-3 py-1.5 text-sm font-semibold text-[#FA896B] transition-colors hover:bg-[#FFF0EC] focus:outline-none focus:ring-2 focus:ring-[#FA896B] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const ENTITY_LABELS: Readonly<
  Record<EntityDisableButtonProps['entityType'], string>
> = {
  boutique: 'la boutique',
  equipement: "l'equipement",
  utilisateur: "l'utilisateur",
} as const;

/**
 * Bouton "Desactiver" generique avec confirmation modale.
 *
 * Le caller fournit `onConfirm` (Server Action wrapper) : le bouton ne
 * connait pas le service - separation des couches preservee.
 *
 * UX : `useTransition` pour suivre l'etat pending, le dialog reste
 * ouvert pendant l'action pour eviter un flash si erreur.
 */
export function EntityDisableButton({
  entityType,
  entityId,
  entityLabel,
  onConfirm,
  disabled = false,
}: EntityDisableButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(motif?: string) {
    startTransition(async () => {
      await onConfirm(motif);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        className={BUTTON_CLASSES}
        onClick={() => setOpen(true)}
        disabled={disabled || isPending}
        data-testid={`disable-${entityType}-${entityId}`}
        aria-label={`Desactiver ${entityLabel}`}
      >
        Desactiver
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Desactiver ${ENTITY_LABELS[entityType]}`}
        description={`Confirmer la desactivation de ${entityLabel} ? L'entite restera dans l'historique mais ne sera plus utilisable.`}
        confirmLabel="Desactiver"
        confirmVariant="danger"
        onConfirm={handleConfirm}
        isPending={isPending}
        motifConfig={{
          label: 'Motif de desactivation',
          placeholder: 'Ex : equipement hors service definitivement',
          hint: 'Optionnel mais recommande pour la tracabilite HACCP.',
        }}
      />
    </>
  );
}
