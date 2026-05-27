import type { PhotoListItem } from '@/types/photo';
import { PhotoCard } from './PhotoCard';

/**
 * Galerie des photos justificatives d'une alerte (US-PHO-001).
 *
 * Server Component : rend une grille responsive de `PhotoCard`. Empty
 * state explicite (role="status") si aucune photo, pour que le SALARIE
 * sache qu'il faut joindre une piece justificative et que le contrast
 * HACCP audit soit immediat.
 *
 * Structure :
 *   - Section title avec eyebrow + compteur (X / MAX) pour donner le
 *     contexte de quota au lecteur.
 *   - Grille `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` : 2 vignettes
 *     par ligne en mobile (cards aspect-square restent lisibles) pour
 *     reduire le scroll quand l'alerte comporte plusieurs photos.
 *
 * a11y :
 *   - <section aria-labelledby> pour la semantique.
 *   - Empty state role="status" + aria-live polite.
 */

const SECTION_CLASSES = 'flex flex-col gap-4';
const HEADER_ROW_CLASSES =
  'flex flex-wrap items-baseline justify-between gap-2';
const EYEBROW_CLASSES =
  'text-[10px] font-light uppercase tracking-[0.3em] text-mg-or';
const TITLE_CLASSES =
  'mt-1 text-lg font-light uppercase tracking-[0.2em] text-mg-noir';
const COUNT_CLASSES =
  'text-[10px] font-medium uppercase tracking-[0.25em] text-mg-noir/60';
const GRID_CLASSES = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4';
const EMPTY_CLASSES =
  'border border-dashed border-mg-noir/15 bg-mg-ivoire/40 px-5 py-8 text-center text-sm font-light text-mg-noir/60';

const SECTION_TITLE = 'Photos justificatives';
const SECTION_EYEBROW = 'Maison Givre - Audit HACCP';
const EMPTY_MESSAGE = 'Aucune photo justificative.';

export interface PhotoGalleryProps {
  readonly photos: readonly PhotoListItem[];
  readonly canDelete: boolean;
  readonly alerteId: string;
  readonly testId?: string;
}

export function PhotoGallery({
  photos,
  canDelete,
  alerteId,
  testId,
}: PhotoGalleryProps) {
  const titleId = `photo-gallery-title-${alerteId}`;
  const sectionTestId = testId ?? 'photo-gallery';

  return (
    <section
      aria-labelledby={titleId}
      className={SECTION_CLASSES}
      data-testid={sectionTestId}
    >
      <div className={HEADER_ROW_CLASSES}>
        <div>
          <p className={EYEBROW_CLASSES}>{SECTION_EYEBROW}</p>
          <h2 id={titleId} className={TITLE_CLASSES}>
            {SECTION_TITLE}
          </h2>
        </div>
        <span
          className={COUNT_CLASSES}
          data-testid={`${sectionTestId}-count`}
          aria-label={`${photos.length} photo${photos.length > 1 ? 's' : ''}`}
        >
          {photos.length} photo{photos.length > 1 ? 's' : ''}
        </span>
      </div>

      {photos.length === 0 ? (
        <p
          className={EMPTY_CLASSES}
          role="status"
          aria-live="polite"
          data-testid={`${sectionTestId}-empty`}
        >
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className={GRID_CLASSES} data-testid={`${sectionTestId}-grid`}>
          {photos.map((photo) => (
            <li key={photo.id}>
              <PhotoCard
                photo={photo}
                canDelete={canDelete}
                alerteId={alerteId}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
