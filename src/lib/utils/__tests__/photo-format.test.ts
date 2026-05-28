import { describe, it, expect } from 'vitest';
import {
  detectImageFormatError,
  HEIC_FORMAT_MESSAGE,
  UNSUPPORTED_FORMAT_MESSAGE,
} from '@/lib/utils/photo-format';

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('[detectImageFormatError]', () => {
  it('should accept JPEG / PNG / WebP', () => {
    expect(detectImageFormatError(makeFile('a.jpg', 'image/jpeg'))).toBeNull();
    expect(detectImageFormatError(makeFile('a.png', 'image/png'))).toBeNull();
    expect(detectImageFormatError(makeFile('a.webp', 'image/webp'))).toBeNull();
  });

  it('should reject HEIC/HEIF by MIME type', () => {
    expect(detectImageFormatError(makeFile('photo.heic', 'image/heic'))).toBe(
      HEIC_FORMAT_MESSAGE
    );
    expect(detectImageFormatError(makeFile('photo.heif', 'image/heif'))).toBe(
      HEIC_FORMAT_MESSAGE
    );
  });

  it('should reject HEIC by extension even when MIME is empty', () => {
    expect(detectImageFormatError(makeFile('IMG_1234.HEIC', ''))).toBe(
      HEIC_FORMAT_MESSAGE
    );
  });

  it('should reject other unsupported MIME types', () => {
    expect(detectImageFormatError(makeFile('a.tiff', 'image/tiff'))).toBe(
      UNSUPPORTED_FORMAT_MESSAGE
    );
    expect(detectImageFormatError(makeFile('a.gif', 'image/gif'))).toBe(
      UNSUPPORTED_FORMAT_MESSAGE
    );
  });

  it('should not reject a file with an empty MIME type (let compression try)', () => {
    expect(detectImageFormatError(makeFile('a.jpg', ''))).toBeNull();
  });
});
