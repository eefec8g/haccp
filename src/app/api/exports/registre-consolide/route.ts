import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canExport, getAccessibleBoutiqueIds } from '@/lib/permissions';
import {
  exportConsolideQuerySchema,
  type ExportConsolideQuery,
} from '@/lib/validations/export';
import { buildRegistreConsolide } from '@/lib/services/export-consolide.service';
import { buildRegistreConsolidePdf } from '@/lib/utils/pdf-builder-consolide';
import { logAudit } from '@/lib/services/audit-log.service';
import { PDF_MIME_TYPE } from '@/lib/constants/export';
import {
  checkRateLimit,
  formatRetryAfterEnhanced,
} from '@/lib/services/rateLimit';
import { logger } from '@/lib/logger';
import type {
  ExportConsolideError,
  RegistreConsolide,
} from '@/types/export-consolide';
import type { SessionUser } from '@/lib/permissions';

/**
 * Route Handler GET `/api/exports/registre-consolide` (Epic REGISTRE
 * US-REG-001).
 *
 * Genere un registre consolide PDF sur une periode personnalisee
 * (max 31 jours) pour 1 boutique (ou toutes les boutiques accessibles
 * au viewer si `boutiqueId` est absent).
 *
 * Pipeline identique a `/api/exports/pdf` mais sans helper `export-route`
 * (mapping d'erreur dedie a `ExportConsolideError`, semantique distincte
 * des erreurs Epic EXPORT).
 *
 * Securite :
 *   - Auth obligatoire (redirect /login).
 *   - `canExport` guard (RESPONSABLE + ADMIN) -> redirect /login (anti-enum).
 *   - Rate limit `EXPORT_REGISTRE_CONSOLIDE` 5/h (decision Phase 0.5 #7).
 *
 * Audit : log `EXPORT_REGISTRE_CONSOLIDE` best-effort apres success ;
 * un echec d'audit ne doit pas masquer le PDF deja construit (au pire
 * la trace est perdue, le PDF reste valide).
 */

export const dynamic = 'force-dynamic';

/**
 * `maxDuration` (SEC-2) : aligne la route sur la limite Vercel Pro
 * (60s) pour eviter qu'une generation PDF longue (matrice 31 jours x
 * 5 boutiques x 5 equipements) ne soit coupee a 10s (defaut Hobby).
 * Vercel Hobby ignore silencieusement la valeur ; pas de regression.
 */
export const maxDuration = 60;

const FORM_PATH = '/exports/registre-consolide';
const ENTITY_ID_HASH_LENGTH = 32;

interface ErrorRedirectArgs {
  readonly request: NextRequest;
  readonly errorCode: string;
  readonly extra?: Record<string, string>;
}

function buildErrorRedirect({
  request,
  errorCode,
  extra,
}: ErrorRedirectArgs): NextResponse {
  const url = new URL(FORM_PATH, request.url);
  url.searchParams.set('error', errorCode);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(url, 303);
}

function mapConsolideErrorCode(error: ExportConsolideError): string {
  switch (error) {
    case 'FORBIDDEN':
      return 'forbidden';
    case 'BOUTIQUE_NOT_FOUND':
      return 'boutique_not_found';
    case 'PERIODE_INVALID':
      return 'periode_invalid';
    case 'PERIODE_TOO_LARGE':
      return 'periode_too_large';
    case 'PERIODE_IN_FUTURE':
      return 'periode_in_future';
    default:
      return 'internal';
  }
}

/**
 * Slugifie un nom de boutique pour usage en filename (a-z, 0-9, -).
 *
 * Pourquoi pas `encodeURIComponent` : Content-Disposition n'aime pas
 * les espaces ni les caracteres non-ASCII (RFC 6266 simple mode). On
 * normalise en NFD pour decomposer les diacritiques (e -> e + combining
 * mark) puis on strip tout ce qui n'est pas ASCII alphanum / tiret.
 */
function slugifyBoutique(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
}

function buildFilename(data: RegistreConsolide): string {
  const slug = buildScopeSlug(data.boutiques);
  return `registre-consolide-${slug}-${data.periode.dateStart}-au-${data.periode.dateEnd}.pdf`;
}

function buildScopeSlug(boutiques: RegistreConsolide['boutiques']): string {
  if (boutiques.length === 0) {
    return 'aucune';
  }
  const first = boutiques[0];
  if (boutiques.length === 1 && first) {
    return slugifyBoutique(first.nom) || 'boutique';
  }
  return 'all';
}

function readCleanedQueryParams(request: NextRequest): Record<string, string> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'error' || key === 'retry') {
      continue;
    }
    if (value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

interface AuditMetadataArgs {
  readonly data: RegistreConsolide;
  readonly query: ExportConsolideQuery;
  readonly pdfByteLength: number;
}

interface AuditMetadata {
  readonly boutiqueId: string;
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly jours: number;
  readonly boutiquesCount: number;
  readonly relevesSaisis: number;
  readonly alertesCount: number;
  readonly signaturesCount: number;
  readonly pdfBytes: number;
  readonly [key: string]: string | number;
}

function buildAuditMetadata({
  data,
  query,
  pdfByteLength,
}: AuditMetadataArgs): AuditMetadata {
  return {
    boutiqueId: query.boutiqueId ?? 'ALL',
    dateStart: data.periode.dateStart,
    dateEnd: data.periode.dateEnd,
    jours: data.periode.jours,
    boutiquesCount: data.boutiques.length,
    relevesSaisis: data.stats.totalRelevesSaisis,
    alertesCount: data.stats.totalAlertes,
    signaturesCount: data.stats.totalSignatures,
    pdfBytes: pdfByteLength,
  };
}

/**
 * EntityId deterministe (SEC-3) : SHA-1 tronque sur
 * `viewerId|boutiqueId|dateStart|dateEnd`. Permet de regrouper les
 * exports identiques (meme viewer, meme query) en audit log -- utile
 * pour detecter des re-exports anormalement frequents.
 */
function buildEntityId(viewerId: string, query: ExportConsolideQuery): string {
  return createHash('sha1')
    .update(
      `${viewerId}|${query.boutiqueId ?? 'ALL'}|${query.dateStart}|${query.dateEnd}`
    )
    .digest('hex')
    .slice(0, ENTITY_ID_HASH_LENGTH);
}

interface AuditExportArgs {
  readonly viewerId: string;
  readonly data: RegistreConsolide;
  readonly query: ExportConsolideQuery;
  readonly pdfByteLength: number;
}

function buildAuditPayload(args: AuditExportArgs) {
  return {
    action: 'EXPORT_REGISTRE_CONSOLIDE' as const,
    entityType: 'EXPORT' as const,
    entityId: buildEntityId(args.viewerId, args.query),
    entityLabel: `Registre consolide ${args.data.periode.dateStart} -> ${args.data.periode.dateEnd}`,
    performedById: args.viewerId,
    metadata: buildAuditMetadata({
      data: args.data,
      query: args.query,
      pdfByteLength: args.pdfByteLength,
    }),
  };
}

async function auditExport(args: AuditExportArgs): Promise<void> {
  try {
    await logAudit(buildAuditPayload(args));
  } catch (error) {
    logger.error('[/api/exports/registre-consolide] audit log failed', {
      viewerId: args.viewerId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

interface ValidatedRequest {
  readonly viewer: SessionUser;
  readonly query: ExportConsolideQuery;
}

type ValidationOutcome =
  | { readonly kind: 'ok'; readonly value: ValidatedRequest }
  | { readonly kind: 'redirect'; readonly response: NextResponse };

function parseQuery(request: NextRequest): ExportConsolideQuery | NextResponse {
  const cleaned = readCleanedQueryParams(request);
  const parsed = exportConsolideQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    return buildErrorRedirect({ request, errorCode: 'validation' });
  }
  return parsed.data;
}

/**
 * Pipeline pre-service : auth + role + rate-limit + Zod. Retourne soit
 * un `ValidatedRequest` pret a etre execute, soit un `NextResponse`
 * deja construit pour redirection (rate-limit, validation, login).
 *
 * Strict <20L (CC-4) : chaque guard delegue a une primitive existante.
 */
async function validateRequest(
  request: NextRequest
): Promise<ValidationOutcome> {
  const session = await auth();
  if (!session?.user || !canExport(session.user)) {
    return { kind: 'redirect', response: redirectLogin(request) };
  }
  const rateRedirect = await checkRateOrRedirect(request, session.user.id);
  if (rateRedirect) {
    return { kind: 'redirect', response: rateRedirect };
  }
  const queryOrRedirect = parseQuery(request);
  if (queryOrRedirect instanceof NextResponse) {
    return { kind: 'redirect', response: queryOrRedirect };
  }
  return {
    kind: 'ok',
    value: { viewer: session.user, query: queryOrRedirect },
  };
}

function redirectLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/login', request.url), 303);
}

async function checkRateOrRedirect(
  request: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  const rate = await checkRateLimit(
    'EXPORT_REGISTRE_CONSOLIDE',
    `user:${userId}`
  );
  if (rate.allowed) {
    return null;
  }
  const retry = formatRetryAfterEnhanced(rate.retryAfterMs ?? 0);
  return buildErrorRedirect({
    request,
    errorCode: 'rate_limited',
    extra: { retry },
  });
}

function respondWithPdf(pdf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': PDF_MIME_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

interface RenderPdfArgs {
  readonly request: NextRequest;
  readonly data: RegistreConsolide;
  readonly viewerId: string;
}

type RenderPdfResult =
  | { readonly kind: 'ok'; readonly buffer: Buffer }
  | { readonly kind: 'redirect'; readonly response: NextResponse };

async function renderPdfOrRedirect(
  args: RenderPdfArgs
): Promise<RenderPdfResult> {
  try {
    return { kind: 'ok', buffer: await buildRegistreConsolidePdf(args.data) };
  } catch (error) {
    logger.error('[/api/exports/registre-consolide] pdf generation failed', {
      viewerId: args.viewerId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    const response = buildErrorRedirect({
      request: args.request,
      errorCode: 'internal',
    });
    return { kind: 'redirect', response };
  }
}

interface BuildConsolideArgs {
  readonly viewer: SessionUser;
  readonly query: ExportConsolideQuery;
}

async function loadRegistreOrRedirect(
  request: NextRequest,
  args: BuildConsolideArgs
): Promise<RegistreConsolide | NextResponse> {
  const accessibleBoutiqueIds = await getAccessibleBoutiqueIds(args.viewer);
  const result = await buildRegistreConsolide({
    viewer: { id: args.viewer.id, role: args.viewer.role },
    query: args.query,
    accessibleBoutiqueIds,
  });
  if (!result.success) {
    return buildErrorRedirect({
      request,
      errorCode: mapConsolideErrorCode(result.error),
    });
  }
  return result.data;
}

interface FinalizeExportArgs {
  readonly viewer: SessionUser;
  readonly query: ExportConsolideQuery;
  readonly data: RegistreConsolide;
  readonly buffer: Buffer;
}

async function finalizeExport({
  viewer,
  query,
  data,
  buffer,
}: FinalizeExportArgs): Promise<Response> {
  await auditExport({
    viewerId: viewer.id,
    data,
    query,
    pdfByteLength: buffer.byteLength,
  });
  return respondWithPdf(buffer, buildFilename(data));
}

export async function GET(request: NextRequest): Promise<Response> {
  const validation = await validateRequest(request);
  if (validation.kind === 'redirect') {
    return validation.response;
  }
  const { viewer, query } = validation.value;
  const data = await loadRegistreOrRedirect(request, { viewer, query });
  if (data instanceof NextResponse) {
    return data;
  }
  const pdf = await renderPdfOrRedirect({ request, data, viewerId: viewer.id });
  if (pdf.kind === 'redirect') {
    return pdf.response;
  }
  return finalizeExport({ viewer, query, data, buffer: pdf.buffer });
}
