import { Prisma } from '@prisma/client';
import { put, del } from '@vercel/blob';
import { db } from '@/lib/prisma';
import {
  logAudit,
  type AuditTransactionClient,
} from '@/lib/services/audit-log.service';
import { getAccessibleBoutiqueIds } from '@/lib/permissions';
import {
  MAX_SIGNATURE_BYTES,
  MAX_SIGNATURE_HISTORY,
  SIGNATURE_MIME,
  SIGNATURE_PUT_TIMEOUT_MS,
} from '@/lib/constants/signature';
import {
  generateStorageKey,
  isPngMimeType,
  sanitizeFilename,
  verifyPngMagicBytes,
} from '@/lib/utils/signature';
import { logger } from '@/lib/logger';
import type { Result } from '@/types/result';
import type {
  SignatureError,
  SignatureRequestMetadata,
  SignatureRow,
  SignatureUploadResult,
  SignatureViewer,
} from '@/types/signature';

/**
 * Service Signature (US-SIG-001).
 *
 * Responsabilites :
 *   - `uploadSignatureToRegistre` : valide role (SALARIE/RESPONSABLE) +
 *     scope boutique + MIME declare + magic bytes PNG + taille, verifie
 *     l'unicite (boutiqueId, dateISO) AVANT upload Blob (eviter cout
 *     inutile), uploade vers Vercel Blob, INSERT Signature + audit dans
 *     transaction Serializable. Compensation `del()` si l'INSERT
 *     echoue OU si une collision unique se produit en race condition.
 *   - `getSignatureForRegistre` : verifie scope, retourne `SignatureRow`
 *     ou `null`.
 *   - `listSignaturesForBoutique` : historique pagine (max 50) avec
 *     scope check.
 *
 * Choix URL Vercel Blob (`access: 'public'`) :
 *   Identique au pattern PHOTOS. Pathname non-guessable
 *   (`<timestamp>-<uuid>`, 16+ bytes d'entropie) = equivalent securite a
 *   une URL signee pour ce MVP, sans le cout d'un round-trip signature
 *   par display. L'URL retournee par `put()` est persistee dans
 *   `Signature.blobUrl` (decouplage env variables).
 *
 * Tracabilite immuable HACCP :
 *   Aucune operation UPDATE/DELETE n'est exposee. Premier qui signe
 *   verrouille le registre du jour (decision Phase 0.5 #1). Une fois
 *   l'INSERT commit, le seul changement possible serait une migration
 *   manuelle (audit DDPP).
 *
 * Defense en profondeur MIME :
 *   Le `file.type` declare par le browser ne fait pas foi. On verifie
 *   `verifyPngMagicBytes` avant l'upload. Un mismatch -> MAGIC_BYTES_FAIL
 *   (refus).
 *
 * Confidentialite operationnelle :
 *   La `storageKey` n'apparait JAMAIS dans les metadata d'audit ni dans
 *   les logs (cf. PHOTOS - sec finding H-2/M-4). C'est un secret
 *   operationnel.
 */

interface UploadSignatureArgs {
  readonly viewer: SignatureViewer;
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly file: File;
  readonly metadata: SignatureRequestMetadata;
}

interface GetSignatureArgs {
  readonly viewer: SignatureViewer;
  readonly boutiqueId: string;
  readonly dateISO: string;
}

interface ListSignaturesArgs {
  readonly viewer: SignatureViewer;
  readonly boutiqueId: string;
  readonly limit?: number;
}

const ALLOWED_SIGNATAIRE_ROLES = ['SALARIE', 'RESPONSABLE'] as const;
type AllowedSignataireRole = (typeof ALLOWED_SIGNATAIRE_ROLES)[number];

/**
 * Verifie que le role du viewer est dans la whitelist (SALARIE ou
 * RESPONSABLE). ADMIN est intentionnellement exclu : la signature DDPP
 * est l'acte d'un operateur de terrain qui assume la conformite, pas
 * d'un gestionnaire de comptes.
 */
function isAllowedSignataireRole(
  role: SignatureViewer['role']
): role is AllowedSignataireRole {
  return (ALLOWED_SIGNATAIRE_ROLES as readonly string[]).includes(role);
}

/**
 * Verifie le scope boutique du viewer. Retourne `BOUTIQUE_NOT_FOUND` si
 * la boutique cible n'est pas dans le scope (anti-enum : ne pas reveler
 * l'existence d'une boutique hors perimetre).
 */
async function authorizeBoutiqueScope(
  viewer: SignatureViewer,
  boutiqueId: string
): Promise<Result<true, SignatureError>> {
  const accessible = await getAccessibleBoutiqueIds(viewer);
  if (!accessible.includes(boutiqueId)) {
    return { success: false, error: 'BOUTIQUE_NOT_FOUND' };
  }
  return { success: true, data: true };
}

interface ValidatedUpload {
  readonly buffer: Uint8Array;
}

/**
 * Valide la taille declaree et le MIME declare du fichier AVANT lecture
 * du buffer. Permet de rejeter tot un fichier trop volumineux ou de MIME
 * non autorise sans consommer de memoire pour `arrayBuffer()`.
 */
function validateFileHeaders(file: File): SignatureError | null {
  if (file.size > MAX_SIGNATURE_BYTES) {
    return 'TOO_LARGE';
  }
  if (!isPngMimeType(file.type)) {
    return 'INVALID_MIME';
  }
  return null;
}

/**
 * Valide la taille, le MIME declare et les magic bytes PNG du fichier.
 * Le buffer est lu une seule fois (`arrayBuffer`) puis reutilise par
 * `put()` (acceptable : MAX_SIGNATURE_BYTES = 200 KB).
 */
async function validateSignatureFile(
  file: File
): Promise<Result<ValidatedUpload, SignatureError>> {
  const headerError = validateFileHeaders(file);
  if (headerError) {
    return { success: false, error: headerError };
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!verifyPngMagicBytes(buffer)) {
    return { success: false, error: 'MAGIC_BYTES_FAIL' };
  }
  return { success: true, data: { buffer } };
}

/**
 * Verifie en pre-check l'absence d'une signature existante pour le
 * couple `(boutiqueId, dateISO)`. Evite un upload Blob inutile sur le
 * cas dominant "deja signe". La race condition est traitee dans la
 * transaction Serializable via `handleSignaturePersistError`.
 */
async function ensureNoExistingSignature(
  boutiqueId: string,
  dateISO: string
): Promise<Result<true, SignatureError>> {
  const existing = await db.signature.findUnique({
    where: { boutiqueId_dateISO: { boutiqueId, dateISO } },
    select: { id: true },
  });
  if (existing) {
    return { success: false, error: 'SIGNATURE_ALREADY_EXISTS' };
  }
  return { success: true, data: true };
}

interface UploadBlobArgs {
  readonly storageKey: string;
  readonly buffer: Uint8Array;
}

/**
 * Convertit le `Uint8Array` valide en `Buffer` partageant le meme
 * stockage memoire (pas de copie). `put()` accepte ce shape comme
 * payload binaire.
 */
function toBlobBody(buffer: Uint8Array): Buffer {
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Wrappe `put()` avec un `AbortSignal` arme par `AbortSignal.timeout`.
 * Fail-fast a `SIGNATURE_PUT_TIMEOUT_MS` (8 s) AVANT la limite de la
 * function Vercel (10 s sur Hobby). En cas d'abort -> STORAGE_FAILURE.
 */
async function putWithTimeout(
  storageKey: string,
  body: Buffer
): Promise<{ readonly url: string }> {
  return put(storageKey, body, {
    access: 'public',
    addRandomSuffix: false,
    contentType: SIGNATURE_MIME,
    abortSignal: AbortSignal.timeout(SIGNATURE_PUT_TIMEOUT_MS),
  });
}

/**
 * Mappe une erreur de `put()` Vercel Blob en `SignatureError`. Toujours
 * `STORAGE_FAILURE` (le caller logge avant). Centralise pour faciliter
 * une distinction future (timeout vs. 5xx vs. quota).
 */
function mapBlobUploadError(error: unknown): SignatureError {
  logger.error('[signature.upload] blob put failed', {
    error: error instanceof Error ? error.message : 'unknown',
  });
  return 'STORAGE_FAILURE';
}

async function uploadBlob({
  storageKey,
  buffer,
}: UploadBlobArgs): Promise<Result<{ readonly url: string }, SignatureError>> {
  try {
    const result = await putWithTimeout(storageKey, toBlobBody(buffer));
    return { success: true, data: { url: result.url } };
  } catch (error) {
    return { success: false, error: mapBlobUploadError(error) };
  }
}

async function safeDeleteBlob(
  storageKey: string,
  reason: string
): Promise<void> {
  try {
    await del(storageKey);
  } catch (error) {
    logger.error('[signature.blob] delete failed', {
      reason,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

interface PersistSignatureArgs {
  readonly viewer: SignatureViewer;
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly storageKey: string;
  readonly blobUrl: string;
  readonly safeFilename: string;
  readonly metadata: SignatureRequestMetadata;
}

interface PersistedSignature {
  readonly id: string;
  readonly signedAt: Date;
}

function buildSignatureCreateData(args: PersistSignatureArgs) {
  return {
    boutiqueId: args.boutiqueId,
    dateISO: args.dateISO,
    signataireId: args.viewer.id,
    signataireRoleSnapshot: args.viewer.role,
    storageKey: args.storageKey,
    blobUrl: args.blobUrl,
    ipAddress: args.metadata.ipAddress,
    userAgent: args.metadata.userAgent,
  };
}

async function auditSignatureCreate(
  tx: AuditTransactionClient,
  args: PersistSignatureArgs,
  createdId: string
): Promise<void> {
  await logAudit({
    action: 'SIGNATURE_CREATE',
    entityType: 'SIGNATURE',
    entityId: createdId,
    entityLabel: args.safeFilename,
    performedById: args.viewer.id,
    // storageKey volontairement omis (secret operationnel).
    metadata: {
      boutiqueId: args.boutiqueId,
      dateISO: args.dateISO,
      signataireRoleSnapshot: args.viewer.role,
    },
    tx,
  });
}

async function insertSignatureInTransaction(
  tx: AuditTransactionClient,
  args: PersistSignatureArgs
): Promise<PersistedSignature> {
  const created = await tx.signature.create({
    data: buildSignatureCreateData(args),
    select: { id: true, signedAt: true },
  });
  await auditSignatureCreate(tx, args, created.id);
  return created;
}

/**
 * Encapsule l'INSERT + audit dans une transaction Serializable.
 * L'unicite `(boutiqueId, dateISO)` est garantie par contrainte SQL :
 * une race condition entre pre-check et INSERT remonte une P2002 que
 * `handleSignaturePersistError` traite specifiquement.
 */
async function persistSignatureAfterUpload(
  args: PersistSignatureArgs
): Promise<PersistedSignature> {
  return db.$transaction(async (tx) => insertSignatureInTransaction(tx, args), {
    isolationLevel: 'Serializable',
  });
}

/**
 * Mappe une erreur Prisma a un `SignatureError` typed apres compensation
 * Blob. Une violation d'unicite P2002 indique une race condition
 * (signature concurrente sur le meme jour) -> SIGNATURE_ALREADY_EXISTS.
 */
function classifyPersistError(error: unknown): SignatureError {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return 'SIGNATURE_ALREADY_EXISTS';
  }
  return 'STORAGE_FAILURE';
}

function toSignatureUploadResult(
  args: PersistSignatureArgs,
  persisted: PersistedSignature
): SignatureUploadResult {
  return {
    id: persisted.id,
    imageUrl: args.blobUrl,
    signedAt: persisted.signedAt,
  };
}

async function handlePersistFailure(
  args: PersistSignatureArgs,
  error: unknown
): Promise<Result<SignatureUploadResult, SignatureError>> {
  const classified = classifyPersistError(error);
  await safeDeleteBlob(args.storageKey, classified.toLowerCase());
  if (classified === 'STORAGE_FAILURE') {
    logger.error('[signature.upload] DB transaction failed', {
      boutiqueId: args.boutiqueId,
      dateISO: args.dateISO,
      viewerId: args.viewer.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
  return { success: false, error: classified };
}

async function finalizeSignatureUpload(
  args: PersistSignatureArgs
): Promise<Result<SignatureUploadResult, SignatureError>> {
  try {
    const persisted = await persistSignatureAfterUpload(args);
    return { success: true, data: toSignatureUploadResult(args, persisted) };
  } catch (error) {
    return handlePersistFailure(args, error);
  }
}

interface RunUploadPipelineArgs {
  readonly viewer: SignatureViewer;
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly buffer: Uint8Array;
  readonly safeFilename: string;
  readonly metadata: SignatureRequestMetadata;
}

interface UploadedBlobContext {
  readonly storageKey: string;
  readonly blobUrl: string;
}

async function reserveAndUploadBlob(
  args: RunUploadPipelineArgs
): Promise<Result<UploadedBlobContext, SignatureError>> {
  const storageKey = generateStorageKey({
    boutiqueId: args.boutiqueId,
    dateISO: args.dateISO,
  });
  const blob = await uploadBlob({ storageKey, buffer: args.buffer });
  if (!blob.success) {
    return blob;
  }
  return { success: true, data: { storageKey, blobUrl: blob.data.url } };
}

function toPersistArgs(
  args: RunUploadPipelineArgs,
  uploaded: UploadedBlobContext
): PersistSignatureArgs {
  return {
    viewer: args.viewer,
    boutiqueId: args.boutiqueId,
    dateISO: args.dateISO,
    storageKey: uploaded.storageKey,
    blobUrl: uploaded.blobUrl,
    safeFilename: args.safeFilename,
    metadata: args.metadata,
  };
}

/**
 * Pipeline qui s'execute apres la validation : pre-check unicite + upload
 * Blob + persistance + compensation. Isole pour garder
 * `uploadSignatureToRegistre` en pipeline lisible <20 lignes.
 */
async function runUploadPipeline(
  args: RunUploadPipelineArgs
): Promise<Result<SignatureUploadResult, SignatureError>> {
  const noConflict = await ensureNoExistingSignature(
    args.boutiqueId,
    args.dateISO
  );
  if (!noConflict.success) {
    return noConflict;
  }
  const uploaded = await reserveAndUploadBlob(args);
  if (!uploaded.success) {
    return uploaded;
  }
  return finalizeSignatureUpload(toPersistArgs(args, uploaded.data));
}

/**
 * Verifie le role + le scope boutique du viewer. Centralisation des
 * gates pre-validation pour garder `uploadSignatureToRegistre` court.
 */
async function authorizeSignatureUpload(
  viewer: SignatureViewer,
  boutiqueId: string
): Promise<Result<true, SignatureError>> {
  if (!isAllowedSignataireRole(viewer.role)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  return authorizeBoutiqueScope(viewer, boutiqueId);
}

/**
 * Uploade la signature manuscrite du registre journalier (US-SIG-001).
 *
 * Pipeline :
 *   1. Guard role (SALARIE/RESPONSABLE) - FORBIDDEN sinon.
 *   2. Scope boutique - BOUTIQUE_NOT_FOUND si hors perimetre.
 *   3. Validation file (size + MIME declare + magic bytes PNG).
 *   4. Pre-check unicite (boutiqueId, dateISO) - eviter cout Blob inutile.
 *   5. Upload Vercel Blob (hors transaction : appel reseau externe).
 *   6. Persistance INSERT + audit dans transaction Serializable.
 *   7. Compensation `del()` si l'etape 6 echoue (P2002 race ou autre).
 */
export async function uploadSignatureToRegistre(
  args: UploadSignatureArgs
): Promise<Result<SignatureUploadResult, SignatureError>> {
  const authz = await authorizeSignatureUpload(args.viewer, args.boutiqueId);
  if (!authz.success) {
    return authz;
  }
  const validation = await validateSignatureFile(args.file);
  if (!validation.success) {
    return validation;
  }
  return runUploadPipeline({
    viewer: args.viewer,
    boutiqueId: args.boutiqueId,
    dateISO: args.dateISO,
    buffer: validation.data.buffer,
    safeFilename: sanitizeFilename(args.file.name),
    metadata: args.metadata,
  });
}

interface SignatureWithSignataire {
  readonly id: string;
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly signataireId: string;
  readonly signataireRoleSnapshot: SignatureViewer['role'];
  readonly blobUrl: string;
  readonly signedAt: Date;
  readonly signataire: { readonly name: string };
}

function mapSignatureRow(row: SignatureWithSignataire): SignatureRow {
  return {
    id: row.id,
    boutiqueId: row.boutiqueId,
    dateISO: row.dateISO,
    signataireId: row.signataireId,
    signataireName: row.signataire.name,
    signataireRoleSnapshot: row.signataireRoleSnapshot,
    imageUrl: row.blobUrl,
    signedAt: row.signedAt,
  };
}

const SIGNATURE_SELECT = {
  id: true,
  boutiqueId: true,
  dateISO: true,
  signataireId: true,
  signataireRoleSnapshot: true,
  blobUrl: true,
  signedAt: true,
  signataire: { select: { name: true } },
} as const;

/**
 * Recupere la signature unique du registre d'une boutique a une date
 * donnee. Retourne `null` dans `data` si aucune signature n'existe.
 */
export async function getSignatureForRegistre({
  viewer,
  boutiqueId,
  dateISO,
}: GetSignatureArgs): Promise<Result<SignatureRow | null, SignatureError>> {
  const scope = await authorizeBoutiqueScope(viewer, boutiqueId);
  if (!scope.success) {
    return scope;
  }
  const row = await db.signature.findUnique({
    where: { boutiqueId_dateISO: { boutiqueId, dateISO } },
    select: SIGNATURE_SELECT,
  });
  return { success: true, data: row ? mapSignatureRow(row) : null };
}

/**
 * Liste l'historique des signatures d'une boutique (max 50, ordre
 * desc par signedAt). Borne defensive : au-dela, pagination requise.
 */
export async function listSignaturesForBoutique({
  viewer,
  boutiqueId,
  limit,
}: ListSignaturesArgs): Promise<
  Result<readonly SignatureRow[], SignatureError>
> {
  const scope = await authorizeBoutiqueScope(viewer, boutiqueId);
  if (!scope.success) {
    return scope;
  }
  const take = Math.min(limit ?? MAX_SIGNATURE_HISTORY, MAX_SIGNATURE_HISTORY);
  const rows = await db.signature.findMany({
    where: { boutiqueId },
    orderBy: { signedAt: 'desc' },
    take,
    select: SIGNATURE_SELECT,
  });
  return { success: true, data: rows.map(mapSignatureRow) };
}
