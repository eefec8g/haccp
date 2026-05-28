import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { canExport } from '@/lib/permissions';
import { exportCsvQuerySchema } from '@/lib/validations/export';
import { encodeCsv } from '@/lib/utils/csv-encoder';
import {
  listForExportCsv,
  logExportSuccess,
} from '@/lib/services/export.service';
import { buildCsvFilename } from '@/lib/utils/export-filename';
import { CSV_MIME_TYPE } from '@/lib/constants/export';
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
 * Route Handler GET `/api/exports/csv`.
 *
 * Pattern : le formulaire `ExportConsolideForm` (page
 * `/exports/registre-consolide`) soumet en GET ici via son bouton
 * "Telecharger le CSV" (HTML5 `formAction`). On verifie auth + role +
 * rate-limit + Zod, on appelle le service, on serialise en CSV
 * `;`-separated (BOM UTF-8 inclus par `encodeCsv`) puis on renvoie un
 * `Response` avec `Content-Disposition: attachment` pour que le
 * browser declenche un download natif.
 *
 * En cas d'erreur metier, redirect 303 vers la page consolidee avec un
 * parametre `?error=<code>` que le composant page traduit en message
 * visible. Pas de JSON de retour : la response cible un download de
 * fichier ; un body JSON casserait l'UX (le browser proposerait de
 * sauver `csv?...json`).
 */

const FORM_PATH = '/exports/registre-consolide';

/**
 * Route dynamique : depend de la session + searchParams et regenere
 * le CSV a chaque appel (pas de cache, audit perf m1). Empeche aussi
 * Next.js de tenter une pre-evaluation au build time.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user || !canExport(session.user)) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }

  const rate = await checkRateLimit('EXPORT_CSV', `user:${session.user.id}`);
  if (!rate.allowed) {
    const retryAfter = formatRetryAfterEnhanced(rate.retryAfterMs ?? 0);
    return buildExportErrorRedirect(request, FORM_PATH, 'rate_limited', {
      retry: retryAfter,
    });
  }

  const cleaned = readExportQueryParams(request);
  const parsed = exportCsvQuerySchema.safeParse(cleaned);
  if (!parsed.success) {
    return buildExportErrorRedirect(request, FORM_PATH, 'validation');
  }

  const result = await listForExportCsv({
    viewer: { id: session.user.id, role: session.user.role },
    query: parsed.data,
  });
  if (!result.success) {
    return buildExportErrorRedirect(
      request,
      FORM_PATH,
      mapExportErrorCode(result.error)
    );
  }

  const body = encodeCsv(result.data);
  const filename = buildCsvFilename({
    dateFromISO: parsed.data.dateFrom,
    dateToISO: parsed.data.dateTo,
  });

  try {
    await logExportSuccess({
      viewer: { id: session.user.id, role: session.user.role },
      performedByName: session.user.name ?? session.user.email ?? 'user',
      format: 'CSV',
      rowCount: result.data.length,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      boutiqueId: parsed.data.boutiqueId ?? null,
      equipementId: parsed.data.equipementId ?? null,
    });
  } catch (error) {
    logger.error('[/api/exports/csv] audit log failed', {
      viewerId: session.user.id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': `${CSV_MIME_TYPE}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
