import { describe, it, expect } from 'vitest';
import { isNextRedirectError } from './next-errors';

function makeRedirectError(digest: string): Error & { digest: string } {
  const error = new Error('NEXT_REDIRECT') as Error & { digest: string };
  error.digest = digest;
  return error;
}

describe('[isNextRedirectError]', () => {
  it('should return true for an Error with a digest starting with "NEXT_REDIRECT"', () => {
    expect(
      isNextRedirectError(
        makeRedirectError('NEXT_REDIRECT;replace;/login;307;')
      )
    ).toBe(true);
  });

  it('should return false for a regular Error without digest', () => {
    expect(isNextRedirectError(new Error('some other error'))).toBe(false);
  });

  it('should return false for an Error with a digest that does not start with NEXT_REDIRECT', () => {
    expect(isNextRedirectError(makeRedirectError('NEXT_NOT_FOUND;...'))).toBe(
      false
    );
  });

  it('should return false for non-Error values (string, null, undefined, object)', () => {
    expect(isNextRedirectError('NEXT_REDIRECT')).toBe(false);
    expect(isNextRedirectError(null)).toBe(false);
    expect(isNextRedirectError(undefined)).toBe(false);
    expect(isNextRedirectError({ digest: 'NEXT_REDIRECT;...' })).toBe(false);
  });
});
