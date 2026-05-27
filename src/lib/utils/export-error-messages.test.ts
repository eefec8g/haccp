import { describe, it, expect } from 'vitest';
import {
  EXPORT_ERROR_MESSAGES,
  resolveExportErrorMessage,
} from './export-error-messages';

describe('[export-error-messages] resolveExportErrorMessage', () => {
  it('should return undefined when no error code provided', () => {
    expect(resolveExportErrorMessage(undefined, undefined)).toBeUndefined();
  });

  it('should return the validation message for code "validation"', () => {
    expect(resolveExportErrorMessage('validation', undefined)).toBe(
      EXPORT_ERROR_MESSAGES.validation
    );
  });

  it('should append retry duration when error is rate_limited and retry provided', () => {
    const message = resolveExportErrorMessage('rate_limited', '2m');
    expect(message).toContain(EXPORT_ERROR_MESSAGES.rate_limited);
    expect(message).toContain('Patientez 2m.');
  });

  it('should return base rate_limited message when retry is missing', () => {
    expect(resolveExportErrorMessage('rate_limited', undefined)).toBe(
      EXPORT_ERROR_MESSAGES.rate_limited
    );
  });

  it('should fallback to internal message for unknown code', () => {
    expect(resolveExportErrorMessage('unknown_code', undefined)).toBe(
      EXPORT_ERROR_MESSAGES.internal
    );
  });

  it('should resolve range_too_large CSV-specific code', () => {
    expect(resolveExportErrorMessage('range_too_large', undefined)).toBe(
      EXPORT_ERROR_MESSAGES.range_too_large
    );
  });

  it('should resolve boutique_not_found code', () => {
    expect(resolveExportErrorMessage('boutique_not_found', undefined)).toBe(
      EXPORT_ERROR_MESSAGES.boutique_not_found
    );
  });
});
