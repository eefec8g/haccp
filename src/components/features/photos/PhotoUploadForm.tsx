'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { uploadPhotoAction } from '@/app/actions/photo';
import {
  INITIAL_PHOTO_UPLOAD_STATE,
  type PhotoUploadActionState,
} from '@/app/actions/photo.types';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTOS_PER_ALERTE,
  PHOTO_CLIENT_QUALITY,
  PHOTO_CLIENT_RESIZE_MAX_PX,
} from '@/lib/constants/photo';
import { buildRateLimitMessage } from '@/lib/utils/rate-limit-message';
import { formatBytes } from '@/lib/utils/format-bytes';
import { resolvePhotoErrorMessage } from '@/lib/utils/photo-error-messages';
import { detectImageFormatError } from '@/lib/utils/photo-format';
import {
  ERROR_BOX_CLASSES,
  LABEL_CLASSES,
  SUBMIT_CLASSES,
} from '@/components/features/ui/form-styles';

/**
 * Formulaire d'upload d'une photo justificative (US-PHO-001).
 *
 * Pipeline cote client :
 *   1. L'utilisateur selectionne un fichier via `<input type="file">`
 *      (attribut `accept` whitelist HACCP).
 *   2. Le fichier est dessine dans un `<canvas>` redimensionne
 *      (cote le plus long <= `PHOTO_CLIENT_RESIZE_MAX_PX`) puis
 *      re-encode en JPEG (`PHOTO_CLIENT_QUALITY`). Le re-encode JPEG
 *      supprime nativement les metadonnees EXIF (geolocalisation,
 *      modele d'appareil, etc.).
 *   3. Preview data URL du Blob compresse + tailles avant/apres.
 *   4. Submit via `useActionState(uploadPhotoAction, ...)` : on injecte
 *      le Blob compresse dans un `FormData` (champ `file`) + l'alerteId.
 *
 * a11y :
 *   - `aria-busy` sur le bouton pendant la transition.
 *   - `aria-live="polite"` sur l'erreur globale ET le preview meta.
 *   - `aria-describedby` lie l'input a l'erreur quand presente.
 *
 * Compression Canvas API :
 *   - Pas de lib externe, pas de Web Worker (taille typique 1-2 MB OK
 *     sur le thread main, en environnement froid mobile pas critique).
 *   - Si `canvas.toBlob` echoue ou que le contexte 2D n'existe pas, on
 *     remonte une erreur claire dans l'UI (pas de fallback silencieux
 *     qui uploaderait le fichier brut avec EXIF).
 */

const ACCEPT_ATTR = ALLOWED_PHOTO_MIME_TYPES.join(',');

const COMPRESSION_FAILURE_MESSAGE =
  'Impossible de compresser cette image. Essayez un autre fichier.';
const DROPPED_FILE_MESSAGE = 'Aucun apercu disponible. Reessayez.';
const QUOTA_FULL_HINT = `Vous avez atteint la limite de ${MAX_PHOTOS_PER_ALERTE} photos pour cette alerte.`;

const CONTAINER_CLASSES =
  'flex flex-col gap-4 border border-mg-noir/10 bg-mg-ivoire/40 p-5';
const PREVIEW_WRAPPER_CLASSES =
  'flex flex-col gap-3 border border-dashed border-mg-noir/15 bg-mg-ivoire p-4 sm:flex-row sm:items-center';
const PREVIEW_IMG_CLASSES =
  'h-32 w-32 flex-shrink-0 object-cover border border-mg-noir/10';
const META_CLASSES =
  'text-[11px] font-light uppercase tracking-[0.2em] text-mg-noir/60';
const FILE_INPUT_CLASSES =
  'block w-full cursor-pointer border border-mg-noir/15 bg-mg-ivoire px-4 py-3 text-sm font-light text-mg-noir file:mr-4 file:border-0 file:bg-mg-noir file:px-4 file:py-2 file:text-[10px] file:font-medium file:uppercase file:tracking-[0.25em] file:text-mg-ivoire hover:file:bg-mg-or hover:file:text-mg-noir disabled:cursor-not-allowed disabled:bg-mg-noir/5';

interface ScaledSize {
  readonly width: number;
  readonly height: number;
}

function computeScaledSize(
  naturalWidth: number,
  naturalHeight: number,
  maxPx: number
): ScaledSize {
  const longest = Math.max(naturalWidth, naturalHeight);
  if (longest <= maxPx) {
    return { width: naturalWidth, height: naturalHeight };
  }
  const ratio = maxPx / longest;
  return {
    width: Math.round(naturalWidth * ratio),
    height: Math.round(naturalHeight * ratio),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failure'));
    };
    img.src = url;
  });
}

async function compressImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const { width, height } = computeScaledSize(
    img.naturalWidth,
    img.naturalHeight,
    PHOTO_CLIENT_RESIZE_MAX_PX
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('toBlob returned null')),
      'image/jpeg',
      PHOTO_CLIENT_QUALITY
    );
  });
}

function getCompressedFilename(original: string): string {
  const dot = original.lastIndexOf('.');
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base || 'photo'}.jpg`;
}

function getGlobalErrorMessage(state: PhotoUploadActionState): string | null {
  if (state.status !== 'error') {
    return null;
  }
  if (state.code === 'RATE_LIMITED') {
    return buildRateLimitMessage(state.retryAfterSeconds ?? 0);
  }
  return resolvePhotoErrorMessage(state.code);
}

interface CompressedFile {
  readonly blob: Blob;
  readonly previewUrl: string;
  readonly originalName: string;
  readonly originalSize: number;
  readonly compressedSize: number;
}

export interface PhotoUploadFormProps {
  readonly alerteId: string;
  readonly currentCount: number;
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function PhotoUploadForm({
  alerteId,
  currentCount,
  disabled,
  testId,
}: PhotoUploadFormProps) {
  const [state, formAction, isPending] = useActionState(
    uploadPhotoAction,
    INITIAL_PHOTO_UPLOAD_STATE
  );
  const [compressed, setCompressed] = useState<CompressedFile | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputId = useId();
  const errorId = useId();

  const quotaFull = currentCount >= MAX_PHOTOS_PER_ALERTE;
  const formDisabled = disabled || quotaFull;
  const globalError = clientError ?? getGlobalErrorMessage(state);
  const submitDisabled =
    formDisabled || isPending || isCompressing || compressed === null;

  useEffect(() => {
    if (state.status === 'success') {
      setCompressed((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return null;
      });
      setClientError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [state]);

  useEffect(
    () => () => {
      if (compressed) {
        URL.revokeObjectURL(compressed.previewUrl);
      }
    },
    [compressed]
  );

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setClientError(null);
    const formatError = detectImageFormatError(file);
    if (formatError) {
      setCompressed(null);
      setClientError(formatError);
      return;
    }
    setIsCompressing(true);
    try {
      const blob = await compressImage(file);
      const previewUrl = URL.createObjectURL(blob);
      setCompressed((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev.previewUrl);
        }
        return {
          blob,
          previewUrl,
          originalName: file.name,
          originalSize: file.size,
          compressedSize: blob.size,
        };
      });
    } catch {
      setCompressed(null);
      setClientError(COMPRESSION_FAILURE_MESSAGE);
    } finally {
      setIsCompressing(false);
    }
  }

  function handleSubmit(formData: FormData): void {
    if (!compressed) {
      setClientError(DROPPED_FILE_MESSAGE);
      return;
    }
    formData.set(
      'file',
      compressed.blob,
      getCompressedFilename(compressed.originalName)
    );
    formAction(formData);
  }

  return (
    <form
      action={handleSubmit}
      aria-label="Formulaire d'ajout de photo justificative"
      className={CONTAINER_CLASSES}
      data-testid={testId ?? 'photo-upload-form'}
      noValidate
    >
      <input type="hidden" name="alerteId" value={alerteId} />

      <div>
        <label htmlFor={inputId} className={LABEL_CLASSES}>
          Ajouter une photo justificative
        </label>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          name="fileSource"
          accept={ACCEPT_ATTR}
          className={FILE_INPUT_CLASSES}
          data-testid="photo-upload-input"
          disabled={formDisabled || isPending || isCompressing}
          aria-describedby={globalError ? errorId : undefined}
          onChange={handleFileChange}
        />
        {quotaFull ? (
          <p
            className={`${META_CLASSES} mt-2`}
            data-testid="photo-upload-quota"
          >
            {QUOTA_FULL_HINT}
          </p>
        ) : null}
      </div>

      {compressed ? (
        <figure
          className={PREVIEW_WRAPPER_CLASSES}
          data-testid="photo-upload-preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={compressed.previewUrl}
            alt="Apercu de la photo a uploader"
            className={PREVIEW_IMG_CLASSES}
          />
          <figcaption className={META_CLASSES} aria-live="polite">
            <span className="block">
              Original : {formatBytes(compressed.originalSize)}
            </span>
            <span className="block">
              Compresse : {formatBytes(compressed.compressedSize)} (JPEG{' '}
              {Math.round(PHOTO_CLIENT_QUALITY * 100)} %)
            </span>
          </figcaption>
        </figure>
      ) : null}

      <div
        id={errorId}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={globalError ? ERROR_BOX_CLASSES : 'sr-only'}
        data-testid="photo-upload-error"
      >
        {globalError}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitDisabled}
          aria-busy={isPending || isCompressing}
          className={SUBMIT_CLASSES}
          data-testid="photo-upload-submit"
        >
          {isPending
            ? 'Envoi...'
            : isCompressing
              ? 'Compression...'
              : 'Envoyer la photo'}
        </button>
      </div>
    </form>
  );
}
