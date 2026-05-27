import { describe, it, expect } from 'vitest';
import {
  generateStorageKey,
  isPngMimeType,
  sanitizeFilename,
  verifyPngMagicBytes,
} from './signature';

const BOUTIQUE_ID = '11111111-1111-4111-8111-111111111111';
const DATE_ISO = '2026-05-27';

describe('[utils/signature.sanitizeFilename]', () => {
  it('should keep alphanumeric, dot, underscore and dash unchanged', () => {
    expect(sanitizeFilename('signature_2026-05-27.png')).toBe(
      'signature_2026-05-27.png'
    );
  });

  it('should replace spaces with underscore', () => {
    expect(sanitizeFilename('signature jour.png')).toBe('signature_jour.png');
  });

  it('should neutralize path traversal attempts', () => {
    expect(sanitizeFilename('../../etc/passwd.png')).toBe(
      '.._.._etc_passwd.png'
    );
    expect(sanitizeFilename('../../etc/passwd.png')).not.toContain('/');
  });

  it('should truncate filenames longer than 100 characters', () => {
    const longName = 'a'.repeat(150) + '.png';
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBe(100);
  });

  it('should fall back to "signature" when name is empty', () => {
    expect(sanitizeFilename('')).toBe('signature');
  });
});

describe('[utils/signature.generateStorageKey]', () => {
  it('should generate a key starting with signatures/<boutiqueId>/<dateISO>/ and ending with .png', () => {
    const key = generateStorageKey({
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });
    expect(key.startsWith(`signatures/${BOUTIQUE_ID}/${DATE_ISO}/`)).toBe(true);
    expect(key.endsWith('.png')).toBe(true);
  });

  it('should embed a numeric timestamp and a UUID segment in the key', () => {
    const key = generateStorageKey({
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });
    const fileSegment = key.split('/').at(-1) ?? '';
    const [timestamp, uuidWithExt] = fileSegment.split('-', 2);
    expect(Number.isFinite(Number(timestamp))).toBe(true);
    expect(uuidWithExt).toBeDefined();
  });

  it('should produce different keys for two successive calls', () => {
    const k1 = generateStorageKey({
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });
    const k2 = generateStorageKey({
      boutiqueId: BOUTIQUE_ID,
      dateISO: DATE_ISO,
    });
    expect(k1).not.toBe(k2);
  });
});

describe('[utils/signature.isPngMimeType]', () => {
  it('should accept only image/png', () => {
    expect(isPngMimeType('image/png')).toBe(true);
  });

  it('should reject other image MIME types', () => {
    expect(isPngMimeType('image/jpeg')).toBe(false);
    expect(isPngMimeType('image/webp')).toBe(false);
    expect(isPngMimeType('image/gif')).toBe(false);
    expect(isPngMimeType('application/pdf')).toBe(false);
  });
});

describe('[utils/signature.verifyPngMagicBytes]', () => {
  it('should accept a buffer starting with the PNG signature', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(verifyPngMagicBytes(png)).toBe(true);
  });

  it('should reject a buffer with a JPEG signature', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyPngMagicBytes(jpeg)).toBe(false);
  });

  it('should reject a buffer shorter than the PNG signature', () => {
    expect(
      verifyPngMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))
    ).toBe(false);
    expect(verifyPngMagicBytes(new Uint8Array([]))).toBe(false);
  });

  it('should reject a buffer with a partial PNG signature (last byte wrong)', () => {
    const almost = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0xff,
    ]);
    expect(verifyPngMagicBytes(almost)).toBe(false);
  });

  it('should reject a PDF disguised as PNG', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(verifyPngMagicBytes(pdf)).toBe(false);
  });
});
