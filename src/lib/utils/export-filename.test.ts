import { describe, expect, it } from 'vitest';
import { buildCsvFilename, buildPdfFilename } from './export-filename';

describe('[export-filename] buildCsvFilename', () => {
  it('should build CSV filename with compact YYYYMMDD bounds', () => {
    const filename = buildCsvFilename({
      dateFromISO: '2026-05-01',
      dateToISO: '2026-05-26',
    });
    expect(filename).toBe('haccp_releves_20260501_20260526.csv');
  });

  it('should support single-day range (from == to)', () => {
    const filename = buildCsvFilename({
      dateFromISO: '2026-05-26',
      dateToISO: '2026-05-26',
    });
    expect(filename).toBe('haccp_releves_20260526_20260526.csv');
  });
});

describe('[export-filename] buildPdfFilename', () => {
  it('should build PDF filename with ISO date and slugified boutique', () => {
    const filename = buildPdfFilename('2026-05-26', 'MG Paris 11');
    expect(filename).toBe('haccp_registre_2026-05-26_mg-paris-11.pdf');
  });

  it('should remove accents from boutique name (NFD + diacritics strip)', () => {
    const filename = buildPdfFilename(
      '2026-05-26',
      'Boutique Cafe Crepes Heros'
    );
    expect(filename).toBe(
      'haccp_registre_2026-05-26_boutique-cafe-crepes-heros.pdf'
    );
  });

  it('should collapse symbols and punctuation into single dashes', () => {
    const filename = buildPdfFilename(
      '2026-05-26',
      "L'Atelier @ Maison-Givre / Paris!"
    );
    expect(filename).toBe(
      'haccp_registre_2026-05-26_l-atelier-maison-givre-paris.pdf'
    );
  });

  it('should truncate very long boutique names to keep filename usable', () => {
    const longName = 'A'.repeat(120);
    const filename = buildPdfFilename('2026-05-26', longName);
    const slugPart = filename
      .replace('haccp_registre_2026-05-26_', '')
      .replace('.pdf', '');
    expect(slugPart.length).toBeLessThanOrEqual(60);
    expect(slugPart).toBe('a'.repeat(60));
  });

  it('should produce an empty slug for boutique name with only symbols', () => {
    const filename = buildPdfFilename('2026-05-26', '!!! ??? ...');
    expect(filename).toBe('haccp_registre_2026-05-26_.pdf');
  });
});
