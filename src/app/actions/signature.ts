'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { uploadSignatureToRegistre } from '@/lib/services/signature.service';
import { checkRateLimit, toRetryAfterSeconds } from '@/lib/services/rateLimit';
import { readRequiredString } from '@/lib/utils/form-data';
import { getClientIp } from '@/lib/utils/request';
import { ensureRoleOrError } from '@/lib/utils/server-action-guards';
import { logger } from '@/lib/logger';
import { signatureUploadSchema } from '@/lib/validations/signature';
import { MAX_USER_AGENT_LENGTH } from '@/lib/constants/signature';
import type { SignatureViewer, SignatureError } from '@/types/signature';
import type {
  SignatureUploadActionErrorCode,
  SignatureUploadActionState,
} from './signature.types';

/**
 * Server Action Signature (US-SIG-001).
 *
 * Pipeline upload :
 *   1. Auth + role guard (SALARIE/RESPONSABLE).
 *   2. Rate-limit SIGNATURE_UPLOAD par user.id (10 / 1h).
 *   3. Lecture FormData : boutiqueId, dateISO, file (PNG obligatoire).
 *   4. Validation Zod sur scalaires + narrowing `file instanceof File`.
 *   5. Extraction metadata audit (ipAddress + userAgent).
 *   6. Delegation au service `uploadSignatureToRegistre`.
 *   7. `revalidatePath` sur la page registre journalier en cas de succes.
 */

const UPLOAD_ALLOWED_ROLES = ['SALARIE', 'RESPONSABLE'] as const;

const UPLOAD_FORBIDDEN_STATE: SignatureUploadActionState = {
  status: 'error',
  code: 'FORBIDDEN',
};

function buildRegistrePath(boutiqueId: string, dateISO: string): string {
  return `/boutiques/${boutiqueId}/registre/${dateISO}`;
}

/**
 * Switch exhaustif sur `SignatureError` : si un nouveau code est ajoute
 * dans `signature.service`, TypeScript signalera l'oubli via le check
 * `assertNever` final (Clean Code #7).
 */
function mapServiceErrorToActionState(
  error: SignatureError
): SignatureUploadActionErrorCode {
  switch (error) {
    case 'FORBIDDEN':
      return 'FORBIDDEN';
    case 'BOUTIQUE_NOT_FOUND':
      return 'BOUTIQUE_NOT_FOUND';
    case 'SIGNATURE_NOT_FOUND':
      // Ne devrait pas remonter de l'upload (cas reserve a getSignatureForRegistre).
      return 'INTERNAL';
    case 'SIGNATURE_ALREADY_EXISTS':
      return 'SIGNATURE_ALREADY_EXISTS';
    case 'INVALID_MIME':
      return 'INVALID_MIME';
    case 'TOO_LARGE':
      return 'TOO_LARGE';
    case 'MAGIC_BYTES_FAIL':
      return 'MAGIC_BYTES_FAIL';
    case 'STORAGE_FAILURE':
      return 'STORAGE_FAILURE';
    case 'INTERNAL':
      return 'INTERNAL';
    default:
      return assertNever(error);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected SignatureError variant: ${String(value)}`);
}

function readFormFile(formData: FormData, key: string): File | null {
  const raw = formData.get(key);
  if (raw instanceof File && raw.size > 0) {
    return raw;
  }
  return null;
}

interface UploadFormPayload {
  readonly boutiqueId: string;
  readonly dateISO: string;
  readonly file: File;
}

interface ParsedScalars {
  readonly boutiqueId: string;
  readonly dateISO: string;
}

/**
 * Discriminated union dediee aux pipelines internes : `Result<T, E>`
 * global contraint `E extends string`, ce qui n'est pas compatible avec
 * un payload d'erreur structure (`SignatureUploadActionState`).
 */
type ActionStep<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SignatureUploadActionState };

function buildValidationError(
  fieldErrors: Record<string, string[] | undefined>
): SignatureUploadActionState {
  return { status: 'error', code: 'VALIDATION', fieldErrors };
}

function parseScalars(formData: FormData): ActionStep<ParsedScalars> {
  const parsed = signatureUploadSchema.safeParse({
    boutiqueId: readRequiredString(formData, 'boutiqueId'),
    dateISO: readRequiredString(formData, 'dateISO'),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: buildValidationError(parsed.error.flatten().fieldErrors),
    };
  }
  return {
    success: true,
    data: { boutiqueId: parsed.data.boutiqueId, dateISO: parsed.data.dateISO },
  };
}

function readUploadFormData(formData: FormData): ActionStep<UploadFormPayload> {
  const scalars = parseScalars(formData);
  if (!scalars.success) {
    return scalars;
  }
  const file = readFormFile(formData, 'file');
  if (!file) {
    return {
      success: false,
      error: {
        status: 'error',
        code: 'INVALID_FILE',
        fieldErrors: { file: ['Signature requise'] },
      },
    };
  }
  return { success: true, data: { ...scalars.data, file } };
}

function toViewer(user: {
  readonly id: string;
  readonly role: SignatureViewer['role'];
}): SignatureViewer {
  return { id: user.id, role: user.role };
}

async function checkUploadRateLimit(
  viewerId: string
): Promise<SignatureUploadActionState | null> {
  const rate = await checkRateLimit('SIGNATURE_UPLOAD', `user:${viewerId}`);
  if (rate.allowed) {
    return null;
  }
  return {
    status: 'error',
    code: 'RATE_LIMITED',
    retryAfterSeconds: toRetryAfterSeconds(rate.retryAfterMs),
  };
}

async function authorizeUploader(): Promise<ActionStep<SignatureViewer>> {
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

/**
 * Tronque le `User-Agent` declare a `MAX_USER_AGENT_LENGTH` (500).
 * Defense en profondeur contre les payloads abusifs (DB bloat / DoS).
 */
function truncateUserAgent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

async function extractRequestMetadata(): Promise<{
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}> {
  const requestHeaders = await headers();
  const ip = getClientIp(requestHeaders);
  return {
    ipAddress: ip === 'unknown' ? null : ip,
    userAgent: truncateUserAgent(requestHeaders.get('user-agent')),
  };
}

interface UploadPipelineArgs {
  readonly viewer: SignatureViewer;
  readonly payload: UploadFormPayload;
}

function logIfTransientError(
  args: UploadPipelineArgs,
  serviceError: SignatureError,
  actionCode: SignatureUploadActionErrorCode
): void {
  if (actionCode !== 'INTERNAL' && actionCode !== 'STORAGE_FAILURE') {
    return;
  }
  logger.error('[signature-upload] service error', {
    viewerId: args.viewer.id,
    boutiqueId: args.payload.boutiqueId,
    dateISO: args.payload.dateISO,
    error: serviceError,
  });
}

function toSuccessState(result: {
  readonly id: string;
  readonly imageUrl: string;
  readonly signedAt: Date;
}): SignatureUploadActionState {
  return {
    status: 'success',
    signatureId: result.id,
    imageUrl: result.imageUrl,
    signedAt: result.signedAt.toISOString(),
  };
}

async function runUploadPipeline(
  args: UploadPipelineArgs
): Promise<SignatureUploadActionState> {
  const metadata = await extractRequestMetadata();
  const result = await uploadSignatureToRegistre({
    viewer: args.viewer,
    boutiqueId: args.payload.boutiqueId,
    dateISO: args.payload.dateISO,
    file: args.payload.file,
    metadata,
  });
  if (!result.success) {
    const code = mapServiceErrorToActionState(result.error);
    logIfTransientError(args, result.error, code);
    return { status: 'error', code };
  }
  return toSuccessState(result.data);
}

async function executeUploadAndRevalidate(
  args: UploadPipelineArgs
): Promise<SignatureUploadActionState> {
  const state = await runUploadPipeline(args);
  if (state.status === 'success') {
    revalidatePath(
      buildRegistrePath(args.payload.boutiqueId, args.payload.dateISO)
    );
  }
  return state;
}

export async function signatureUploadAction(
  _prev: SignatureUploadActionState,
  formData: FormData
): Promise<SignatureUploadActionState> {
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
