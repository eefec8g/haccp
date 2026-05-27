import { describe, expect, it } from 'vitest';
import { dashboardQuerySchema } from './dashboard';

/**
 * Tests du schema Zod `dashboardQuerySchema`.
 *
 * Couvre :
 *  - acceptation d'un boutiqueId UUID valide
 *  - rejet d'un boutiqueId non-UUID
 *  - acceptation d'une dateISO `YYYY-MM-DD`
 *  - rejet d'un format de date non strict
 *  - acceptation d'un objet vide (les deux champs sont optionnels)
 */

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('[validations] dashboardQuerySchema', () => {
  it('should accept a valid UUID boutiqueId', () => {
    const result = dashboardQuerySchema.safeParse({ boutiqueId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.boutiqueId).toBe(VALID_UUID);
    }
  });

  it('should reject a non-UUID boutiqueId', () => {
    const result = dashboardQuerySchema.safeParse({ boutiqueId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should accept a YYYY-MM-DD dateISO', () => {
    const result = dashboardQuerySchema.safeParse({ dateISO: '2026-05-26' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateISO).toBe('2026-05-26');
    }
  });

  it('should reject a date format that is not strict YYYY-MM-DD', () => {
    const result = dashboardQuerySchema.safeParse({ dateISO: '2026/05/26' });
    expect(result.success).toBe(false);
  });

  it('should accept an empty object (both fields optional)', () => {
    const result = dashboardQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.boutiqueId).toBeUndefined();
      expect(result.data.dateISO).toBeUndefined();
    }
  });

  it('should accept both fields together when valid', () => {
    const result = dashboardQuerySchema.safeParse({
      boutiqueId: VALID_UUID,
      dateISO: '2026-05-26',
    });
    expect(result.success).toBe(true);
  });

  it('should reject a partially formatted date (single-digit month)', () => {
    const result = dashboardQuerySchema.safeParse({ dateISO: '2026-5-26' });
    expect(result.success).toBe(false);
  });
});
