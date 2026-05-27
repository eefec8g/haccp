/**
 * Declaration de type minimale pour le sous-module server-side de pdfmake.
 *
 * @types/pdfmake n'expose que l'API browser (createPdf). Pour le server-side
 * (Node / Vercel functions) il faut importer `PdfPrinter` directement depuis
 * `pdfmake/src/printer` qui n'a pas de typings publies. Cette declaration
 * locale capture la surface qu'on utilise (constructor + createPdfKitDocument).
 */
declare module 'pdfmake/src/printer' {
  import type {
    TDocumentDefinitions,
    TFontDictionary,
  } from 'pdfmake/interfaces';

  interface PdfKitDocument {
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    end(): void;
  }

  class PdfPrinter {
    constructor(fonts: TFontDictionary);
    createPdfKitDocument(docDefinition: TDocumentDefinitions): PdfKitDocument;
  }

  export default PdfPrinter;
}
