'use client';

import { useActionState, useId } from 'react';
import { deletePhotoAction } from '@/app/actions/photo';
import {
  INITIAL_PHOTO_DELETE_STATE,
  type PhotoDeleteActionState,
} from '@/app/actions/photo.types';
import { resolvePhotoErrorMessage } from '@/lib/utils/photo-error-messages';
import { ERROR_BOX_CLASSES } from '@/components/features/ui/form-styles';

/**
 * Bouton de suppression d'une photo (US-PHO-001).
 *
 * - `'use client'` : encapsule `useActionState(deletePhotoAction, ...)`
 *   + un `confirm()` natif pour eviter la suppression accidentelle d'une
 *   piece justificative HACCP (decision : on prefere une UX sobre a un
 *   modal lourd pour ce MVP, le double-clic etant rare ici).
 * - Reserve aux RESPONSABLE/ADMIN : la prop `canDelete` est verifiee
 *   cote serveur dans `PhotoCard`. Cote action, `deletePhotoAction`
 *   re-applique le guard role (defense en profondeur).
 *
 * a11y :
 *   - `aria-busy` quand pending.
 *   - `role="alert"` + `aria-live="polite"` sur l'erreur.
 *   - `aria-describedby` lie l'erreur au bouton si visible.
 */

const CONFIRM_MESSAGE =
  'Supprimer cette photo justificative ? Cette action est definitive.';

const BUTTON_CLASSES =
  'inline-flex items-center justify-center border border-mg-noir/15 bg-mg-ivoire px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/70 transition-colors hover:border-mg-or hover:text-mg-or focus:outline-none focus:border-mg-or focus:text-mg-or disabled:cursor-not-allowed disabled:opacity-60';

function getDeleteErrorMessage(state: PhotoDeleteActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  return resolvePhotoErrorMessage(state.code);
}

export interface PhotoDeleteButtonProps {
  readonly photoId: string;
  readonly alerteId: string;
}

export function PhotoDeleteButton({
  photoId,
  alerteId,
}: PhotoDeleteButtonProps) {
  const [state, formAction, isPending] = useActionState(
    deletePhotoAction,
    INITIAL_PHOTO_DELETE_STATE
  );
  const errorId = useId();
  const error = getDeleteErrorMessage(state);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    if (typeof window === 'undefined') {
      return;
    }
    if (!window.confirm(CONFIRM_MESSAGE)) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col items-end gap-1"
      data-testid={`photo-delete-form-${photoId}`}
    >
      <input type="hidden" name="photoId" value={photoId} />
      <input type="hidden" name="alerteId" value={alerteId} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        aria-describedby={error ? errorId : undefined}
        className={BUTTON_CLASSES}
        data-testid={`photo-delete-${photoId}`}
      >
        {isPending ? 'Suppression...' : 'Supprimer'}
      </button>
      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={error ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid={`photo-delete-error-${photoId}`}
      >
        {error}
      </div>
    </form>
  );
}
