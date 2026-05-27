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
  'fixed inset-0 z-50 flex items-center justify-center bg-mg-noir/60 backdrop-blur-sm';
const DIALOG_CLASSES =
  'w-full max-w-md max-h-[90vh] overflow-y-auto border border-mg-noir/10 bg-mg-ivoire p-8';
const TITLE_CLASSES =
  'text-lg font-light uppercase tracking-[0.2em] text-mg-noir';
const DIVIDER_CLASSES = 'mt-3 inline-block h-px w-10 bg-mg-or';
const DESCRIPTION_CLASSES = 'mt-4 text-sm font-light text-mg-noir/70';
const DANGER_HINT_CLASSES =
  'mt-4 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-or';
const CANCEL_CLASSES =
  'inline-flex min-h-touch items-center justify-center border border-mg-noir/30 bg-transparent px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.25em] text-mg-noir transition-colors hover:border-mg-noir hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';
const CONFIRM_BASE =
  'inline-flex min-h-touch items-center justify-center bg-mg-noir px-6 py-2.5 text-[11px] font-medium uppercase tracking-[0.25em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire disabled:cursor-not-allowed disabled:opacity-50';
const MOTIF_LABEL_CLASSES =
  'mt-6 block text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70';
const MOTIF_TEXTAREA_CLASSES =
  'mt-2 block w-full border border-mg-noir/15 bg-mg-ivoire px-3 py-2 text-sm font-light text-mg-noir placeholder:text-mg-noir/30 focus:border-mg-or focus:outline-none focus:ring-1 focus:ring-mg-or disabled:opacity-50';
const MOTIF_HINT_CLASSES = 'mt-1 text-xs font-light italic text-mg-noir/50';

/**
 * Dialog de confirmation accessible.
 *
 * Charte Maison Givre : backdrop noir flou, dialog ivoire sans ombre
 * lourde avec liseret subtil, titre capitales espacees + divider or,
 * boutons sobres (noir vers or au hover, l'or sert d'accent universel).
 * Pour les actions destructives, un avertissement or s'affiche
 * au-dessus des boutons plutot qu'un rouge classique.
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
  const isDanger = confirmVariant === 'danger';

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
        <span aria-hidden="true" className={DIVIDER_CLASSES} />
        {description ? (
          <p id={descId} className={DESCRIPTION_CLASSES}>
            {description}
          </p>
        ) : null}
        {isDanger ? (
          <p
            className={DANGER_HINT_CLASSES}
            data-testid="confirm-dialog-danger"
          >
            Action sensible &mdash; verifier avant de confirmer.
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
        <div className="mt-8 flex justify-end gap-3">
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
            className={CONFIRM_BASE}
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
