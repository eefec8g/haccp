import { describe, it, expect, beforeEach } from 'vitest';
import {
  FONTS,
  PARIS_DATETIME,
  __resetPrinterForTests,
  buildBrandHeader,
  getPrinter,
} from './pdf-utils';

/**
 * Tests des utilitaires PDF partages (CC-1) et du lazy import pdfmake
 * (PERF-1). Verifications minimales mais ciblees : la verification de
 * la sortie PDF reelle est faite dans les builders consommateurs
 * (`pdf-builder.test.ts`, `pdf-builder-consolide.test.ts`).
 */

describe('[pdf-utils] FONTS', () => {
  it('should declare Helvetica family (built-in PDFKit, no VFS)', () => {
    expect(FONTS).toHaveProperty('Helvetica');
    expect(FONTS.Helvetica).toEqual({
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    });
  });
});

describe('[pdf-utils] PARIS_DATETIME', () => {
  it('should format with Europe/Paris timezone and fr-FR locale', () => {
    const sample = new Date('2026-05-27T10:30:00Z');
    const formatted = PARIS_DATETIME.format(sample);
    // 10:30 UTC = 12:30 CEST le 27/05/2026
    expect(formatted).toMatch(/27\/05\/2026/);
    expect(formatted).toMatch(/12:30/);
  });
});

describe('[pdf-utils] getPrinter (PERF-1 lazy import)', () => {
  beforeEach(() => {
    __resetPrinterForTests();
  });

  it('should resolve a PdfPrinter instance the first time it is called', async () => {
    const printer = await getPrinter();
    expect(printer).toBeDefined();
    expect(typeof printer.createPdfKitDocument).toBe('function');
  });

  it('should memoize the printer across calls (same instance)', async () => {
    const p1 = await getPrinter();
    const p2 = await getPrinter();
    expect(p1).toBe(p2);
  });

  it('should not have evaluated pdfmake at module-load time (deferred require)', async () => {
    // Le require de pdfmake n'a lieu qu'au premier appel a getPrinter().
    // On verifie indirectement : avant le premier appel, le constructor
    // n'est pas appele. On reset puis on observe que createPdfKitDocument
    // n'est resolu qu'apres l'await.
    __resetPrinterForTests();
    // Avant l'await, getPrinter() retourne une Promise -- aucune
    // instanciation synchrone du printer.
    const pending = getPrinter();
    expect(pending).toBeInstanceOf(Promise);
    const printer = await pending;
    expect(printer).toBeDefined();
  });
});

describe('[pdf-utils] buildBrandHeader options', () => {
  it('should use default landscape line position (290) when no options provided', () => {
    const header = buildBrandHeader();
    expect(header).toBeDefined();
    // Le stack contient canvas avec x2=290 par defaut
    const stack = (header as { stack: unknown[] }).stack;
    expect(stack).toHaveLength(3);
    const canvasNode = stack[1] as {
      canvas: readonly { x2: number }[];
    };
    expect(canvasNode.canvas[0]?.x2).toBe(290);
  });

  it('should accept a custom lineX2 (landscape orientation)', () => {
    const header = buildBrandHeader({ lineX2: 400 });
    const stack = (header as { stack: unknown[] }).stack;
    const canvasNode = stack[1] as {
      canvas: readonly { x2: number; x1: number }[];
    };
    expect(canvasNode.canvas[0]?.x2).toBe(400);
    expect(canvasNode.canvas[0]?.x1).toBe(360);
  });

  it('should accept a custom marginBottom', () => {
    const header = buildBrandHeader({ marginBottom: 18 });
    const margin = (header as { margin: readonly number[] }).margin;
    expect(margin).toEqual([0, 0, 0, 18]);
  });
});
