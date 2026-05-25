'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ENTITY_DISABLE_MOTIF_MAX } from '@/lib/constants/admin';

export type ConfirmVariant = 'default' | 'danger';

/**
 * Configuration d'un champ motif optionnel dans le dialog. Le motif
 * est transmis a `onConfirm` lors du clic confirmer. Permet de tracer
 * une justification HACCP pour les desactivations.
 */
export interface ConfirmMotifConfig {
  readonly label: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly maxLength?: number;
}

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmVariant?: ConfirmVariant;
  readonly onConfirm: (motif?: string) => void | Promise<void>;
  readonly isPending?: boolean;
  /**
   * Active un textarea pour saisir un motif (US-ADM-004). Le motif est
   * passe a `onConfirm` (ou undefined si laisse vide).
   */
  readonly motifConfig?: ConfirmMotifConfig;
}

const OVERLAY_CLASSES =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
const DIALOG_CLASSES =
  'w-full max-w-md rounded-[7px] border border-[#DFE5EF] bg-white p-6 shadow-2xl';
const TITLE_CLASSES = 'text-lg font-semibold text-[#2A3547]';
const DESCRIPTION_CLASSES = 'mt-2 text-sm text-[#5A6A85]';
const CANCEL_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-2 text-sm font-semibold text-[#2A3547] transition-colors hover:bg-[#ECF2FF] hover:text-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2 disabled:opacity-60';
const CONFIRM_BASE =
  'inline-flex items-center justify-center rounded-[7px] px-4 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const CONFIRM_DEFAULT = 'bg-[#5D87FF] hover:bg-[#4570e6] focus:ring-[#5D87FF]';
const CONFIRM_DANGER = 'bg-[#FA896B] hover:bg-[#e7745a] focus:ring-[#FA896B]';
const MOTIF_LABEL_CLASSES = 'mt-4 block text-sm font-medium text-[#2A3547]';
const MOTIF_TEXTAREA_CLASSES =
  'mt-1 block w-full rounded-[7px] border border-[#DFE5EF] bg-white px-3 py-2 text-sm text-[#2A3547] placeholder:text-[#9AA5B5] focus:border-[#5D87FF] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-0 disabled:opacity-60';
const MOTIF_HINT_CLASSES = 'mt-1 text-xs text-[#5A6A85]';

function confirmClass(variant: ConfirmVariant): string {
  return `${CONFIRM_BASE} ${
    variant === 'danger' ? CONFIRM_DANGER : CONFIRM_DEFAULT
  }`;
}

/**
 * Dialog de confirmation accessible.
 *
 * a11y :
 *   - `role="dialog"` + `aria-modal="true"`.
 *   - `aria-labelledby` -> titre ; `aria-describedby` -> description.
 *   - Touche Esc ferme le dialog.
 *   - Le focus est positionne sur le bouton "Confirmer" a l'ouverture
 *     (focus trap simple : on ne capture pas Tab, jugement design vs
 *     poids lib externe).
 *
 * Pas de portail React (pas de surface trop complexe a gerer) :
 * `position: fixed` + z-index suffisent pour l'overlay.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmVariant = 'default',
  onConfirm,
  isPending = false,
  motifConfig,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const motifId = useId();
  const motifHintId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [motif, setMotif] = useState('');

  useEffect(() => {
    if (!open) {
      setMotif('');
      return;
    }
    confirmRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) {
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, isPending, onOpenChange]);

  if (!open) {
    return null;
  }

  async function handleConfirm() {
    if (motifConfig) {
      const trimmed = motif.trim();
      await onConfirm(trimmed.length > 0 ? trimmed : undefined);
      return;
    }
    await onConfirm();
  }

  const motifMax = motifConfig?.maxLength ?? ENTITY_DISABLE_MOTIF_MAX;

  return (
    <div
      className={OVERLAY_CLASSES}
      onClick={() => {
        if (!isPending) {
          onOpenChange(false);
        }
      }}
      data-testid="confirm-dialog-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={DIALOG_CLASSES}
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog"
      >
        <h2 id={titleId} className={TITLE_CLASSES}>
          {title}
        </h2>
        {description ? (
          <p id={descId} className={DESCRIPTION_CLASSES}>
            {description}
          </p>
        ) : null}
        {motifConfig ? (
          <>
            <label htmlFor={motifId} className={MOTIF_LABEL_CLASSES}>
              {motifConfig.label}
            </label>
            <textarea
              id={motifId}
              className={MOTIF_TEXTAREA_CLASSES}
              value={motif}
              onChange={(event) => setMotif(event.target.value)}
              placeholder={motifConfig.placeholder}
              maxLength={motifMax}
              rows={3}
              disabled={isPending}
              aria-describedby={motifConfig.hint ? motifHintId : undefined}
              data-testid="disable-motif-input"
            />
            {motifConfig.hint ? (
              <p id={motifHintId} className={MOTIF_HINT_CLASSES}>
                {motifConfig.hint}
              </p>
            ) : null}
          </>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className={CANCEL_CLASSES}
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="confirm-cancel"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={confirmClass(confirmVariant)}
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending}
            data-testid="confirm-action"
          >
            {isPending ? 'En cours...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
