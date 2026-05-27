import { describe, it, expect } from 'vitest';
import { resolveErrorFromTable } from './error-messages-resolver';

/**
 * Tests du helper `resolveErrorFromTable` (CC-6) -- factorisation des
 * resolveurs d'erreur URL (`export-error-messages.ts` et
 * `export-consolide-error-messages.ts`).
 */

const TABLE: Readonly<Record<'foo' | 'rate_limited' | 'internal', string>> = {
  foo: 'Foo error',
  rate_limited: 'Rate limited',
  internal: 'Internal',
};

describe('[error-messages-resolver] resolveErrorFromTable', () => {
  it('should return undefined when error is undefined', () => {
    expect(
      resolveErrorFromTable(TABLE, undefined, undefined, 'rate_limited')
    ).toBeUndefined();
  });

  it('should resolve a known code to its message', () => {
    expect(resolveErrorFromTable(TABLE, 'foo', undefined, 'rate_limited')).toBe(
      'Foo error'
    );
  });

  it('should fallback to internal for an unknown code', () => {
    expect(
      resolveErrorFromTable(TABLE, 'unknown', undefined, 'rate_limited')
    ).toBe('Internal');
  });

  it('should append "Patientez X." suffix for rateLimitedCode + retry', () => {
    const result = resolveErrorFromTable(
      TABLE,
      'rate_limited',
      '2m',
      'rate_limited'
    );
    expect(result).toBe('Rate limited Patientez 2m.');
  });

  it('should NOT append suffix when retry is missing on rate_limited', () => {
    expect(
      resolveErrorFromTable(TABLE, 'rate_limited', undefined, 'rate_limited')
    ).toBe('Rate limited');
  });

  it('should NOT append suffix when error is not rateLimitedCode', () => {
    expect(resolveErrorFromTable(TABLE, 'foo', '5m', 'rate_limited')).toBe(
      'Foo error'
    );
  });
});
