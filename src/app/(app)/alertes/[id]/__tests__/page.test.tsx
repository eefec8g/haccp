/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Tests page detail alerte (US-ALE-002 + US-PHO-001 integration).
 *
 * Verifie l'orchestration Server Component :
 *   - Garde auth : redirect /login si pas de session.
 *   - Lecture SALARIE : acces autorise a une alerte de sa boutique mais
 *     SANS formulaire de resolution ni upload de photos (lecture seule).
 *   - Scope : notFound si `getAlerteById` echoue (NOT_FOUND ou hors
 *     scope boutique - anti-enum).
 *   - Happy path RESPONSABLE : appel parallele `getAlerteById` +
 *     `listPhotosForAlerte`, rendu de PhotoGallery + PhotoUploadForm +
 *     ResolutionForm avec les bonnes props.
 *   - Fallback robuste : si `listPhotosForAlerte` echoue, photos = []
 *     (la page reste affichable pour la resolution).
 *   - Prop `canDelete` : reflete `canManageAlertes(viewer)`.
 */

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`__REDIRECT__:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('__NOT_FOUND__');
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  canManageAlertes: vi.fn(),
}));

vi.mock('@/lib/services/alerte.service', () => ({
  getAlerteById: vi.fn(),
}));

vi.mock('@/lib/services/photo.service', () => ({
  listPhotosForAlerte: vi.fn(),
}));

// ResolutionForm est un Client Component avec useActionState : on stub
// pour ne pas declencher la pile actions/auth en SSR.
vi.mock('@/components/features/alertes/ResolutionForm', () => ({
  ResolutionForm: ({ alerteId }: { readonly alerteId: string }) => (
    <div data-testid="resolution-form-stub" data-alerte-id={alerteId} />
  ),
}));

// PhotoUploadForm est aussi un Client Component avec useActionState.
// On stub pour capturer les props passees depuis la page.
vi.mock('@/components/features/photos/PhotoUploadForm', () => ({
  PhotoUploadForm: ({
    alerteId,
    currentCount,
    testId,
  }: {
    readonly alerteId: string;
    readonly currentCount: number;
    readonly testId?: string;
  }) => (
    <div
      data-testid={testId ?? 'photo-upload-form-stub'}
      data-alerte-id={alerteId}
      data-current-count={String(currentCount)}
    />
  ),
}));

// PhotoGallery est un Server Component ; on stub aussi pour assertion
// sur les props (canDelete, photosCount, alerteId).
vi.mock('@/components/features/photos/PhotoGallery', () => ({
  PhotoGallery: ({
    photos,
    canDelete,
    alerteId,
    testId,
  }: {
    readonly photos: readonly { readonly id: string }[];
    readonly canDelete: boolean;
    readonly alerteId: string;
    readonly testId?: string;
  }) => (
    <div
      data-testid={testId ?? 'photo-gallery-stub'}
      data-can-delete={String(canDelete)}
      data-alerte-id={alerteId}
      data-photos-count={String(photos.length)}
    />
  ),
}));

import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import * as permissions from '@/lib/permissions';
import * as alerteService from '@/lib/services/alerte.service';
import * as photoService from '@/lib/services/photo.service';
import AlerteDetailPage from '../page';

const ALERTE_ID = '11111111-1111-4111-8111-111111111111';
const BOUTIQUE_ID = 'b1';

const RESPONSABLE_SESSION = {
  user: { id: 'r1', role: 'RESPONSABLE' as const, email: 'r1@mg.test' },
};
const SALARIE_SESSION = {
  user: { id: 's1', role: 'SALARIE' as const, email: 's1@mg.test' },
};

function buildAlerte() {
  return {
    id: ALERTE_ID,
    status: 'OUVERTE' as const,
    createdAt: new Date('2026-05-27T08:00:00.000Z'),
    releve: {
      id: 'releve-1',
      dateISO: '2026-05-27',
      creneau: 'MATIN' as const,
      temperature: -12.5,
      commentaire: null,
      equipementNom: 'Congelo 1',
      equipementType: 'CONGELATEUR' as const,
      boutiqueId: BOUTIQUE_ID,
      boutiqueNom: 'MG Paris 11',
      seuilMin: -25,
      seuilMax: -18,
    },
  };
}

function buildPhoto(id: string) {
  return {
    id,
    alerteId: ALERTE_ID,
    mimeType: 'image/jpeg' as const,
    sizeBytes: 250_000,
    filename: `${id}.jpg`,
    uploadedByName: 'Lea',
    uploadedByUserId: 'u1',
    createdAt: new Date('2026-05-27T09:00:00.000Z'),
    imageUrl: `https://blob.example.com/${id}.jpg`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('[AlerteDetailPage]', () => {
  it('should redirect to /login when no session', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(
      AlerteDetailPage({
        params: Promise.resolve({ id: ALERTE_ID }),
      })
    ).rejects.toThrow('__REDIRECT__:/login');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should render the alerte in read-only for a SALARIE (no resolution form, no upload)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(false);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: true,
      data: buildAlerte(),
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: true,
      data: [buildPhoto('p1')],
    } as any);

    const element = await AlerteDetailPage({
      params: Promise.resolve({ id: ALERTE_ID }),
    });
    const html = renderToStaticMarkup(element as any);

    // Le SALARIE voit le detail + la galerie en lecture seule...
    expect(html).toContain('data-testid="alerte-detail-page"');
    expect(html).toContain('data-testid="alerte-photo-gallery"');
    expect(html).toContain('data-can-delete="false"');
    // ...mais AUCUNE action de gestion (resolution ni upload).
    expect(html).not.toContain('data-testid="resolution-form-stub"');
    expect(html).not.toContain('data-testid="alerte-photo-upload"');
  });

  it('should call notFound for a SALARIE when the alerte is out of his scope (anti-enum)', async () => {
    vi.mocked(auth).mockResolvedValue(SALARIE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(false);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: false,
      error: 'ALERTE_NOT_FOUND',
    } as any);

    await expect(
      AlerteDetailPage({
        params: Promise.resolve({ id: ALERTE_ID }),
      })
    ).rejects.toThrow('__NOT_FOUND__');
    expect(notFound).toHaveBeenCalled();
  });

  it('should fetch the alerte and the photos in parallel and render the gallery + upload form', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: true,
      data: buildAlerte(),
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: true,
      data: [buildPhoto('p1'), buildPhoto('p2')],
    } as any);

    const element = await AlerteDetailPage({
      params: Promise.resolve({ id: ALERTE_ID }),
    });
    const html = renderToStaticMarkup(element as any);

    // Les deux services sont appeles avec le meme viewer + alerteId.
    expect(alerteService.getAlerteById).toHaveBeenCalledWith({
      viewer: { id: 'r1', role: 'RESPONSABLE' },
      alerteId: ALERTE_ID,
    });
    expect(photoService.listPhotosForAlerte).toHaveBeenCalledWith({
      viewer: { id: 'r1', role: 'RESPONSABLE' },
      alerteId: ALERTE_ID,
    });

    // Gallery + upload form rendus, avec les bonnes props.
    expect(html).toContain('data-testid="alerte-photo-gallery"');
    expect(html).toContain('data-photos-count="2"');
    expect(html).toContain('data-testid="alerte-photo-upload"');
    expect(html).toContain('data-current-count="2"');
    expect(html).toContain(`data-alerte-id="${ALERTE_ID}"`);
    // ResolutionForm reste rendu pour la resolution.
    expect(html).toContain('data-testid="resolution-form-stub"');
  });

  it('should fall back to an empty photos list when listPhotosForAlerte fails', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: true,
      data: buildAlerte(),
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: false,
      error: 'INTERNAL',
    } as any);

    const element = await AlerteDetailPage({
      params: Promise.resolve({ id: ALERTE_ID }),
    });
    const html = renderToStaticMarkup(element as any);

    // Fallback robuste : pas d'echec global, photos = [].
    expect(html).toContain('data-testid="alerte-photo-gallery"');
    expect(html).toContain('data-photos-count="0"');
    expect(html).toContain('data-current-count="0"');
  });

  it('should pass canDelete=true to PhotoGallery when canManageAlertes is true', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: true,
      data: buildAlerte(),
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: true,
      data: [],
    } as any);

    const element = await AlerteDetailPage({
      params: Promise.resolve({ id: ALERTE_ID }),
    });
    const html = renderToStaticMarkup(element as any);

    expect(html).toContain('data-can-delete="true"');
  });

  it('should call notFound when getAlerteById fails (NOT_FOUND or hors scope)', async () => {
    vi.mocked(auth).mockResolvedValue(RESPONSABLE_SESSION as any);
    vi.mocked(permissions.canManageAlertes).mockReturnValue(true);
    vi.mocked(alerteService.getAlerteById).mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
    } as any);
    vi.mocked(photoService.listPhotosForAlerte).mockResolvedValue({
      success: true,
      data: [],
    } as any);

    await expect(
      AlerteDetailPage({
        params: Promise.resolve({ id: ALERTE_ID }),
      })
    ).rejects.toThrow('__NOT_FOUND__');
  });
});
