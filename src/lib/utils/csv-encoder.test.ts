import { describe, expect, it } from 'vitest';
import { encodeCsv, escapeCsvCell } from './csv-encoder';
import { CSV_COLUMNS } from '@/lib/constants/export';
import type { ExportCsvRow } from '@/types/export';

const UTF8_BOM_CODEPOINT = 0xfeff;

function makeRow(overrides: Partial<ExportCsvRow> = {}): ExportCsvRow {
  return {
    date: '2026-05-26',
    creneau: 'MATIN',
    equipementNom: 'CGL-01',
    boutiqueNom: 'MG Paris 11',
    temperature: -18.5,
    seuilMin: -25,
    seuilMax: -18,
    alerteHorsSeuils: false,
    commentaire: null,
    signature: 'Alice Dupont',
    salarieNom: 'Alice Dupont',
    statut: 'ACTIF',
    motifAnnulation: null,
    ...overrides,
  };
}

function stripBom(csv: string): string {
  return csv.charCodeAt(0) === UTF8_BOM_CODEPOINT ? csv.slice(1) : csv;
}

describe('[csv-encoder] encodeCsv', () => {
  it('should prefix the body with a UTF-8 BOM so Excel FR opens it as UTF-8', () => {
    const csv = encodeCsv([]);
    expect(csv.charCodeAt(0)).toBe(UTF8_BOM_CODEPOINT);
  });

  it('should emit headers FR in the order defined by CSV_COLUMNS', () => {
    const csv = encodeCsv([]);
    const firstLine = stripBom(csv).split('\n')[0] ?? '';
    const expectedHeaders = CSV_COLUMNS.map((c) => c.header).join(';');
    expect(firstLine.replace(/\r$/, '')).toBe(expectedHeaders);
  });

  it('should encode a single row with all canonical columns', () => {
    const csv = encodeCsv([makeRow()]);
    expect(csv).toContain(
      '2026-05-26;MATIN;CGL-01;MG Paris 11;-18.5;-25;-18;NON;;Alice Dupont;Alice Dupont;ACTIF;'
    );
  });

  it('should project booleans to OUI / NON labels', () => {
    const csv = encodeCsv([
      makeRow({ alerteHorsSeuils: true }),
      makeRow({ alerteHorsSeuils: false }),
    ]);
    const lines = stripBom(csv).split('\n');
    expect(lines[1]).toContain(';OUI;');
    expect(lines[2]).toContain(';NON;');
  });

  it('should emit empty cells for null and undefined values', () => {
    const csv = encodeCsv([
      makeRow({ commentaire: null, motifAnnulation: null }),
    ]);
    // 13 colonnes -> 12 separateurs ; ;; signifie cellule vide.
    expect(csv).toContain(';;');
  });

  it('should escape semicolons and double quotes inside a cell (RFC 4180)', () => {
    const csv = encodeCsv([
      makeRow({ commentaire: 'porte ouverte ; courant d\'air "leger"' }),
    ]);
    // csv-stringify quote la cellule et double les guillemets.
    expect(csv).toContain('"porte ouverte ; courant d\'air ""leger"""');
  });

  it('should preserve UTF-8 accents in cell content', () => {
    const csv = encodeCsv([
      makeRow({
        equipementNom: 'Congelateur Cafe',
        salarieNom: 'Helene Pereire',
      }),
    ]);
    expect(csv).toContain('Congelateur Cafe');
    expect(csv).toContain('Helene Pereire');
  });

  it('should serialize negative temperatures as decimal numbers without locale conversion', () => {
    const csv = encodeCsv([makeRow({ temperature: -18.5 })]);
    expect(csv).toContain('-18.5');
    expect(csv).not.toContain('-18,5');
  });
});

describe('[csv-encoder] escapeCsvCell (formula injection protection)', () => {
  it.each([
    ['=', '=HYPERLINK("http://evil")'],
    ['+', '+1+cmd|"calc"!A1'],
    ['-', '-2+3'],
    ['@', '@SUM(A1:A10)'],
    ['\\t', '\tmalicious'],
    ['\\r', '\rmalicious'],
  ])(
    'should prefix an apostrophe when the value starts with %s',
    (_label, payload) => {
      const escaped = escapeCsvCell(payload);
      expect(escaped).toBe(`'${payload}`);
    }
  );

  it('should leave a safe string unchanged', () => {
    expect(escapeCsvCell('Porte ouverte')).toBe('Porte ouverte');
    expect(escapeCsvCell('Temperature OK')).toBe('Temperature OK');
  });

  it('should leave an empty string unchanged', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('[csv-encoder] formula injection in encodeCsv output', () => {
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'] as const;

  it.each(dangerousPrefixes)(
    'should neutralize a "%s"-prefixed commentaire',
    (prefix) => {
      // Payload sans `"` ni `;` ni `\n` pour ne pas declencher le quoting
      // RFC 4180 par csv-stringify (qui ne quote pas \t/\r non plus en
      // mode delimiteur `;`), ce qui simplifie l'assertion.
      const payload = `${prefix}HYPERLINK_evil`;
      const csv = encodeCsv([makeRow({ commentaire: payload })]);
      expect(csv).toContain(`;'${payload};`);
    }
  );

  it.each(dangerousPrefixes)(
    'should neutralize a "%s"-prefixed equipementNom',
    (prefix) => {
      const payload = `${prefix}evil_v`;
      const csv = encodeCsv([makeRow({ equipementNom: payload })]);
      expect(csv).toContain(`;'${payload};`);
    }
  );

  it.each(dangerousPrefixes)(
    'should neutralize a "%s"-prefixed salarieNom',
    (prefix) => {
      const payload = `${prefix}evil_v`;
      const csv = encodeCsv([makeRow({ salarieNom: payload })]);
      expect(csv).toContain(`;'${payload};`);
    }
  );

  it('should convert =HYPERLINK(...) into the neutralized variant in the CSV output', () => {
    const csv = encodeCsv([
      makeRow({ commentaire: '=HYPERLINK("http://evil","cliquez")' }),
    ]);
    // La cellule contient `"` donc csv-stringify quote la cellule et
    // double les `"` interieurs (RFC 4180). L'apostrophe reste en tete.
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""cliquez"")"`);
  });

  it('should not prefix a non-string field that happens to start with -', () => {
    // Les temperatures negatives sont des numbers : pas de prefixe.
    const csv = encodeCsv([makeRow({ temperature: -18.5 })]);
    expect(csv).toContain(';-18.5;');
    expect(csv).not.toContain(`;'-18.5;`);
  });
});
