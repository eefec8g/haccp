import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PhotoListItem } from '@/types/photo';

// PhotoCard -> PhotoDeleteButton ('use client') importe
// `@/app/actions/photo` qui tire next-auth en chaine. On mock l'action
// pour decoupler l'unit test de la pile auth.
vi.mock('@/app/actions/photo', () => ({
  uploadPhotoAction: vi.fn(),
  deletePhotoAction: vi.fn(),
}));

import { PhotoCard } from '../PhotoCard';

/**
 * Tests PhotoCard (US-PHO-001).
 *
 * Verifie via SSR :
 *   - metadata visibles (auteur, date, taille),
 *   - alt text accessible avec auteur + date,
 *   - le bouton supprimer apparait si canDelete=true et seulement alors,
 *   - signedUrl injectee comme src.
 */

const ALERTE_ID = '22222222-2222-4222-8222-222222222222';

function buildPhoto(overrides: Partial<PhotoListItem> = {}): PhotoListItem {
  return {
    id: 'photo-1',
    alerteId: ALERTE_ID,
    mimeType: 'image/jpeg',
    sizeBytes: 512000,
    filename: 'congelateur.jpg',
    uploadedByName: 'Lea',
    uploadedByUserId: 'u1',
    createdAt: new Date('2026-05-27T08:30:00.000Z'),
    signedUrl: 'https://blob.example.com/photos/abc.jpg',
    ...overrides,
  };
}

describe('[Photos] PhotoCard', () => {
  it('should render the photo metadata (auteur, date, taille)', () => {
    const html = renderToStaticMarkup(
      <PhotoCard photo={buildPhoto()} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).toContain('data-testid="photo-card-photo-1"');
    expect(html).toContain('Lea');
    expect(html).toContain('27/05/2026');
    expect(html).toContain('500 KB');
  });

  it('should set an accessible alt text with author and date', () => {
    const html = renderToStaticMarkup(
      <PhotoCard photo={buildPhoto()} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).toContain(
      'alt="Photo justificative ajoutee par Lea le 27/05/2026"'
    );
    expect(html).toContain(
      'aria-label="Photo justificative ajoutee par Lea le 27/05/2026"'
    );
  });

  it('should set the signedUrl as image src', () => {
    const html = renderToStaticMarkup(
      <PhotoCard
        photo={buildPhoto({ signedUrl: 'https://cdn.test/foo.jpg' })}
        canDelete={false}
        alerteId={ALERTE_ID}
      />
    );
    expect(html).toContain('src="https://cdn.test/foo.jpg"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('should render the delete button when canDelete is true', () => {
    const html = renderToStaticMarkup(
      <PhotoCard photo={buildPhoto()} canDelete={true} alerteId={ALERTE_ID} />
    );
    expect(html).toContain('data-testid="photo-delete-photo-1"');
    expect(html).toContain(`name="alerteId" value="${ALERTE_ID}"`);
    expect(html).toContain('name="photoId" value="photo-1"');
  });

  it('should not render the delete button when canDelete is false', () => {
    const html = renderToStaticMarkup(
      <PhotoCard photo={buildPhoto()} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).not.toContain('data-testid="photo-delete-photo-1"');
  });
});
