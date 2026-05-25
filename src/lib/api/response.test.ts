import { describe, it, expect } from 'vitest';
import {
  createErrorResponse,
  forbiddenResponse,
  internalErrorResponse,
  notFoundResponse,
  rateLimitErrorResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from './response';

const ONE_SECOND_MS = 1000;
const THIRTY_SECONDS_MS = 30_000;

describe('[api/response]', () => {
  describe('createErrorResponse', () => {
    it('should set status, error, and code on the JSON payload', async () => {
      const response = createErrorResponse('boom', 'INTERNAL_ERROR', 500);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: 'boom', code: 'INTERNAL_ERROR' });
    });
  });

  describe('shortcut helpers', () => {
    it('should return 401 / UNAUTHORIZED with default message', async () => {
      const response = unauthorizedResponse();
      const body = await response.json();
      expect(response.status).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
      expect(body.error).toBe('Non autorise');
    });

    it('should accept a custom unauthorized message', async () => {
      const response = unauthorizedResponse('Session expiree');
      const body = await response.json();
      expect(body.error).toBe('Session expiree');
    });

    it('should return 403 / FORBIDDEN for forbiddenResponse', async () => {
      const response = forbiddenResponse();
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('FORBIDDEN');
    });

    it('should return 400 / VALIDATION_ERROR for validationErrorResponse', async () => {
      const response = validationErrorResponse("L'email est invalide");
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body).toEqual({
        error: "L'email est invalide",
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 404 / NOT_FOUND for notFoundResponse', async () => {
      const response = notFoundResponse();
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe('NOT_FOUND');
    });

    it('should return 500 / INTERNAL_ERROR for internalErrorResponse', async () => {
      const response = internalErrorResponse();
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: 'Erreur interne',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('rateLimitErrorResponse', () => {
    it('should return 429 with code RATE_LIMIT_EXCEEDED and the given message', async () => {
      const response = rateLimitErrorResponse('Patientez', THIRTY_SECONDS_MS);
      const body = await response.json();
      expect(response.status).toBe(429);
      expect(body).toEqual({ error: 'Patientez', code: 'RATE_LIMIT_EXCEEDED' });
    });

    it('should set Retry-After header in seconds (rounded up)', () => {
      const response = rateLimitErrorResponse('Patientez', 30_500);
      expect(response.headers.get('Retry-After')).toBe('31');
    });

    it('should round Retry-After up even for sub-second values', () => {
      const response = rateLimitErrorResponse('Patientez', ONE_SECOND_MS / 2);
      expect(response.headers.get('Retry-After')).toBe('1');
    });
  });
});
