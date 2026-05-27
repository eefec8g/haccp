import type { PhotoListItem } from '@/types/photo';
import { formatDateShort } from '@/lib/utils/dates';
import { formatBytes } from '@/lib/utils/format-bytes';
import { PhotoDeleteButton } from './PhotoDeleteButton';

/**
 * Carte d'affichage d'une photo justificative (US-PHO-001).
 *
 * Server Component pur (aucune interactivite hors PhotoDeleteButton
 * inclus conditionnellement). On utilise un `<img>` plat plutot que
 * `next/image` car les URLs Vercel Blob ne sont pas listees dans la
 * config `images.remotePatterns` du projet et nous voulons garder
 * `imageUrl` opaque (pre-cabling pour migration future vers
 * `access: 'private'`).
 *
 * Affichage :
 *   - <figure> avec `<img loading="lazy" decoding="async">` (eviter de
 *     bloquer le rendu de la galerie).
 *   - <figcaption> : nom uploader + date short + taille KB.
 *   - Si `canDelete` (RESPONSABLE/ADMIN), bouton `<PhotoDeleteButton>`.
 *
 * a11y :
 *   - alt explicite : "Photo justificative ajoutee par <X> le <date>".
 *   - aria-label sur la figure.
 */

function toISO(value: Date): string {
  const iso = value.toISOString();
  // Date.toISOString() retourne YYYY-MM-DDTHH:mm:ss.sssZ
  // On garde la partie date pour formatDateShort (qui attend YYYY-MM-DD).
  return iso.slice(0, 10);
}

const FIGURE_CLASSES =
  'flex flex-col gap-3 border border-mg-noir/10 bg-mg-ivoire p-3';
const IMAGE_CLASSES =
  'aspect-square w-full object-cover border border-mg-noir/5 bg-mg-noir/5';
const CAPTION_CLASSES =
  'flex flex-col gap-1 text-[10px] font-light uppercase tracking-[0.2em] text-mg-noir/60';
const META_VALUE_CLASSES = 'font-medium normal-case text-mg-noir/80';

export interface PhotoCardProps {
  readonly photo: PhotoListItem;
  readonly canDelete: boolean;
  readonly alerteId: string;
}

export function PhotoCard({ photo, canDelete, alerteId }: PhotoCardProps) {
  const dateISO = toISO(photo.createdAt);
  const dateShort = formatDateShort(dateISO);
  const altText = `Photo justificative ajoutee par ${photo.uploadedByName} le ${dateShort}`;

  return (
    <figure
      className={FIGURE_CLASSES}
      aria-label={altText}
      data-testid={`photo-card-${photo.id}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt={altText}
        loading="lazy"
        decoding="async"
        className={IMAGE_CLASSES}
      />
      <figcaption className={CAPTION_CLASSES}>
        <span>
          Auteur :{' '}
          <span className={META_VALUE_CLASSES}>{photo.uploadedByName}</span>
        </span>
        <span>
          Date :{' '}
          <time dateTime={dateISO} className={META_VALUE_CLASSES}>
            {dateShort}
          </time>
        </span>
        <span>
          Taille :{' '}
          <span className={META_VALUE_CLASSES}>
            {formatBytes(photo.sizeBytes)}
          </span>
        </span>
      </figcaption>
      {canDelete ? (
        <PhotoDeleteButton photoId={photo.id} alerteId={alerteId} />
      ) : null}
    </figure>
  );
}
