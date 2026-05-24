import { describe, it, expect } from 'vitest';
import { sanitizeCallbackUrl } from './sanitize-callback-url';

describe('[sanitizeCallbackUrl]', () => {
  describe('falsy inputs', () => {
    it('should return null when input is null', () => {
      expect(sanitizeCallbackUrl(null)).toBeNull();
    });

    it('should return null when input is undefined', () => {
      expect(sanitizeCallbackUrl(undefined)).toBeNull();
    });

    it('should return null when input is an empty string', () => {
      expect(sanitizeCallbackUrl('')).toBeNull();
    });
  });

  describe('open-redirect protection', () => {
    it('should return null for an absolute https URL', () => {
      expect(sanitizeCallbackUrl('https://evil.com')).toBeNull();
    });

    it('should return null for an absolute http URL', () => {
      expect(sanitizeCallbackUrl('http://localhost:3000/admin')).toBeNull();
    });

    it('should return null for a protocol-relative URL (//evil.com)', () => {
      expect(sanitizeCallbackUrl('//evil.com')).toBeNull();
    });

    it('should return null for a protocol-relative URL with a path', () => {
      expect(sanitizeCallbackUrl('//evil.com/releves')).toBeNull();
    });

    it('should return null for a backslash trick (/\\evil.com)', () => {
      expect(sanitizeCallbackUrl('/\\evil.com')).toBeNull();
    });

    it('should return null when input does not start with a slash', () => {
      expect(sanitizeCallbackUrl('releves')).toBeNull();
    });

    it('should return null for a javascript: scheme attempt', () => {
      expect(sanitizeCallbackUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('login loop protection', () => {
    it('should return null when the path is exactly /login (anti-loop)', () => {
      expect(sanitizeCallbackUrl('/login')).toBeNull();
    });

    it('should return null when the path is /login with a query string', () => {
      expect(sanitizeCallbackUrl('/login?callbackUrl=/releves')).toBeNull();
    });
  });

  describe('length guard', () => {
    it('should return null when the path exceeds 500 characters', () => {
      const tooLong = '/' + 'a'.repeat(500);
      expect(sanitizeCallbackUrl(tooLong)).toBeNull();
    });

    it('should accept a path of exactly 500 characters', () => {
      const exact = '/' + 'a'.repeat(499);
      expect(sanitizeCallbackUrl(exact)).toBe(exact);
    });
  });

  describe('valid internal paths', () => {
    it('should return the path unchanged for a simple internal path', () => {
      expect(sanitizeCallbackUrl('/releves')).toBe('/releves');
    });

    it('should return the root path unchanged', () => {
      expect(sanitizeCallbackUrl('/')).toBe('/');
    });

    it('should preserve query strings on valid internal paths', () => {
      expect(sanitizeCallbackUrl('/releves?id=1&date=today')).toBe(
        '/releves?id=1&date=today'
      );
    });

    it('should preserve fragments on valid internal paths', () => {
      expect(sanitizeCallbackUrl('/releves#section')).toBe('/releves#section');
    });

    it('should accept nested admin paths', () => {
      expect(sanitizeCallbackUrl('/admin/users/42')).toBe('/admin/users/42');
    });
  });
});
