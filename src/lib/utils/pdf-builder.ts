import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import {
  ALERTE_STATUS_PDF_LABELS,
  CRENEAU_PDF_LABELS,
  PDF_ALERTES_SECTION_TITLE,
  PDF_COLOR_NOIR,
  PDF_COLOR_NOIR_60,
  PDF_COLOR_OR,
  PDF_FOOTER_PREFIX,
  PDF_NO_ALERTES_LABEL,
  PDF_NO_RELEVES_LABEL,
  PDF_SIGNATURE_NOT_SIGNED,
  PDF_SIGNATURE_PREFIX,
  PDF_SIGNATURE_SECTION_TITLE,
  PDF_SIGNATURE_UNAVAILABLE,
  PDF_SUBTITLE,
  PDF_TITLE,
} from '@/lib/constants/export';
import { formatDateShort } from '@/lib/utils/dates';
import { formatTemperature } from '@/lib/utils/format-temperature';
import { logger } from '@/lib/logger';
import type {
  RegistreJournalier,
  RegistreJournalierAlerteEntry,
  RegistreJournalierForExport,
  RegistreJournalierRow,
  RegistreJournalierSignature,
} from '@/types/export';
import {
  ALLOWED_SIGNATURE_BLOB_HOST_SUFFIX,
  MAX_SIGNATURE_BYTES,
  SIGNATURE_FETCH_TIMEOUT_MS,
  SIGNATURE_MIME,
} from '@/lib/constants/signature';
import { verifyPngMagicBytes } from '@/lib/utils/signature';
import {
  CENTER,
  PARIS_DATETIME,
  buildBrandHeader,
  getPrinter,
} from '@/lib/utils/pdf-utils';

/**
 * Generateur PDF "Registre journalier HACCP" via pdfmake (server-side).
 *
 * Pourquoi pdfmake et pas puppeteer ?
 *   - Pure JS (pas de chrome a embarquer) -> serverless Vercel OK.
 *   - API declarative JSON : doc definition stable et testable.
 *
 * Fonts standards Helvetica (PDFKit built-in, sans VFS) :
 *   - Pas de fichier `.ttf` a embarquer => bundle minimal.
 *   - Cold start serverless reduit.
 *   - Charte Maison Givre conservee via couleurs (noir + or) + letter-
 *     spacing dans le wordmark (pas de Montserrat embarque).
 *
 * Le buffer PDF est retourne complet (cout borne par 1 boutique x N
 * equipements x 3 creneaux + alertes du jour, generation < 1 sec sur
 * Vercel Node 20).
 */

function buildTitleBlock(data: RegistreJournalier): Content {
  return {
    stack: [
      {
        text: PDF_TITLE,
        fontSize: 14,
        bold: true,
        characterSpacing: 3,
        color: PDF_COLOR_NOIR,
        alignment: CENTER,
      },
      {
        text: PDF_SUBTITLE,
        fontSize: 9,
        color: PDF_COLOR_NOIR_60,
        alignment: CENTER,
        margin: [0, 4, 0, 12],
      },
      {
        text: formatDateShort(data.dateISO),
        fontSize: 11,
        bold: true,
        color: PDF_COLOR_NOIR,
        alignment: CENTER,
      },
    ],
    margin: [0, 0, 0, 16],
  };
}

function buildBoutiqueBlock(boutique: RegistreJournalier['boutique']): Content {
  const addressParts = [boutique.adresse, boutique.ville].filter(
    (part): part is string => !!part && part.length > 0
  );
  return {
    stack: [
      {
        text: boutique.nom,
        fontSize: 12,
        bold: true,
        color: PDF_COLOR_NOIR,
      },
      addressParts.length > 0
        ? {
            text: addressParts.join(' - '),
            fontSize: 9,
            color: PDF_COLOR_NOIR_60,
            margin: [0, 2, 0, 0],
          }
        : { text: '' },
    ],
    margin: [0, 0, 0, 16],
  };
}

function buildCreneauCell(
  creneaux: readonly {
    creneau: string;
    temperature: number | null;
    alerteHorsSeuils: boolean;
  }[],
  slot: 'MATIN' | 'MIDI' | 'SOIR'
): TableCell {
  const entry = creneaux.find((c) => c.creneau === slot);
  return {
    text: formatTemperature(entry?.temperature ?? null, '-'),
    fontSize: 9,
    alignment: CENTER,
    color: entry?.alerteHorsSeuils ? PDF_COLOR_OR : PDF_COLOR_NOIR,
    bold: !!entry?.alerteHorsSeuils,
  };
}

function buildEquipementsTable(
  rows: readonly RegistreJournalierRow[]
): Content {
  if (rows.length === 0) {
    return {
      text: PDF_NO_RELEVES_LABEL,
      fontSize: 10,
      italics: true,
      color: PDF_COLOR_NOIR_60,
      margin: [0, 0, 0, 16],
    };
  }
  const headerRow: TableCell[] = [
    { text: 'Equipement', bold: true, fontSize: 9 },
    { text: 'Seuils (degC)', bold: true, fontSize: 9 },
    {
      text: CRENEAU_PDF_LABELS.MATIN,
      bold: true,
      fontSize: 9,
      alignment: CENTER,
    },
    {
      text: CRENEAU_PDF_LABELS.MIDI,
      bold: true,
      fontSize: 9,
      alignment: CENTER,
    },
    {
      text: CRENEAU_PDF_LABELS.SOIR,
      bold: true,
      fontSize: 9,
      alignment: CENTER,
    },
  ];
  const dataRows: TableCell[][] = rows.map((row) => [
    { text: row.equipementNom, fontSize: 9 },
    {
      text: `${row.seuilMin.toFixed(1)} / ${row.seuilMax.toFixed(1)}`,
      fontSize: 9,
    },
    buildCreneauCell(row.creneaux, 'MATIN'),
    buildCreneauCell(row.creneaux, 'MIDI'),
    buildCreneauCell(row.creneaux, 'SOIR'),
  ]);
  return {
    table: {
      headerRows: 1,
      widths: ['*', 80, 60, 60, 60],
      body: [headerRow, ...dataRows],
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 16],
  };
}

function buildAlerteItem(alerte: RegistreJournalierAlerteEntry): Content {
  const detailLines: string[] = [
    `${alerte.equipementNom} - ${CRENEAU_PDF_LABELS[alerte.creneau]} - ${alerte.temperature.toFixed(1)} degC (seuils ${alerte.seuilMin.toFixed(1)} / ${alerte.seuilMax.toFixed(1)})`,
    `Statut : ${ALERTE_STATUS_PDF_LABELS[alerte.status]}`,
  ];
  if (alerte.status === 'RESOLUE' && alerte.commentaireResolution) {
    const resolveLine = alerte.resoluParNom
      ? `Resolu par ${alerte.resoluParNom} : ${alerte.commentaireResolution}`
      : `Resolution : ${alerte.commentaireResolution}`;
    detailLines.push(resolveLine);
  }
  return {
    stack: detailLines.map((line) => ({
      text: line,
      fontSize: 9,
      color: PDF_COLOR_NOIR,
      margin: [0, 2, 0, 0],
    })),
    margin: [0, 0, 0, 8],
  };
}

function buildAlertesSection(
  alertes: readonly RegistreJournalierAlerteEntry[]
): Content {
  return {
    stack: [
      {
        text: PDF_ALERTES_SECTION_TITLE,
        fontSize: 11,
        bold: true,
        color: PDF_COLOR_NOIR,
        margin: [0, 0, 0, 8],
      },
      alertes.length === 0
        ? {
            text: PDF_NO_ALERTES_LABEL,
            fontSize: 9,
            italics: true,
            color: PDF_COLOR_NOIR_60,
          }
        : { stack: alertes.map((alerte) => buildAlerteItem(alerte)) },
    ],
    margin: [0, 0, 0, 24],
  };
}

function buildFooter(data: RegistreJournalier): Content {
  const generatedAt = PARIS_DATETIME.format(data.generatedAt);
  return {
    text: `${PDF_FOOTER_PREFIX} ${data.generatedBy.nom} (${data.generatedBy.role}) le ${generatedAt} (Europe/Paris)`,
    fontSize: 8,
    italics: true,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
  };
}

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const SIGNATURE_IMAGE_MAX_WIDTH = 220;

/**
 * Verifie que `url` cible le storage Vercel Blob via HTTPS (SSRF +
 * downgrade protection). Refuse :
 *   - tout protocol != `https:` (defense en profondeur : un blob HTTP
 *     ne devrait jamais exister mais l'allowlist hostname seule
 *     n'empecherait pas un MITM en clair) ;
 *   - tout hostname dont le suffixe ne correspond pas au domaine
 *     Vercel Blob attendu.
 */
function isAllowedBlobHost(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.hostname.endsWith(ALLOWED_SIGNATURE_BLOB_HOST_SUFFIX)
  );
}

/**
 * Parse une URL utilisateur en toute securite. Retourne `null` si la
 * chaine n'est pas une URL valide (caller affichera "Signature
 * indisponible").
 */
function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Verifie les en-tetes HTTP avant de telecharger le payload :
 *   - `Content-Type` doit commencer par `image/png` (accept charset).
 *   - `Content-Length` doit etre present et <= MAX_SIGNATURE_BYTES (DoS).
 *
 * Defense en profondeur AVANT le `arrayBuffer()` pour ne pas charger en
 * memoire un payload potentiellement abusif.
 */
function isValidSignatureResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.startsWith(SIGNATURE_MIME)) {
    return false;
  }
  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    return false;
  }
  const size = Number.parseInt(contentLength, 10);
  return Number.isFinite(size) && size > 0 && size <= MAX_SIGNATURE_BYTES;
}

/**
 * Filtre la `Response` : `ok` + en-tetes coherents (content-type PNG +
 * content-length <= MAX). Tout echec -> `null` + warn log.
 */
function ensureValidResponse(response: Response): Response | null {
  if (!response.ok) {
    logger.warn('[pdf-builder] signature fetch non-200', {
      status: response.status,
    });
    return null;
  }
  if (!isValidSignatureResponse(response)) {
    logger.warn('[pdf-builder] signature response headers invalid');
    return null;
  }
  return response;
}

/**
 * Options fetch communes a tout `fetchWithTimeout` :
 *   - `cache: 'force-cache'` : signatures immuables (premier verrouille).
 *     Reduit la latence des re-exports PDF (audit perf Mi-1).
 *   - `redirect: 'error'` : court-circuite l'allowlist hostname si le
 *     serveur Blob retournait un `Location:` vers une origine arbitraire
 *     (defense en profondeur SSRF).
 */
const SIGNATURE_FETCH_INIT: Pick<RequestInit, 'cache' | 'redirect'> = {
  cache: 'force-cache',
  redirect: 'error',
};

/**
 * Wrapper SRP : exec d'un fetch protege par AbortController. Garantit
 * que le timer est nettoye meme si `executor` rejette (`finally`).
 */
async function withFetchTimeout(
  executor: (signal: AbortSignal) => Promise<Response>
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SIGNATURE_FETCH_TIMEOUT_MS
  );
  try {
    return await executor(controller.signal);
  } catch (error) {
    logger.warn('[pdf-builder] signature fetch failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fetchWithTimeout(url: string): Promise<Response | null> {
  return withFetchTimeout((signal) =>
    fetch(url, { signal, ...SIGNATURE_FETCH_INIT })
  );
}

async function fetchSignaturePayload(url: string): Promise<Response | null> {
  const parsed = parseUrl(url);
  if (!parsed || !isAllowedBlobHost(parsed)) {
    logger.warn('[pdf-builder] signature host not allowed');
    return null;
  }
  const response = await fetchWithTimeout(url);
  if (!response) {
    return null;
  }
  return ensureValidResponse(response);
}

/**
 * Charge l'image de signature en data URL base64 pour pdfmake.
 *
 * Defense en profondeur :
 *   1. Allowlist hostname (`.public.blob.vercel-storage.com`) + protocol
 *      `https:` obligatoire -- bloque tout SSRF / downgrade HTTP.
 *   2. `redirect: 'error'` -- empeche l'allowlist d'etre court-circuitee
 *      par un `Location:` du serveur Blob vers une origine arbitraire.
 *   3. `Content-Type` declare doit etre `image/png` (rejet sinon).
 *   4. `Content-Length` declare doit etre <= MAX_SIGNATURE_BYTES (rejet
 *      sinon -- DoS memoire).
 *   5. Magic bytes PNG verifies APRES telechargement (rejet sinon).
 *   6. AbortController 5 s + try/catch global.
 *
 * Cache : `cache: 'force-cache'` -- signatures immuables (premier
 * verrouille). Reduit la latence des re-exports PDF.
 *
 * Echec : retourne `null` (le caller affichera "Signature indisponible").
 * Aucune exception ne fuit (le PDF doit toujours etre genere meme si la
 * signature est inaccessible).
 */
export async function fetchSignatureImage(url: string): Promise<string | null> {
  const response = await fetchSignaturePayload(url);
  if (!response) {
    return null;
  }
  try {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!verifyPngMagicBytes(new Uint8Array(buffer))) {
      logger.warn('[pdf-builder] signature magic bytes invalid');
      return null;
    }
    return `${PNG_DATA_URL_PREFIX}${buffer.toString('base64')}`;
  } catch (error) {
    logger.warn('[pdf-builder] signature decode failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

interface SignatureFooterArgs {
  readonly signature: RegistreJournalierSignature | null;
  readonly imageDataUrl: string | null;
}

function buildSignatureCaption(signature: RegistreJournalierSignature): string {
  const signedAt = PARIS_DATETIME.format(signature.signedAt);
  return `${PDF_SIGNATURE_PREFIX} ${signature.signataireName} (${signature.signataireRoleSnapshot}) le ${signedAt} (Europe/Paris)`;
}

function buildNotSignedFooter(): Content {
  return {
    text: PDF_SIGNATURE_NOT_SIGNED,
    fontSize: 9,
    italics: true,
    color: PDF_COLOR_NOIR_60,
    alignment: CENTER,
    margin: [0, 0, 0, 12],
  };
}

function buildSectionTitle(): Content {
  return {
    text: PDF_SIGNATURE_SECTION_TITLE,
    fontSize: 10,
    bold: true,
    color: PDF_COLOR_NOIR,
    margin: [0, 0, 0, 4],
  };
}

function buildCaptionLine(
  signature: RegistreJournalierSignature,
  marginTop = 0
): Content {
  return {
    text: buildSignatureCaption(signature),
    fontSize: 8,
    color: PDF_COLOR_NOIR_60,
    margin: [0, marginTop, 0, 0],
  };
}

function buildUnavailableFooter(
  signature: RegistreJournalierSignature
): Content {
  return {
    stack: [
      buildSectionTitle(),
      {
        text: PDF_SIGNATURE_UNAVAILABLE,
        fontSize: 9,
        italics: true,
        color: PDF_COLOR_NOIR_60,
      },
      buildCaptionLine(signature, 4),
    ],
    margin: [0, 0, 0, 12],
  };
}

function buildSignedFooter(
  signature: RegistreJournalierSignature,
  imageDataUrl: string
): Content {
  return {
    stack: [
      buildSectionTitle(),
      {
        image: imageDataUrl,
        width: SIGNATURE_IMAGE_MAX_WIDTH,
        margin: [0, 0, 0, 4],
      },
      buildCaptionLine(signature),
    ],
    margin: [0, 0, 0, 12],
  };
}

/**
 * Construit le bloc PDF de signature en pied du registre. Simple
 * dispatcher entre 3 builders dedies (un par etat).
 *
 *   - Sans signature : pied de page italic "Registre non signe.".
 *   - Avec signature mais fetch a echoue : mention "Signature
 *     indisponible." (audit DDPP : on trace l'intention mais pas l'image).
 *   - Avec image : titre + image (max 220 px de large) + caption
 *     "Signe par X (ROLE) le DATE (Europe/Paris)".
 */
export function buildSignatureFooter({
  signature,
  imageDataUrl,
}: SignatureFooterArgs): Content {
  if (!signature) {
    return buildNotSignedFooter();
  }
  if (!imageDataUrl) {
    return buildUnavailableFooter(signature);
  }
  return buildSignedFooter(signature, imageDataUrl);
}

interface DocDefinitionArgs {
  readonly data: RegistreJournalierForExport;
  readonly signatureImageDataUrl: string | null;
}

function buildDocDefinition({
  data,
  signatureImageDataUrl,
}: DocDefinitionArgs): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: PDF_COLOR_NOIR },
    content: [
      buildBrandHeader(),
      buildTitleBlock(data),
      buildBoutiqueBlock(data.boutique),
      buildEquipementsTable(data.equipements),
      buildAlertesSection(data.alertes),
      buildSignatureFooter({
        signature: data.signature,
        imageDataUrl: signatureImageDataUrl,
      }),
      buildFooter(data),
    ],
  };
}

async function resolveSignatureImage(
  signature: RegistreJournalierSignature | null
): Promise<string | null> {
  if (!signature) {
    return null;
  }
  return fetchSignatureImage(signature.imageUrl);
}

export async function buildRegistreJournalierPdf(
  data: RegistreJournalierForExport
): Promise<Buffer> {
  const signatureImageDataUrl = await resolveSignatureImage(data.signature);
  const docDefinition = buildDocDefinition({ data, signatureImageDataUrl });
  const printer = await getPrinter();
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err: Error) => reject(err));
    pdfDoc.end();
  });
}
