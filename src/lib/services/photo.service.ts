import { put, del } from '@vercel/blob';
import { db } from '@/lib/prisma';
import {
  logAudit,
  type AuditTransactionClient,
} from '@/lib/services/audit-log.service';
import {
  canManageAlertes,
  getAccessibleBoutiqueIds,
  type SessionUser,
} from '@/lib/permissions';
import { getAlerteById, type AlerteError } from '@/lib/services/alerte.service';
import {
  MAX_PHOTOS_PER_ALERTE,
  MAX_PHOTO_SIZE_BYTES,
} from '@/lib/constants/photo';
import {
  generateStorageKey,
  isPhotoMimeType,
  sanitizeFilename,
  verifyImageMagicBytes,
} from '@/lib/utils/photo';
import { logger } from '@/lib/logger';
import type { Result } from '@/types/result';
import type {
  PhotoError,
  PhotoListItem,
  PhotoMimeType,
  PhotoUploadResult,
} from '@/types/photo';

/**
 * Service Photo (US-PHO-001).
 *
 * Responsabilites :
 *   - `uploadPhotoToAlerte`   : valide role + scope alerte + quota + MIME
 *     declare + magic bytes + taille, uploade vers Vercel Blob, INSERT
 *     Photo + audit dans transaction Serializable. Compensation `del()`
 *     si la transaction echoue apres l'upload.
 *   - `deletePhotoFromAlerte` : role RESPONSABLE/ADMIN + scope alerte,
 *     DELETE Photo + audit en transaction, puis `del()` sur le blob
 *     (best-effort apres commit).
 *   - `listPhotosForAlerte`   : verifie scope via `getAlerteById`, mappe
 *     les Photo en `PhotoListItem` avec l'URL publique persistee.
 *
 * Choix URL Vercel Blob (`access: 'public'`) :
 *   On utilise `access: 'public'` + `addRandomSuffix: false` puisqu'on
 *   genere DEJA un pathname non-guessable (`<timestamp>-<uuid>`) via
 *   `generateStorageKey`. Le couple `<timestamp>-<uuid>` (16+ bytes
 *   d'entropie) est equivalent securite a une URL signee pour le MVP
 *   HACCP, sans le cout d'un round-trip de signature par display.
 *
 *   L'URL retournee par `put()` est persistee dans `Photo.blobUrl`
 *   (US-PHO-001 - sec finding C-1) : la lecture est decouplee de toute
 *   variable d'environnement.
 *
 * Concurrence quota (US-PHO-001 - sec finding C-2) :
 *   Le count + INSERT sont encapsules dans une transaction Serializable
 *   pour eviter qu'un upload concurrent depasse `MAX_PHOTOS_PER_ALERTE`.
 *   L'upload Vercel Blob reste hors transaction (appel reseau externe) ;
 *   en cas de conflit, on appelle `safeDeleteBlob` pour compenser.
 *
 * Defense en profondeur MIME (US-PHO-001 - sec finding H-1) :
 *   Le `file.type` declare par le browser ne fait pas foi. On verifie
 *   les magic bytes (`verifyImageMagicBytes`) avant l'upload. Un mismatch
 *   declare/reel -> INVALID_MIME (refus).
 *
 * Confidentialite operationnelle :
 *   La `storageKey` n'apparait JAMAIS dans les metadata d'audit ni dans
 *   les logs (sec finding H-2 / M-4). C'est un secret operationnel : un
 *   ADMIN lisant l'audit log ne doit pas pouvoir reconstruire l'URL
 *   Vercel Blob sans verif scope boutique.
 */

interface UploadPhotoArgs {
  readonly viewer: SessionUser;
  readonly alerteId: string;
  readonly file: File;
}

interface DeletePhotoArgs {
  readonly viewer: SessionUser;
  readonly photoId: string;
}

interface ListPhotosArgs {
  readonly viewer: SessionUser;
  readonly alerteId: string;
}

/**
 * Verifie que le viewer a acces a l'alerte cible.
 * SALARIE inclus : on ne passe pas par `getAlerteById` (qui guard le role
 * a RESPONSABLE/ADMIN) mais on charge directement le scope boutique.
 */
async function resolveAlerteScopeForUpload(
  viewer: SessionUser,
  alerteId: string
): Promise<Result<{ readonly boutiqueId: string }, PhotoError>> {
  const alerte = await db.alerte.findUnique({
    where: { id: alerteId },
    select: { releve: { select: { boutiqueId: true } } },
  });
  if (!alerte) {
    return { success: false, error: 'ALERTE_NOT_FOUND' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(alerte.releve.boutiqueId)) {
    return { success: false, error: 'ALERTE_NOT_FOUND' };
  }
  return { success: true, data: { boutiqueId: alerte.releve.boutiqueId } };
}

interface ValidatedUpload {
  readonly mimeType: PhotoMimeType;
  readonly buffer: Uint8Array;
}

/**
 * Valide la taille, le MIME declare et les magic bytes du fichier.
 * Le buffer est lu une seule fois (`arrayBuffer`) puis reutilise par
 * `put()` (acceptable : MAX_PHOTO_SIZE_BYTES = 2 MB).
 */
async function validateUploadInput(
  file: File
): Promise<Result<ValidatedUpload, PhotoError>> {
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return { success: false, error: 'TOO_LARGE' };
  }
  if (!isPhotoMimeType(file.type)) {
    return { success: false, error: 'INVALID_MIME' };
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  const detectedMime = verifyImageMagicBytes(buffer);
  if (detectedMime === null || detectedMime !== file.type) {
    return { success: false, error: 'INVALID_MIME' };
  }
  return { success: true, data: { mimeType: detectedMime, buffer } };
}

interface UploadBlobArgs {
  readonly storageKey: string;
  readonly buffer: Uint8Array;
  readonly mimeType: PhotoMimeType;
}

async function uploadBlob({
  storageKey,
  buffer,
  mimeType,
}: UploadBlobArgs): Promise<Result<{ readonly url: string }, PhotoError>> {
  try {
    // `PutBody` du SDK Vercel accepte Buffer | ArrayBuffer | Blob | File
    // mais pas directement Uint8Array. On reemballe en Buffer Node
    // (zero-copy : Buffer.from(Uint8Array) partage le memory backing).
    const body = Buffer.from(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    const result = await put(storageKey, body, {
      access: 'public',
      addRandomSuffix: false,
      contentType: mimeType,
    });
    return { success: true, data: { url: result.url } };
  } catch (error) {
    // storageKey est volontairement omis (secret operationnel, cf. doc).
    logger.error('[photo.upload] blob put failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { success: false, error: 'STORAGE_FAILURE' };
  }
}

async function safeDeleteBlob(
  storageKey: string,
  reason: string
): Promise<void> {
  try {
    await del(storageKey);
  } catch (error) {
    // storageKey est volontairement omis des logs (secret operationnel).
    logger.error('[photo.blob] delete failed', {
      reason,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

interface EnforceQuotaArgs {
  readonly alerteId: string;
  readonly viewerId: string;
  readonly storageKey: string;
  readonly blobUrl: string;
  readonly mimeType: PhotoMimeType;
  readonly safeFilename: string;
  readonly sizeBytes: number;
}

/**
 * Verifie le quota et INSERT la Photo + audit dans une transaction
 * Serializable. La verification du quota se fait DANS la transaction
 * pour eviter la race condition (2 uploads concurrents -> 4 photos).
 *
 * Renvoie QUOTA_EXCEEDED si la limite est atteinte (l'INSERT n'est pas
 * tente : le caller doit alors supprimer le blob deja uploade).
 */
async function enforceQuotaAndInsert(
  tx: AuditTransactionClient,
  args: EnforceQuotaArgs
): Promise<Result<{ readonly id: string }, PhotoError>> {
  const count = await tx.photo.count({ where: { alerteId: args.alerteId } });
  if (count >= MAX_PHOTOS_PER_ALERTE) {
    return { success: false, error: 'QUOTA_EXCEEDED' };
  }
  const created = await tx.photo.create({
    data: {
      alerteId: args.alerteId,
      storageKey: args.storageKey,
      blobUrl: args.blobUrl,
      filename: args.safeFilename,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      uploadedByUserId: args.viewerId,
    },
    select: { id: true },
  });
  await logAudit({
    action: 'PHOTO_UPLOAD',
    entityType: 'PHOTO',
    entityId: created.id,
    entityLabel: args.safeFilename,
    performedById: args.viewerId,
    // storageKey volontairement omis : secret operationnel (un ADMIN qui
    // consulte l'audit log ne doit pas pouvoir reconstruire l'URL Blob).
    metadata: {
      alerteId: args.alerteId,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
    },
    tx,
  });
  return { success: true, data: { id: created.id } };
}

/**
 * Encapsule `enforceQuotaAndInsert` dans une transaction Serializable.
 * Isole le boilerplate transactionnel pour garder `uploadPhotoToAlerte`
 * en pipeline lisible.
 */
async function persistPhotoAfterUpload(
  args: EnforceQuotaArgs
): Promise<Result<{ readonly id: string }, PhotoError>> {
  return db.$transaction(async (tx) => enforceQuotaAndInsert(tx, args), {
    isolationLevel: 'Serializable',
  });
}

/**
 * Uploade une photo justificative attachee a une alerte (US-PHO-001).
 *
 * Pipeline :
 *   1. Resolution + scope alerte (ALERTE_NOT_FOUND si hors scope).
 *   2. Validation file (size + MIME declare + magic bytes).
 *   3. Generation `storageKey` non-guessable.
 *   4. Upload Vercel Blob (hors transaction : appel reseau externe).
 *   5. Persistance INSERT + audit dans transaction Serializable
 *      (verification de quota concurrente-safe).
 *   6. Compensation `del()` si l'etape 5 echoue ou retourne QUOTA_EXCEEDED.
 */
export async function uploadPhotoToAlerte({
  viewer,
  alerteId,
  file,
}: UploadPhotoArgs): Promise<Result<PhotoUploadResult, PhotoError>> {
  const scope = await resolveAlerteScopeForUpload(viewer, alerteId);
  if (!scope.success) {
    return scope;
  }
  const validation = await validateUploadInput(file);
  if (!validation.success) {
    return validation;
  }
  const { mimeType, buffer } = validation.data;
  const storageKey = generateStorageKey(alerteId, mimeType);
  const blobResult = await uploadBlob({ storageKey, buffer, mimeType });
  if (!blobResult.success) {
    return blobResult;
  }
  return finalizePhotoUpload({
    alerteId,
    viewerId: viewer.id,
    storageKey,
    blobUrl: blobResult.data.url,
    mimeType,
    safeFilename: sanitizeFilename(file.name),
    sizeBytes: file.size,
  });
}

/**
 * Persiste la Photo en DB et compense le blob si la transaction echoue
 * ou si la verification de quota concurrente refuse l'insert.
 */
async function finalizePhotoUpload(
  args: EnforceQuotaArgs
): Promise<Result<PhotoUploadResult, PhotoError>> {
  try {
    const persisted = await persistPhotoAfterUpload(args);
    if (!persisted.success) {
      await safeDeleteBlob(args.storageKey, 'quota-exceeded');
      return persisted;
    }
    return {
      success: true,
      data: { id: persisted.data.id, imageUrl: args.blobUrl },
    };
  } catch (error) {
    await safeDeleteBlob(args.storageKey, 'upload-rollback');
    logger.error('[photo.upload] DB transaction failed, blob rolled back', {
      alerteId: args.alerteId,
      viewerId: args.viewerId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { success: false, error: 'STORAGE_FAILURE' };
  }
}

const INTERNAL_ERROR: Result<never, PhotoError> = {
  success: false,
  error: 'INTERNAL',
};

interface ScopedPhoto {
  readonly id: string;
  readonly storageKey: string;
  readonly alerteId: string;
  readonly filename: string;
  readonly mimeType: string;
}

interface LoadPhotoWithScopeArgs {
  readonly viewer: SessionUser;
  readonly photoId: string;
}

/**
 * Charge une photo + verifie son scope boutique (anti-enum).
 *
 * Symetrique avec `resolveAlerteScopeForUpload` mais pour une `Photo` :
 *   - `null` ou hors scope -> `PHOTO_NOT_FOUND` (jamais `FORBIDDEN`, pour
 *     ne pas reveler l'existence de la ressource a un viewer non autorise).
 *   - sinon, retourne le `ScopedPhoto` projete + son `boutiqueId`.
 *
 * Le select inclut `mimeType` pour permettre aux callers d'enrichir
 * leur audit log sans round-trip DB supplementaire.
 */
async function loadPhotoWithScope({
  viewer,
  photoId,
}: LoadPhotoWithScopeArgs): Promise<
  Result<
    { readonly photo: ScopedPhoto; readonly boutiqueId: string },
    PhotoError
  >
> {
  const row = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      storageKey: true,
      alerteId: true,
      filename: true,
      mimeType: true,
      alerte: { select: { releve: { select: { boutiqueId: true } } } },
    },
  });
  if (!row) {
    return { success: false, error: 'PHOTO_NOT_FOUND' };
  }
  const accessible = await getAccessibleBoutiqueIds(viewer);
  const boutiqueId = row.alerte.releve.boutiqueId;
  if (!accessible.includes(boutiqueId)) {
    return { success: false, error: 'PHOTO_NOT_FOUND' };
  }
  return {
    success: true,
    data: {
      photo: {
        id: row.id,
        storageKey: row.storageKey,
        alerteId: row.alerteId,
        filename: row.filename,
        mimeType: row.mimeType,
      },
      boutiqueId,
    },
  };
}

/**
 * Supprime une photo (US-PHO-001 - role RESPONSABLE/ADMIN uniquement).
 *
 * Pipeline :
 *   1. Guard role (`canManageAlertes` = RESPONSABLE/ADMIN).
 *   2. `loadPhotoWithScope` : NOT_FOUND si hors scope (anti-enum).
 *   3. DELETE Photo + logAudit en transaction (atomique).
 *   4. `del()` Vercel Blob apres commit (best-effort, blob orphelin
 *      tolere mais loggue si echec).
 */
export async function deletePhotoFromAlerte({
  viewer,
  photoId,
}: DeletePhotoArgs): Promise<Result<{ readonly id: string }, PhotoError>> {
  if (!canManageAlertes(viewer)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  const scoped = await loadPhotoWithScope({ viewer, photoId });
  if (!scoped.success) {
    return scoped;
  }
  return runDeleteTransaction({ viewer, photo: scoped.data.photo });
}

interface RunDeleteTransactionArgs {
  readonly viewer: SessionUser;
  readonly photo: ScopedPhoto;
}

async function runDeleteTransaction({
  viewer,
  photo,
}: RunDeleteTransactionArgs): Promise<
  Result<{ readonly id: string }, PhotoError>
> {
  try {
    await db.$transaction(async (tx) => {
      await tx.photo.delete({ where: { id: photo.id } });
      await logAudit({
        action: 'PHOTO_DELETE',
        entityType: 'PHOTO',
        entityId: photo.id,
        entityLabel: photo.filename,
        performedById: viewer.id,
        // storageKey volontairement omis (secret operationnel).
        metadata: { alerteId: photo.alerteId },
        tx,
      });
    });
  } catch (error) {
    logger.error('[photo.delete] DB transaction failed', {
      photoId: photo.id,
      viewerId: viewer.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return INTERNAL_ERROR;
  }
  await safeDeleteBlob(photo.storageKey, 'photo-delete');
  return { success: true, data: { id: photo.id } };
}

/**
 * Liste les photos d'une alerte (US-PHO-001).
 *
 * Le scope est verifie via `getAlerteById` (role guard interne :
 * RESPONSABLE/ADMIN). Pour le SALARIE qui consulte le detail de l'alerte
 * de SA boutique, on contourne en chargeant directement le scope
 * (coherent avec la logique d'upload).
 */
export async function listPhotosForAlerte({
  viewer,
  alerteId,
}: ListPhotosArgs): Promise<Result<readonly PhotoListItem[], PhotoError>> {
  if (canManageAlertes(viewer)) {
    const alerteResult = await getAlerteById({ viewer, alerteId });
    if (!alerteResult.success) {
      return mapAlerteErrorToPhotoError(alerteResult.error);
    }
  } else {
    const scope = await resolveAlerteScopeForUpload(viewer, alerteId);
    if (!scope.success) {
      return scope;
    }
  }
  const rows = await db.photo.findMany({
    where: { alerteId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      alerteId: true,
      mimeType: true,
      sizeBytes: true,
      filename: true,
      blobUrl: true,
      createdAt: true,
      uploadedByUserId: true,
      uploadedBy: { select: { name: true } },
    },
  });
  const items = rows
    .map((row) => mapPhotoRow(row))
    .filter((item): item is PhotoListItem => item !== null);
  return { success: true, data: items };
}

/**
 * Switch exhaustif sur `AlerteError` : si un nouveau code est ajoute
 * dans `alerte.service`, TypeScript signalera l'oubli via le check
 * `assertNever` final (Clean Code MED4).
 */
function mapAlerteErrorToPhotoError(
  error: AlerteError
): Result<never, PhotoError> {
  switch (error) {
    case 'FORBIDDEN':
      return { success: false, error: 'FORBIDDEN' };
    case 'NOT_FOUND':
    case 'RELEVE_NOT_FOUND':
    case 'ALREADY_RESOLVED':
      return { success: false, error: 'ALERTE_NOT_FOUND' };
    default:
      return assertNever(error);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected AlerteError variant: ${String(value)}`);
}

interface PhotoRow {
  readonly id: string;
  readonly alerteId: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly filename: string;
  readonly blobUrl: string;
  readonly createdAt: Date;
  readonly uploadedByUserId: string;
  readonly uploadedBy: { readonly name: string };
}

/**
 * Mappe une ligne Photo DB en `PhotoListItem`. Si le `mimeType` stocke
 * n'est plus dans la whitelist (regression schema ou ALLOWED_PHOTO_MIME_TYPES
 * retreci), on log un warn et on filtre la ligne plutot que de coercer
 * silencieusement (Clean Code MED2 - defensif).
 */
function mapPhotoRow(row: PhotoRow): PhotoListItem | null {
  if (!isPhotoMimeType(row.mimeType)) {
    logger.warn('[photo.service] unexpected mime in DB', {
      photoId: row.id,
      mimeType: row.mimeType,
    });
    return null;
  }
  return {
    id: row.id,
    alerteId: row.alerteId,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    filename: row.filename,
    uploadedByName: row.uploadedBy.name,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt,
    // Renomme `signedUrl -> imageUrl` (v1.1) : honnetete nominale (URL
    // publique non-listable, pas signee). Pre-cabling preserve pour
    // future migration vers `access: 'private'` + TTL.
    imageUrl: row.blobUrl,
  };
}
