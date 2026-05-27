import { describe, it, expect } from 'vitest';
import { signatureUploadSchema } from './signature';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

describe('[validations/signature.signatureUploadSchema]', () => {
  it('should accept a valid boutiqueId UUID + ISO date', () => {
    const result = signatureUploadSchema.safeParse({
      boutiqueId: VALID_UUID,
      dateISO: '2026-05-27',
    });
    expect(result.success).toBe(true);
  });

  it('should reject when boutiqueId is not a UUID', () => {
    const result = signatureUploadSchema.safeParse({
      boutiqueId: 'not-a-uuid',
      dateISO: '2026-05-27',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.boutiqueId).toBeDefined();
    }
  });

  it('should reject when dateISO is missing', () => {
    const result = signatureUploadSchema.safeParse({
      boutiqueId: VALID_UUID,
    });
    expect(result.success).toBe(false);
  });

  it('should reject when dateISO does not match YYYY-MM-DD', () => {
    const result = signatureUploadSchema.safeParse({
      boutiqueId: VALID_UUID,
      dateISO: '27/05/2026',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dateISO).toBeDefined();
    }
  });

  it('should reject when dateISO is an empty string', () => {
    const result = signatureUploadSchema.safeParse({
      boutiqueId: VALID_UUID,
      dateISO: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject when boutiqueId is missing', () => {
    const result = signatureUploadSchema.safeParse({
      dateISO: '2026-05-27',
    });
    expect(result.success).toBe(false);
  });
});
