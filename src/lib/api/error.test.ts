import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './error';

describe('[api/error] extractErrorMessage', () => {
  it('should return the message of an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('should return the fallback for non-Error values (string)', () => {
    expect(extractErrorMessage('plain string')).toBe('Une erreur est survenue');
  });

  it('should return the fallback for null / undefined / number', () => {
    expect(extractErrorMessage(null)).toBe('Une erreur est survenue');
    expect(extractErrorMessage(undefined)).toBe('Une erreur est survenue');
    expect(extractErrorMessage(42)).toBe('Une erreur est survenue');
  });

  it('should respect a custom fallback', () => {
    expect(extractErrorMessage('x', 'fallback custom')).toBe('fallback custom');
  });
});
