import { describe, it, expect } from 'vitest';
import { photoUploadSchema, photoDeleteSchema } from './photo';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ANOTHER_UUID = '22222222-2222-4222-8222-222222222222';

describe('[validations/photo.photoUploadSchema]', () => {
  it('should accept a valid alerteId UUID', () => {
    const result = photoUploadSchema.safeParse({ alerteId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('should reject when alerteId is not a UUID', () => {
    const result = photoUploadSchema.safeParse({ alerteId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.alerteId).toBeDefined();
    }
  });

  it('should reject when alerteId is missing', () => {
    const result = photoUploadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('[validations/photo.photoDeleteSchema]', () => {
  it('should accept valid photoId and alerteId UUIDs', () => {
    const result = photoDeleteSchema.safeParse({
      photoId: VALID_UUID,
      alerteId: ANOTHER_UUID,
    });
    expect(result.success).toBe(true);
  });

  it('should reject when photoId is not a UUID', () => {
    const result = photoDeleteSchema.safeParse({
      photoId: 'invalid',
      alerteId: ANOTHER_UUID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.photoId).toBeDefined();
    }
  });

  it('should reject when alerteId is missing', () => {
    const result = photoDeleteSchema.safeParse({ photoId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.alerteId).toBeDefined();
    }
  });
});
