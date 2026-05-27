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
import type { SessionUser } from '@/lib/permissions';
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

const UPLOAD_ALLOWED_ROLES = ['RESPONSABLE', 'ADMIN'] as const;

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
  // PHOTO_NOT_FOUND ne devrait pas remonter de l'upload (jamais charge
  // par id) ; defensif vers INTERNAL pour ne pas leaker l'enum.
  PHOTO_NOT_FOUND: 'INTERNAL',
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
  // PHOTO_NOT_FOUND -> meme surface que ALERTE_NOT_FOUND (anti-enum :
  // l'UI ne doit pas distinguer photo absente vs hors scope).
  PHOTO_NOT_FOUND: 'ALERTE_NOT_FOUND',
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

interface UploadFormPayload {
  readonly alerteId: string;
  readonly file: File;
}

/**
 * Discriminated union dediee aux pipelines internes de cette action :
 * `Result<T, E>` global contraint `E extends string`, ce qui n'est pas
 * compatible avec un payload d'erreur structure (`PhotoUploadActionState`).
 */
type ActionStep<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: PhotoUploadActionState };

/**
 * Narrowing FormData + Zod en un seul endroit. Retourne un step typed
 * pour que `uploadPhotoAction` puisse rester un pipeline lineaire.
 */
function readUploadFormData(formData: FormData): ActionStep<UploadFormPayload> {
  const parsed = photoUploadSchema.safeParse({
    alerteId: readRequiredString(formData, 'alerteId'),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: {
        status: 'error',
        code: 'VALIDATION',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }
  const file = readFormFile(formData, 'file');
  if (!file) {
    return {
      success: false,
      error: {
        status: 'error',
        code: 'INVALID_FILE',
        fieldErrors: { file: ['Fichier requis'] },
      },
    };
  }
  return { success: true, data: { alerteId: parsed.data.alerteId, file } };
}

function toViewer(user: {
  readonly id: string;
  readonly role: SessionUser['role'];
}): SessionUser {
  return { id: user.id, role: user.role };
}

/**
 * Verifie le rate-limit `PHOTO_UPLOAD` (20 / 1h par user). Retourne un
 * state RATE_LIMITED si bloque, `null` sinon (passe).
 */
async function checkUploadRateLimit(
  viewerId: string
): Promise<PhotoUploadActionState | null> {
  const rate = await checkRateLimit('PHOTO_UPLOAD', `user:${viewerId}`);
  if (rate.allowed) {
    return null;
  }
  return {
    status: 'error',
    code: 'RATE_LIMITED',
    retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
  };
}

/**
 * Auth + role + rate-limit guard fusionnes en une seule etape.
 * Permet a `uploadPhotoAction` de rester un pipeline lineaire <20 lignes.
 */
async function authorizeUploader(): Promise<ActionStep<SessionUser>> {
  const guard = await ensureRoleOrError({
    allowedRoles: UPLOAD_ALLOWED_ROLES,
    forbiddenState: UPLOAD_FORBIDDEN_STATE,
  });
  if (!guard.ok) {
    return { success: false, error: guard.state };
  }
  const viewer = toViewer(guard.session.user);
  const limited = await checkUploadRateLimit(viewer.id);
  if (limited) {
    return { success: false, error: limited };
  }
  return { success: true, data: viewer };
}

interface UploadPipelineArgs {
  readonly viewer: SessionUser;
  readonly payload: UploadFormPayload;
}

/**
 * Orchestration service upload + mapping du Result en action state.
 * Centralise le logging d'erreurs serveur pour ne pas polluer le
 * pipeline principal.
 */
async function runUploadPipeline({
  viewer,
  payload,
}: UploadPipelineArgs): Promise<PhotoUploadActionState> {
  const result = await uploadPhotoToAlerte({
    viewer,
    alerteId: payload.alerteId,
    file: payload.file,
  });
  if (!result.success) {
    const code = mapUploadServiceError(result.error);
    if (code === 'INTERNAL' || code === 'STORAGE_FAILURE') {
      logger.error('[photo-upload] service error', {
        viewerId: viewer.id,
        alerteId: payload.alerteId,
        error: result.error,
      });
    }
    return { status: 'error', code };
  }
  return {
    status: 'success',
    photoId: result.data.id,
    imageUrl: result.data.imageUrl,
  };
}

/**
 * Execute le pipeline upload puis revalide la page detail alerte si
 * la persistance reussit. Isole le revalidatePath conditionnel pour
 * garder `uploadPhotoAction` sous 20 lignes (Clean Code #3).
 */
async function executeUploadAndRevalidate(
  args: UploadPipelineArgs
): Promise<PhotoUploadActionState> {
  const state = await runUploadPipeline(args);
  if (state.status === 'success') {
    revalidatePath(buildAlertePath(args.payload.alerteId));
  }
  return state;
}

export async function uploadPhotoAction(
  _prev: PhotoUploadActionState,
  formData: FormData
): Promise<PhotoUploadActionState> {
  const auth = await authorizeUploader();
  if (!auth.success) {
    return auth.error;
  }
  const payload = readUploadFormData(formData);
  if (!payload.success) {
    return payload.error;
  }
  return executeUploadAndRevalidate({
    viewer: auth.data,
    payload: payload.data,
  });
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
