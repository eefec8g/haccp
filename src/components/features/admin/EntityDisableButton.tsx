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
  'inline-flex h-11 w-44 items-center justify-center border border-mg-noir/20 bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';

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
 * Charte Maison Givre : bouton outline discret noir, hover or, texte
 * petit en capitales espacees. Le ConfirmDialog herite du style premium.
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
