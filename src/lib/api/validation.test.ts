import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { extractFirstValidationError } from './validation';

const sampleSchema = z.object({
  email: z.string().email("L'email est invalide"),
  password: z.string().min(8, 'Le mot de passe est trop court'),
});

describe('[api/validation] extractFirstValidationError', () => {
  it('should return the message of the first ZodIssue', () => {
    const result = sampleSchema.safeParse({
      email: 'not-an-email',
      password: '123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractFirstValidationError(result.error)).toBe(
        "L'email est invalide"
      );
    }
  });

  it('should return the second issue message when only the second field is invalid', () => {
    const result = sampleSchema.safeParse({
      email: 'ok@example.com',
      password: '123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(extractFirstValidationError(result.error)).toBe(
        'Le mot de passe est trop court'
      );
    }
  });

  it('should fallback to a generic FR message when issues array is empty', () => {
    const emptyError = new z.ZodError([]);
    expect(extractFirstValidationError(emptyError)).toBe('Donnees invalides');
  });
});
