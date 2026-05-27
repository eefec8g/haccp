'use server';

import { revalidatePath } from 'next/cache';
import {
  deletePhotoFromAlerte,
  uploadPhotoToAlerte,
} from '@/lib/services/photo.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { readRequiredString } from '@/lib/utils/form-data';
import { ensureRoleOrError } from '@/lib/utils/server-action-guards';
import { logger } from '@/lib/logger';
import { photoDeleteSchema, photoUploadSchema } from '@/lib/validations/photo';
import type { PhotoError } from '@/types/photo';
import type {
  PhotoDeleteActionErrorCode,
  PhotoDeleteActionState,
  PhotoUploadActionErrorCode,
  PhotoUploadActionState,
} from './photo.types';

/**
 * Server Actions Photo (US-PHO-001).
 *
 * Pipeline upload :
 *   1. Auth + role guard (RESPONSABLE/ADMIN). Aligne avec le guard
 *      `canManageAlertes` qui protege `/alertes/[id]` (US-PHO-001 - sec
 *      finding H-3 : eviter une surface d'attaque dead-code). L'ouverture
 *      au SALARIE sera traitee dans une US separee (flow saisie releve).
 *   2. Rate-limit PHOTO_UPLOAD par user.id (20 / 1h).
 *   3. Lecture FormData : alerteId (string) + file (File obligatoire).
 *   4. Validation Zod sur alerteId + narrowing `file instanceof File`.
 *   5. Delegation au service `uploadPhotoToAlerte`.
 *   6. revalidatePath('/alertes/[id]') sur succes (UI Server Component
 *      doit refleter la nouvelle galerie). On garde un path dynamique
 *      basique : la page detail s'affichera apres la prochaine
 *      navigation/refresh.
 *
 * Pipeline delete :
 *   1. Auth + role guard (RESPONSABLE/ADMIN).
 *   2. Lecture FormData : photoId + alerteId.
 *   3. Validation Zod.
 *   4. Service `deletePhotoFromAlerte`.
 *   5. revalidatePath('/alertes/[id]').
 */

function buildAlertePath(alerteId: string): string {
  return `/alertes/${alerteId}`;
}

const UPLOAD_FORBIDDEN_STATE: PhotoUploadActionState = {
  status: 'error',
  code: 'FORBIDDEN',
};

const DELETE_FORBIDDEN_STATE: PhotoDeleteActionState = {
  status: 'error',
  code: 'FORBIDDEN',
};

const UPLOAD_ERROR_MAP: Readonly<
  Record<PhotoError, PhotoUploadActionErrorCode>
> = {
  FORBIDDEN: 'FORBIDDEN',
  ALERTE_NOT_FOUND: 'ALERTE_NOT_FOUND',
  INVALID_MIME: 'INVALID_MIME',
  TOO_LARGE: 'TOO_LARGE',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  STORAGE_FAILURE: 'STORAGE_FAILURE',
  INTERNAL: 'INTERNAL',
};

const DELETE_ERROR_MAP: Readonly<
  Record<PhotoError, PhotoDeleteActionErrorCode>
> = {
  FORBIDDEN: 'FORBIDDEN',
  ALERTE_NOT_FOUND: 'ALERTE_NOT_FOUND',
  INVALID_MIME: 'INTERNAL',
  TOO_LARGE: 'INTERNAL',
  QUOTA_EXCEEDED: 'INTERNAL',
  STORAGE_FAILURE: 'INTERNAL',
  INTERNAL: 'INTERNAL',
};

function mapUploadServiceError(error: PhotoError): PhotoUploadActionErrorCode {
  return UPLOAD_ERROR_MAP[error];
}

function mapDeleteServiceError(error: PhotoError): PhotoDeleteActionErrorCode {
  return DELETE_ERROR_MAP[error];
}

function readFormFile(formData: FormData, key: string): File | null {
  const raw = formData.get(key);
  if (raw instanceof File && raw.size > 0) {
    return raw;
  }
  return null;
}

export async function uploadPhotoAction(
  _prev: PhotoUploadActionState,
  formData: FormData
): Promise<PhotoUploadActionState> {
  const guard = await ensureRoleOrError({
    allowedRoles: ['RESPONSABLE', 'ADMIN'],
    forbiddenState: UPLOAD_FORBIDDEN_STATE,
  });
  if (!guard.ok) {
    return guard.state;
  }

  const rate = await checkRateLimit(
    'PHOTO_UPLOAD',
    `user:${guard.session.user.id}`
  );
  if (!rate.allowed) {
    return {
      status: 'error',
      code: 'RATE_LIMITED',
      retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
    };
  }

  const parsed = photoUploadSchema.safeParse({
    alerteId: readRequiredString(formData, 'alerteId'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const file = readFormFile(formData, 'file');
  if (!file) {
    return {
      status: 'error',
      code: 'INVALID_FILE',
      fieldErrors: { file: ['Fichier requis'] },
    };
  }

  const result = await uploadPhotoToAlerte({
    viewer: {
      id: guard.session.user.id,
      role: guard.session.user.role,
    },
    alerteId: parsed.data.alerteId,
    file,
  });

  if (!result.success) {
    const code = mapUploadServiceError(result.error);
    if (code === 'INTERNAL' || code === 'STORAGE_FAILURE') {
      logger.error('[photo-upload] service error', {
        viewerId: guard.session.user.id,
        alerteId: parsed.data.alerteId,
        error: result.error,
      });
    }
    return { status: 'error', code };
  }

  revalidatePath(buildAlertePath(parsed.data.alerteId));
  return {
    status: 'success',
    photoId: result.data.id,
    signedUrl: result.data.signedUrl,
  };
}

export async function deletePhotoAction(
  _prev: PhotoDeleteActionState,
  formData: FormData
): Promise<PhotoDeleteActionState> {
  const guard = await ensureRoleOrError({
    allowedRoles: ['RESPONSABLE', 'ADMIN'],
    forbiddenState: DELETE_FORBIDDEN_STATE,
  });
  if (!guard.ok) {
    return guard.state;
  }

  const parsed = photoDeleteSchema.safeParse({
    photoId: readRequiredString(formData, 'photoId'),
    alerteId: readRequiredString(formData, 'alerteId'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'VALIDATION',
    };
  }

  const result = await deletePhotoFromAlerte({
    viewer: {
      id: guard.session.user.id,
      role: guard.session.user.role,
    },
    photoId: parsed.data.photoId,
  });

  if (!result.success) {
    const code = mapDeleteServiceError(result.error);
    if (code === 'INTERNAL') {
      logger.error('[photo-delete] service error', {
        viewerId: guard.session.user.id,
        photoId: parsed.data.photoId,
        error: result.error,
      });
    }
    return { status: 'error', code };
  }

  revalidatePath(buildAlertePath(parsed.data.alerteId));
  return { status: 'success' };
}
