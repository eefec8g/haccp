import { describe, it, expect } from 'vitest';
import {
  generateStorageKey,
  isPhotoMimeType,
  sanitizeFilename,
  verifyImageMagicBytes,
} from './photo';

const ALERTE_ID = '11111111-1111-4111-8111-111111111111';

describe('[utils/photo.sanitizeFilename]', () => {
  it('should keep alphanumeric, dot, underscore and dash unchanged', () => {
    expect(sanitizeFilename('photo_2026-05-27.jpg')).toBe(
      'photo_2026-05-27.jpg'
    );
  });

  it('should replace accents and spaces with underscore', () => {
    expect(sanitizeFilename('photo accentuee.jpg')).toBe('photo_accentuee.jpg');
  });

  it('should neutralize path traversal attempts (slashes stripped, dots preserved)', () => {
    // Les `.` font partie du whitelist `[a-zA-Z0-9._-]`, ils sont
    // legitimes dans les noms de fichiers (`.jpg`). En revanche les
    // slashes (`/`) sont neutralises, ce qui suffit a empecher tout
    // path traversal puisque la storageKey est generee SEPAREMENT et
    // n'utilise jamais le filename d'origine.
    expect(sanitizeFilename('../../etc/passwd.jpg')).toBe(
      '.._.._etc_passwd.jpg'
    );
    // Garantit qu'aucun slash ne survit, peu importe le contenu en amont.
    expect(sanitizeFilename('../../etc/passwd.jpg')).not.toContain('/');
  });

  it('should truncate filenames longer than 100 characters', () => {
    const longName = 'a'.repeat(150) + '.jpg';
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBe(100);
  });

  it('should fall back to "photo" when all characters are stripped', () => {
    expect(sanitizeFilename('@@@')).toBe('___');
    expect(sanitizeFilename('')).toBe('photo');
  });
});

describe('[utils/photo.generateStorageKey]', () => {
  it('should generate a key starting with photos/<alerteId>/ and ending with .jpg for image/jpeg', () => {
    const key = generateStorageKey(ALERTE_ID, 'image/jpeg');
    expect(key.startsWith(`photos/${ALERTE_ID}/`)).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
  });

  it('should pick the .png extension for image/png', () => {
    const key = generateStorageKey(ALERTE_ID, 'image/png');
    expect(key.endsWith('.png')).toBe(true);
  });

  it('should pick the .webp extension for image/webp', () => {
    const key = generateStorageKey(ALERTE_ID, 'image/webp');
    expect(key.endsWith('.webp')).toBe(true);
  });

  it('should embed a numeric timestamp and a UUID segment in the key', () => {
    const key = generateStorageKey(ALERTE_ID, 'image/jpeg');
    // photos/<id>/<timestamp>-<uuid>.<ext>
    const segments = key.split('/').at(-1) ?? '';
    const [timestamp, uuidWithExt] = segments.split('-', 2);
    expect(Number.isFinite(Number(timestamp))).toBe(true);
    expect(uuidWithExt).toBeDefined();
  });

  it('should produce different keys for two successive calls', () => {
    const k1 = generateStorageKey(ALERTE_ID, 'image/jpeg');
    const k2 = generateStorageKey(ALERTE_ID, 'image/jpeg');
    expect(k1).not.toBe(k2);
  });
});

describe('[utils/photo.isPhotoMimeType]', () => {
  it('should accept image/jpeg, image/png and image/webp', () => {
    expect(isPhotoMimeType('image/jpeg')).toBe(true);
    expect(isPhotoMimeType('image/png')).toBe(true);
    expect(isPhotoMimeType('image/webp')).toBe(true);
  });

  it('should reject other mime types', () => {
    expect(isPhotoMimeType('image/gif')).toBe(false);
    expect(isPhotoMimeType('application/pdf')).toBe(false);
    expect(isPhotoMimeType('text/plain')).toBe(false);
  });
});

describe('[utils/photo.verifyImageMagicBytes]', () => {
  it('should detect image/jpeg from the 0xFF 0xD8 0xFF prefix', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyImageMagicBytes(jpeg)).toBe('image/jpeg');
  });

  it('should detect image/png from the 8-byte PNG signature', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    expect(verifyImageMagicBytes(png)).toBe('image/png');
  });

  it('should detect image/webp from the RIFF + WEBP signature', () => {
    // "RIFF" (4) + size placeholder (4) + "WEBP" (4) + tail
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x00,
    ]);
    expect(verifyImageMagicBytes(webp)).toBe('image/webp');
  });

  it('should return null for an unknown signature (PDF disguised)', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    expect(verifyImageMagicBytes(pdf)).toBeNull();
  });

  it('should return null when the buffer is too short to match any signature', () => {
    expect(verifyImageMagicBytes(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(verifyImageMagicBytes(new Uint8Array([]))).toBeNull();
  });

  it('should return null for RIFF without WEBP tag (e.g. WAV)', () => {
    // "RIFF" + size + "WAVE" (audio) -> doit etre rejete.
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(verifyImageMagicBytes(wav)).toBeNull();
  });
});
