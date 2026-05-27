import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// React 19 : `act()` requiert ce flag pour ne pas warner en dehors de
// React Testing Library. On l'active globalement pour ce fichier qui
// monte le composant via createRoot (test confirm-cancel).
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Tests PhotoDeleteButton (US-PHO-001).
 *
 * Client Component pour `useActionState(deletePhotoAction, ...)`.
 * On rend en SSR (renderToStaticMarkup) pour la majorite des cas ; pour
 * la branche `handleSubmit` (confirm() natif), on monte le composant
 * dans un DOM jsdom reel via `createRoot` + dispatch d'un evenement
 * submit natif.
 */

interface DeleteTestState {
  readonly status: 'idle' | 'success' | 'error';
  readonly code?: string;
}

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as DeleteTestState,
    pending: false,
  };
  return {
    mockState: state,
    useActionStateMock: vi.fn(() => [state.current, vi.fn(), state.pending]),
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock('@/app/actions/photo', () => ({
  deletePhotoAction: vi.fn(),
}));

import { PhotoDeleteButton } from '../PhotoDeleteButton';

const PHOTO_ID = 'photo-42';
const ALERTE_ID = '33333333-3333-4333-8333-333333333333';

describe('[Photos] PhotoDeleteButton', () => {
  it('should render the form with hidden inputs and an active delete button (idle state)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
    );

    expect(html).toContain(`data-testid="photo-delete-form-${PHOTO_ID}"`);
    expect(html).toContain(`name="photoId" value="${PHOTO_ID}"`);
    expect(html).toContain(`name="alerteId" value="${ALERTE_ID}"`);
    expect(html).toContain(`data-testid="photo-delete-${PHOTO_ID}"`);
    expect(html).toContain('Supprimer');
    expect(html).toContain('aria-busy="false"');
  });

  it('should set aria-busy and disabled when pending', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = true;

    const html = renderToStaticMarkup(
      <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
    expect(html).toContain('Suppression...');
  });

  it('should display an error message when state is FORBIDDEN', () => {
    mockState.current = { status: 'error', code: 'FORBIDDEN' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
    );

    // L'apostrophe est echappee `&#x27;` par la serialisation SSR.
    expect(html).toContain('Vous n&#x27;avez pas la permission');
    expect(html).toContain(`data-testid="photo-delete-error-${PHOTO_ID}"`);
  });

  it('should display a generic error when state is INTERNAL', () => {
    mockState.current = { status: 'error', code: 'INTERNAL' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
    );

    expect(html).toContain('Une erreur interne est survenue');
  });

  it('should call event.preventDefault() when the user cancels the confirm dialog (no submit)', async () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    // Monte le composant dans un DOM jsdom reel pour pouvoir dispatcher
    // un evenement `submit` natif et exercer le handler `onSubmit`.
    // `confirm()` est mocke a `false` -> on attend `event.preventDefault()`
    // (l'evenement ne se propage pas / pas de submit).
    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => false);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
        );
      });

      const form = container.querySelector('form');
      expect(form).not.toBeNull();

      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        form?.dispatchEvent(submitEvent);
      });

      expect(confirmSpy).toHaveBeenCalledOnce();
      // preventDefault() a ete appele -> defaultPrevented == true.
      expect(submitEvent.defaultPrevented).toBe(true);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      confirmSpy.mockRestore();
    }
  });

  it('should call window.confirm with the deletion warning message before submitting', async () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    // Symetrique du test "cancel" : ici confirm() retourne true, on
    // verifie au moins que le prompt est affiche avec le bon libelle
    // (l'utilisateur est prevenu du caractere definitif de la suppression).
    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');

    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => true);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <PhotoDeleteButton photoId={PHOTO_ID} alerteId={ALERTE_ID} />
        );
      });

      const form = container.querySelector('form');
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        form?.dispatchEvent(submitEvent);
      });

      expect(confirmSpy).toHaveBeenCalledOnce();
      const [message] = confirmSpy.mock.calls[0] ?? [];
      expect(message).toMatch(/Supprimer cette photo/);
      expect(message).toMatch(/definitive/);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      confirmSpy.mockRestore();
    }
  });
});
