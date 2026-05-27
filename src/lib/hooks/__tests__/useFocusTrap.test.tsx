import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useFocusTrap } from '../useFocusTrap';

// React 19 : flag requis pour `act()` hors React Testing Library.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Composant de test minimal pour exercer le hook.
 *
 * Trois boutons focusables = boundary "premier" / "milieu" / "dernier"
 * pour valider le cycle Tab/Shift+Tab.
 */
function TestOverlay({
  isActive,
  onEscape,
}: {
  readonly isActive: boolean;
  readonly onEscape: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap({ containerRef: ref, onEscape, isActive });
  return (
    <div ref={ref} data-testid="overlay">
      <button type="button" data-testid="first">
        First
      </button>
      <button type="button" data-testid="middle">
        Middle
      </button>
      <button type="button" data-testid="last">
        Last
      </button>
    </div>
  );
}

interface MountedOverlay {
  readonly container: HTMLDivElement;
  readonly root: ReturnType<typeof createRoot>;
}

function mountOverlay(
  isActive: boolean,
  onEscape: () => void = vi.fn()
): MountedOverlay {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<TestOverlay isActive={isActive} onEscape={onEscape} />);
  });
  return { container, root };
}

function unmount({ container, root }: MountedOverlay): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe('[useFocusTrap]', () => {
  afterEach(() => {
    // Garantit que les tests ne polluent pas le scroll body si un cleanup
    // se passe mal (devrait jamais arriver, mais defense en profondeur).
    document.body.style.overflow = '';
  });

  it('should focus the first focusable element on mount when active', () => {
    const mounted = mountOverlay(true);
    const first = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="first"]'
    );
    expect(document.activeElement).toBe(first);
    unmount(mounted);
  });

  it('should NOT install listeners or scroll lock when inactive', () => {
    const onEscape = vi.fn();
    const previous = document.body.style.overflow;
    const mounted = mountOverlay(false, onEscape);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    expect(onEscape).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe(previous);

    unmount(mounted);
  });

  it('should call onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    const mounted = mountOverlay(true, onEscape);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });

    expect(onEscape).toHaveBeenCalledTimes(1);
    unmount(mounted);
  });

  it('should cycle Tab from last back to first', () => {
    const mounted = mountOverlay(true);
    const last = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="last"]'
    );
    const first = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="first"]'
    );
    last?.focus();
    expect(document.activeElement).toBe(last);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      );
    });

    expect(document.activeElement).toBe(first);
    unmount(mounted);
  });

  it('should cycle Shift+Tab from first back to last', () => {
    const mounted = mountOverlay(true);
    const first = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="first"]'
    );
    const last = mounted.container.querySelector<HTMLButtonElement>(
      '[data-testid="last"]'
    );
    first?.focus();
    expect(document.activeElement).toBe(first);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    expect(document.activeElement).toBe(last);
    unmount(mounted);
  });

  it('should lock body scroll while active and restore on cleanup', () => {
    document.body.style.overflow = 'auto';
    const mounted = mountOverlay(true);

    expect(document.body.style.overflow).toBe('hidden');

    unmount(mounted);

    expect(document.body.style.overflow).toBe('auto');
  });
});
