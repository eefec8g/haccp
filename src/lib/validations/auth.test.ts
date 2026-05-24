import { describe, it, expect } from 'vitest';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

const VALID_STRONG_PASSWORD = 'StrongPass1!aZ';
const VALID_TOKEN = 'a'.repeat(43);

describe('[auth validations]', () => {
  describe('loginSchema', () => {
    it('should accept a valid email + non-empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'whatever',
      });

      expect(result.success).toBe(true);
    });

    it('should lowercase and trim the email', () => {
      const result = loginSchema.parse({
        email: '  User@Example.COM  ',
        password: 'x',
      });

      expect(result.email).toBe('user@example.com');
    });

    it('should reject an invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'whatever',
      });

      expect(result.success).toBe(false);
    });

    it('should reject an empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should accept a valid email', () => {
      const result = forgotPasswordSchema.safeParse({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject when email is missing', () => {
      const result = forgotPasswordSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should accept a valid token + strong password + matching confirm', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: VALID_STRONG_PASSWORD,
        confirmPassword: VALID_STRONG_PASSWORD,
      });

      expect(result.success).toBe(true);
    });

    it('should reject when password is too short', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: 'Short1!',
        confirmPassword: 'Short1!',
      });

      expect(result.success).toBe(false);
    });

    it('should reject when password lacks a special character', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: 'NoSpecialChar1',
        confirmPassword: 'NoSpecialChar1',
      });

      expect(result.success).toBe(false);
    });

    it('should reject when password lacks an uppercase letter', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: 'nouppercase1!',
        confirmPassword: 'nouppercase1!',
      });

      expect(result.success).toBe(false);
    });

    it('should reject when password lacks a digit', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: 'NoDigitHere!aZ',
        confirmPassword: 'NoDigitHere!aZ',
      });

      expect(result.success).toBe(false);
    });

    it('should reject when confirm does not match password', () => {
      const result = resetPasswordSchema.safeParse({
        token: VALID_TOKEN,
        password: VALID_STRONG_PASSWORD,
        confirmPassword: `${VALID_STRONG_PASSWORD}X`,
      });

      expect(result.success).toBe(false);
    });

    it('should reject when token is too short', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'short',
        password: VALID_STRONG_PASSWORD,
        confirmPassword: VALID_STRONG_PASSWORD,
      });

      expect(result.success).toBe(false);
    });
  });
});
