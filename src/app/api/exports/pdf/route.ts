import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canExport } from '@/lib/permissions';
import { exportPdfQuerySchema } from '@/lib/validations/export';
import { buildRegistreJournalierPdf } from '@/lib/utils/pdf-builder';
import {
  buildRegistreJournalier,
  logExportSuccess,
} from '@/lib/services/export.service';
import { buildPdfFilename } from '@/lib/utils/export-filename';
import { PDF_MIME_TYPE } from '@/lib/constants/export';
import {
  checkRateLimit,
  formatRetryAfterEnhanced,
} from '@/lib/services/rateLimit';
import { logger } from '@/lib/logger';
import {
  buildExportErrorRedirect,
  mapExportErrorCode,
  readExportQueryParams,
} from '@/lib/utils/export-route';

/**
 * Route Handler GET `/api/exports/pdf`.
 *
 * Genere un registre journalier PDF (US-EXP-002) pour 1 jour x 1 boutique.
 * Memes pipeline que `/api/exports/csv` : auth + role + rate-limit Zod
 * + service + log audit + download natif via Content-Disposition.
 *
 * Le PDF est genere a la volee (pdfmake, fonts Helvetica embarquees
 * dans pdfkit), pas de cache serveur (conservation legale = zero).
 */

const FORM_PATH = '/releves/registre';

/**
 * Route dynamique : depend de la session et regenere le PDF a chaque
 * appel (pas de cache serveur, cf. decisions Phase 0). Empeche aussi
 * Next.js de tenter une pre-evaluation de pdfmake au build time.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user || !canExport(session.user)) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  const rate = await checkRateLimit('EXPORT_PDF', `user:${session.user.id}`);
  if (!rate.allowed) {
    const retryAfter = formatRetryAfterEnhanced(rate.retryAfterMs ?? 0);
    return buildExportErrorRedirect(request, FORM_PATH, 'rate_limited', {
      retry: retryAfter,
    });
  }

  const cleaned = readExportQueryParams(request);
  const parsed = exportPdfQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    return buildExportErrorRedirect(request, FORM_PATH, 'validation');
  }

  const performedByName = session.user.name ?? session.user.email ?? 'user';
  const result = await buildRegistreJournalier({
    viewer: { id: session.user.id, role: session.user.role },
    query: parsed.data,
    performedByName,
    performedByRole: session.user.role,
  });
  if (!result.success) {
    return buildExportErrorRedirect(
      request,
      FORM_PATH,
      mapExportErrorCode(result.error)
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildRegistreJournalierPdf(result.data);
  } catch (error) {
    logger.error('[/api/exports/pdf] pdf generation failed', {
      viewerId: session.user.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return buildExportErrorRedirect(request, FORM_PATH, 'internal');
  }

  const filename = buildPdfFilename(parsed.data.date, result.data.boutique.nom);
  const rowCount = result.data.equipements.length;

  try {
    await logExportSuccess({
      viewer: { id: session.user.id, role: session.user.role },
      performedByName,
      format: 'PDF',
      rowCount,
      dateFrom: parsed.data.date,
      dateTo: parsed.data.date,
      boutiqueId: parsed.data.boutiqueId,
    });
  } catch (error) {
    logger.error('[/api/exports/pdf] audit log failed', {
      viewerId: session.user.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': PDF_MIME_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
