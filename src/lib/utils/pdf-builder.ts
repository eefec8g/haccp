import PdfPrinter from 'pdfmake/src/printer';
import type {
  Alignment,
  Content,
  TableCell,
  TDocumentDefinitions,
  TFontDictionary,
} from 'pdfmake/interfaces';
import {
  ALERTE_STATUS_PDF_LABELS,
  CRENEAU_PDF_LABELS,
  PDF_ALERTES_SECTION_TITLE,
  PDF_BRAND_NAME,
  PDF_BRAND_TAGLINE,
  PDF_COLOR_NOIR,
  PDF_COLOR_NOIR_60,
  PDF_COLOR_OR,
  PDF_FOOTER_PREFIX,
  PDF_NO_ALERTES_LABEL,
  PDF_NO_RELEVES_LABEL,
  PDF_SUBTITLE,
  PDF_TITLE,
} from '@/lib/constants/export';
import { formatDateShort } from '@/lib/utils/dates';
import type {
  RegistreJournalier,
  RegistreJournalierAlerteEntry,
  RegistreJournalierRow,
} from '@/types/export';

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

const FONTS: TFontDictionary = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

/**
 * `PdfPrinter` lazifie (audit perf C2) : son constructeur charge les
 * fichiers AFM Helvetica via `fs.readFileSync` au top-level, ce qui
 * penalise le cold start serverless de TOUTE route important ce module
 * (meme indirectement, ex. service unit-test) sans jamais l'utiliser.
 * En differant l'instanciation au premier appel reel, seules les
 * requetes PDF payent le cout d'init.
 */
let cachedPrinter: PdfPrinter | null = null;
function getPrinter(): PdfPrinter {
  if (cachedPrinter === null) {
    cachedPrinter = new PdfPrinter(FONTS);
  }
  return cachedPrinter;
}

const CENTER: Alignment = 'center';

const PARIS_DATETIME = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

function formatTemperatureCell(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return `${value.toFixed(1)} degC`;
}

function buildBrandHeader(): Content {
  return {
    stack: [
      {
        text: PDF_BRAND_NAME,
        fontSize: 16,
        characterSpacing: 4,
        color: PDF_COLOR_NOIR,
        alignment: CENTER,
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 250,
            y1: 4,
            x2: 290,
            y2: 4,
            lineWidth: 1,
            lineColor: PDF_COLOR_OR,
          },
        ],
      },
      {
        text: PDF_BRAND_TAGLINE,
        fontSize: 8,
        characterSpacing: 3,
        color: PDF_COLOR_OR,
        alignment: CENTER,
        margin: [0, 4, 0, 0],
      },
    ],
    margin: [0, 0, 0, 24],
  };
}

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
    text: formatTemperatureCell(entry?.temperature ?? null),
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

function buildDocDefinition(data: RegistreJournalier): TDocumentDefinitions {
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
      buildFooter(data),
    ],
  };
}

export function buildRegistreJournalierPdf(
  data: RegistreJournalier
): Promise<Buffer> {
  const docDefinition = buildDocDefinition(data);
  const pdfDoc = getPrinter().createPdfKitDocument(docDefinition);
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err: Error) => reject(err));
    pdfDoc.end();
  });
}
