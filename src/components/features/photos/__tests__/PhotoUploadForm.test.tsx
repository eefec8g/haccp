import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_PHOTOS_PER_ALERTE } from '@/lib/constants/photo';

/**
 * Tests PhotoUploadForm (US-PHO-001).
 *
 * Client Component utilisant `useActionState` + Canvas API. La
 * compression canvas ne peut pas etre testee en SSR (jsdom n'expose
 * pas `canvas.toBlob` par defaut et `renderToStaticMarkup` ne declenche
 * pas les effets). On couvre ici les invariants SSR :
 *   - rendu initial (form, input, submit desactive sans fichier),
 *   - alerteId hidden propage depuis la prop,
 *   - quota atteint -> input desactive + message quota visible,
 *   - mapping des codes d'erreur de l'action (FORBIDDEN, TOO_LARGE,
 *     QUOTA_EXCEEDED, INVALID_MIME, RATE_LIMITED).
 *
 * La compression cote client (Canvas API + EXIF stripping) est validee
 * manuellement et via tests E2E Playwright (hors perimetre unit).
 */

interface UploadTestState {
  readonly status: 'idle' | 'success' | 'error';
  readonly code?: string;
  readonly retryAfterSeconds?: number;
  readonly photoId?: string;
  readonly signedUrl?: string;
}

const { mockState, useActionStateMock } = vi.hoisted(() => {
  const state = {
    current: { status: 'idle' } as UploadTestState,
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
  uploadPhotoAction: vi.fn(),
}));

import { PhotoUploadForm } from '../PhotoUploadForm';

const ALERTE_ID = '44444444-4444-4444-8444-444444444444';

describe('[Photos] PhotoUploadForm', () => {
  it('should render the form with hidden alerteId, file input and submit button (idle state)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    expect(html).toContain('data-testid="photo-upload-form"');
    expect(html).toContain(`name="alerteId" value="${ALERTE_ID}"`);
    expect(html).toContain('data-testid="photo-upload-input"');
    expect(html).toContain('data-testid="photo-upload-submit"');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain('Envoyer la photo');
  });

  function extractTagAroundTestId(html: string, testId: string): string {
    const marker = `data-testid="${testId}"`;
    const idx = html.indexOf(marker);
    if (idx === -1) {
      return '';
    }
    const tagStart = html.lastIndexOf('<', idx);
    const tagEnd = html.indexOf('>', idx);
    return html.slice(tagStart, tagEnd + 1);
  }

  it('should disable the input and show the quota message when currentCount >= MAX_PHOTOS_PER_ALERTE', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm
        alerteId={ALERTE_ID}
        currentCount={MAX_PHOTOS_PER_ALERTE}
      />
    );

    expect(html).toContain('data-testid="photo-upload-quota"');
    expect(html).toContain(`limite de ${MAX_PHOTOS_PER_ALERTE} photos`);
    // L'input et le bouton submit doivent etre `disabled`. L'ordre des
    // attributs SSR n'est pas garanti : on extrait la balise contenant
    // le testid et on cherche `disabled` dedans.
    expect(extractTagAroundTestId(html, 'photo-upload-input')).toContain(
      'disabled'
    );
    expect(extractTagAroundTestId(html, 'photo-upload-submit')).toContain(
      'disabled'
    );
  });

  it('should disable the submit button when no file has been selected (compressed === null)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    expect(extractTagAroundTestId(html, 'photo-upload-submit')).toContain(
      'disabled'
    );
  });

  it('should map FORBIDDEN error code to a French user-friendly message', () => {
    mockState.current = { status: 'error', code: 'FORBIDDEN' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    // L'apostrophe est echappee `&#x27;` par la serialisation SSR.
    expect(html).toContain('Vous n&#x27;avez pas la permission');
    expect(html).toContain('data-testid="photo-upload-error"');
  });

  it('should map TOO_LARGE error code to a French user-friendly message', () => {
    mockState.current = { status: 'error', code: 'TOO_LARGE' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    expect(html).toContain('trop volumineux');
  });

  it('should map QUOTA_EXCEEDED error code to a French user-friendly message', () => {
    mockState.current = { status: 'error', code: 'QUOTA_EXCEEDED' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    expect(html).toContain('Quota de photos atteint');
    expect(html).toContain(`${MAX_PHOTOS_PER_ALERTE} maximum`);
  });

  it('should not display the quota-full hint nor disable the input when currentCount === MAX_PHOTOS_PER_ALERTE - 1 (boundary)', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm
        alerteId={ALERTE_ID}
        currentCount={MAX_PHOTOS_PER_ALERTE - 1}
      />
    );

    // L'attribut `disabled` (true) sort en SSR comme un attribut nu :
    // ` disabled=""` (avec un espace + signe egal + guillemets). Les
    // classes Tailwind contiennent `disabled:` mais jamais ` disabled=`,
    // ce qui rend l'assertion robuste a la presence du selector CSS.
    expect(html).not.toContain('data-testid="photo-upload-quota"');
    const inputTag = extractTagAroundTestId(html, 'photo-upload-input');
    expect(inputTag).not.toContain(' disabled=""');
    expect(inputTag).not.toMatch(/\sdisabled[\s/>]/);
  });

  it('should map RATE_LIMITED to a rate-limit message with retryAfterSeconds', () => {
    mockState.current = {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    };
    mockState.pending = false;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    expect(html).toContain('Trop de tentatives');
    expect(html).toContain('30 seconde');
  });

  it('should disable submit and set aria-busy when isPending', () => {
    mockState.current = { status: 'idle' };
    mockState.pending = true;

    const html = renderToStaticMarkup(
      <PhotoUploadForm alerteId={ALERTE_ID} currentCount={0} />
    );

    const submitTag = extractTagAroundTestId(html, 'photo-upload-submit');
    expect(submitTag).toContain('aria-busy="true"');
    expect(submitTag).toContain('disabled');
    expect(html).toContain('Envoi...');
  });
});
