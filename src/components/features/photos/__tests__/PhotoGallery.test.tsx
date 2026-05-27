import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PhotoListItem } from '@/types/photo';

// PhotoGallery -> PhotoCard -> PhotoDeleteButton ('use client') importe
// `@/app/actions/photo` qui tire next-auth en chaine. On mock l'action
// pour decoupler l'unit test de la pile auth.
vi.mock('@/app/actions/photo', () => ({
  uploadPhotoAction: vi.fn(),
  deletePhotoAction: vi.fn(),
}));

import { PhotoGallery } from '../PhotoGallery';

/**
 * Tests PhotoGallery (US-PHO-001).
 *
 * Server Component pur (pas de hooks). On verifie via SSR :
 *   - empty state quand `photos.length === 0`,
 *   - rendu de N cartes,
 *   - propagation de `canDelete` (presence du bouton delete),
 *   - propagation du `testId` custom.
 */

const ALERTE_ID = '11111111-1111-4111-8111-111111111111';

function buildPhoto(overrides: Partial<PhotoListItem> = {}): PhotoListItem {
  return {
    id: 'p1',
    alerteId: ALERTE_ID,
    mimeType: 'image/jpeg',
    sizeBytes: 256000,
    filename: 'photo.jpg',
    uploadedByName: 'Lea',
    uploadedByUserId: 'u1',
    createdAt: new Date('2026-05-27T08:30:00.000Z'),
    imageUrl: 'https://blob.example.com/photos/abc.jpg',
    ...overrides,
  };
}

describe('[Photos] PhotoGallery', () => {
  it('should render the empty state when no photos are provided', () => {
    const html = renderToStaticMarkup(
      <PhotoGallery photos={[]} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).toContain('data-testid="photo-gallery"');
    expect(html).toContain('data-testid="photo-gallery-empty"');
    expect(html).toContain('Aucune photo justificative.');
    expect(html).toContain('role="status"');
    expect(html).toContain('0 photo');
  });

  it('should render a card for each provided photo', () => {
    const photos: readonly PhotoListItem[] = [
      buildPhoto({ id: 'p1' }),
      buildPhoto({ id: 'p2', uploadedByName: 'Lucas' }),
      buildPhoto({ id: 'p3', uploadedByName: 'Sophie' }),
    ];
    const html = renderToStaticMarkup(
      <PhotoGallery photos={photos} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).toContain('data-testid="photo-gallery-grid"');
    expect(html).toContain('data-testid="photo-card-p1"');
    expect(html).toContain('data-testid="photo-card-p2"');
    expect(html).toContain('data-testid="photo-card-p3"');
    expect(html).toContain('Lea');
    expect(html).toContain('Lucas');
    expect(html).toContain('Sophie');
    expect(html).toContain('3 photos');
  });

  it('should render a delete button on each card when canDelete is true', () => {
    const photos: readonly PhotoListItem[] = [
      buildPhoto({ id: 'p1' }),
      buildPhoto({ id: 'p2' }),
    ];
    const html = renderToStaticMarkup(
      <PhotoGallery photos={photos} canDelete={true} alerteId={ALERTE_ID} />
    );
    expect(html).toContain('data-testid="photo-delete-p1"');
    expect(html).toContain('data-testid="photo-delete-p2"');
  });

  it('should hide delete buttons when canDelete is false', () => {
    const photos: readonly PhotoListItem[] = [buildPhoto({ id: 'p1' })];
    const html = renderToStaticMarkup(
      <PhotoGallery photos={photos} canDelete={false} alerteId={ALERTE_ID} />
    );
    expect(html).not.toContain('data-testid="photo-delete-p1"');
  });

  it('should honor a custom testId prop', () => {
    const html = renderToStaticMarkup(
      <PhotoGallery
        photos={[]}
        canDelete={false}
        alerteId={ALERTE_ID}
        testId="my-gallery"
      />
    );
    expect(html).toContain('data-testid="my-gallery"');
    expect(html).toContain('data-testid="my-gallery-empty"');
  });
});
