import { describe, it, expect } from 'vitest';
import { readRequiredString, readOptionalString } from './form-data';

function makeFormData(entries: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

describe('[form-data]', () => {
  describe('readRequiredString', () => {
    it('should return the raw string when present', () => {
      const fd = makeFormData({ email: 'foo@example.com' });
      expect(readRequiredString(fd, 'email')).toBe('foo@example.com');
    });

    it('should return empty string when key is absent', () => {
      const fd = makeFormData({});
      expect(readRequiredString(fd, 'missing')).toBe('');
    });

    it('should return empty string when value is a File', () => {
      const fd = new FormData();
      fd.set('photo', new File(['x'], 'x.txt'));
      expect(readRequiredString(fd, 'photo')).toBe('');
    });

    it('should NOT trim - whitespace is preserved for Zod to handle', () => {
      const fd = makeFormData({ name: '  Jane  ' });
      expect(readRequiredString(fd, 'name')).toBe('  Jane  ');
    });
  });

  describe('readOptionalString', () => {
    it('should return the trimmed string when content is present', () => {
      const fd = makeFormData({ adresse: '  10 rue X  ' });
      expect(readOptionalString(fd, 'adresse')).toBe('10 rue X');
    });

    it('should return undefined when key is absent', () => {
      const fd = makeFormData({});
      expect(readOptionalString(fd, 'missing')).toBeUndefined();
    });

    it('should return undefined when value is only whitespace', () => {
      const fd = makeFormData({ adresse: '   ' });
      expect(readOptionalString(fd, 'adresse')).toBeUndefined();
    });

    it('should return undefined when value is empty', () => {
      const fd = makeFormData({ adresse: '' });
      expect(readOptionalString(fd, 'adresse')).toBeUndefined();
    });

    it('should return undefined when value is a File', () => {
      const fd = new FormData();
      fd.set('photo', new File(['x'], 'x.txt'));
      expect(readOptionalString(fd, 'photo')).toBeUndefined();
    });
  });
});
