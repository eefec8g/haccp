'use client';

import { useEffect, type RefObject } from 'react';

interface UseFocusTrapParams {
  /**
   * Ref vers le conteneur qui doit piéger le focus. Lorsque actif, Tab et
   * Shift+Tab restent dans ce conteneur.
   */
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Callback déclenché sur la touche Escape. Permet au parent de fermer
   * l'overlay sans dupliquer la logique clavier.
   */
  readonly onEscape: () => void;
  /**
   * Permet de désactiver le piège (overlay fermé) sans démonter le hook.
   * Quand `false`, aucun listener n'est posé.
   */
  readonly isActive: boolean;
}

/**
 * Sélecteur des éléments natifs focusables dans un overlay.
 *
 * Volontairement restrictif (pas de `[contenteditable]`, pas d'iframe) :
 * les dialogs métier HACCP ne contiennent que des liens, boutons, inputs.
 * Limiter le scope réduit les surprises (focus sur des éléments non
 * interactifs) et le coût de querySelector.
 */
const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

function getFocusableElements(
  container: HTMLElement | null
): readonly HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  );
}

/**
 * Hook reutilisable pour overlays modaux (drawer mobile, sidebar admin).
 *
 * Centralise trois comportements WCAG 2.1 AA :
 *   - Focus trap : Tab/Shift+Tab cycle entre le premier et le dernier
 *     element focusable du conteneur. Empeche le focus de sortir vers les
 *     elements derriere l'overlay.
 *   - Escape : appelle `onEscape` pour fermer l'overlay sans dupliquer
 *     la logique clavier dans chaque consommateur.
 *   - Focus initial : pose le focus sur le premier element focusable au
 *     montage (quand `isActive` passe a true). Garantit un point d'entree
 *     clavier coherent.
 *   - Scroll lock : verrouille le scroll du body tant que l'overlay est
 *     actif. Restore la valeur precedente au cleanup.
 *
 * Hors perimetre : focus restore au close. Cette responsabilite reste au
 * parent (qui connait le bouton declencheur via une ref dediee). Le hook
 * se concentre sur ce qui se passe PENDANT l'ouverture.
 *
 * @example
 * const containerRef = useRef<HTMLDivElement | null>(null);
 * useFocusTrap({ containerRef, onEscape: onClose, isActive: isOpen });
 */
export function useFocusTrap({
  containerRef,
  onEscape,
  isActive,
}: UseFocusTrapParams): void {
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    const initialTarget = getFocusableElements(container)[0];
    if (initialTarget) {
      initialTarget.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [containerRef, onEscape, isActive]);
}
