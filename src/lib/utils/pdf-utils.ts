import type { Alignment, Content, TFontDictionary } from 'pdfmake/interfaces';
import type PdfPrinter from 'pdfmake/src/printer';
import {
  PDF_BRAND_NAME,
  PDF_BRAND_TAGLINE,
  PDF_COLOR_NOIR,
  PDF_COLOR_OR,
} from '@/lib/constants/export';

/**
 * Utilitaires PDF partages entre `pdf-builder.ts` (registre journalier)
 * et `pdf-builder-consolide.ts` (registre consolide).
 *
 * Avant cette extraction, chacun des deux builders dupliquait :
 *   - le dictionnaire `FONTS` (Helvetica setup),
 *   - le pattern `cachedPrinter` + `getPrinter()` lazy,
 *   - le formatter `PARIS_DATETIME` (Intl Europe/Paris),
 *   - le builder `buildBrandHeader()` (variations mineures sur l'underline).
 *
 * Clean Code #4 (DRY) -- une seule source de verite pour ces 4 elements.
 *
 * `getPrinter()` reste **lazy** (`await import(...)`) : le constructeur
 * `PdfPrinter` charge les AFM Helvetica via `fs.readFileSync` au top-level,
 * ce qui penalise le cold start des routes important indirectement ce
 * module. Differer le require au premier appel reel ne facture que les
 * requetes qui produisent effectivement un PDF.
 */

export const FONTS: TFontDictionary = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

export const CENTER: Alignment = 'center';

/**
 * Formatter Intl Europe/Paris partage : evite d'instancier 2 fois la
 * meme `Intl.DateTimeFormat` (cout non-trivial sur cold start serverless).
 */
export const PARIS_DATETIME = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

let cachedPrinter: PdfPrinter | null = null;

/**
 * Retourne une instance `PdfPrinter` memoizee. Lazy `await import` :
 * pdfmake ne sera require qu'au premier appel reel a `getPrinter()`,
 * pas a l'import du module. Cold start serverless reduit (audit perf
 * PERF-1).
 */
export async function getPrinter(): Promise<PdfPrinter> {
  if (cachedPrinter === null) {
    const { default: PdfPrinterCtor } = await import('pdfmake/src/printer');
    cachedPrinter = new PdfPrinterCtor(FONTS);
  }
  return cachedPrinter;
}

/**
 * Reinitialise le printer memoize. **Tests uniquement** -- permet de
 * verifier que `getPrinter()` est bien lazy (le module pdfmake ne doit
 * pas etre charge avant le premier appel reel).
 */
export function __resetPrinterForTests(): void {
  cachedPrinter = null;
}

export interface BrandHeaderOptions {
  /** X end de la ligne dorée sous le wordmark (defaut: 290, portrait). */
  readonly lineX2?: number;
  /** Margin bottom du bloc (defaut: 24, portrait). */
  readonly marginBottom?: number;
}

const DEFAULT_LINE_X1 = 250;
const DEFAULT_LINE_X2 = 290;
const DEFAULT_MARGIN_BOTTOM = 24;

/**
 * Bloc d'entete brandee Maison Givre commun aux 2 PDFs.
 *
 * Parametrable (CC-1) : le registre consolide est en orientation
 * landscape (largeur 297mm vs 210mm portrait), il decale la ligne doree
 * pour rester centree. Le margin bottom differe aussi (la mise en page
 * landscape est plus dense).
 */
export function buildBrandHeader(options: BrandHeaderOptions = {}): Content {
  const lineX2 = options.lineX2 ?? DEFAULT_LINE_X2;
  const lineX1 = lineX2 - (DEFAULT_LINE_X2 - DEFAULT_LINE_X1);
  const marginBottom = options.marginBottom ?? DEFAULT_MARGIN_BOTTOM;
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
            x1: lineX1,
            y1: 4,
            x2: lineX2,
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
    margin: [0, 0, 0, marginBottom],
  };
}
