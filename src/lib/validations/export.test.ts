import { describe, it, expect } from 'vitest';
import { exportCsvQuerySchema, exportPdfQuerySchema } from './export';

const VALID_UUID = '00000000-0000-4000-8000-000000000000';

describe('[validations/export]', () => {
  describe('exportCsvQuerySchema', () => {
    it('should accept a valid 30-day range without filters', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional boutiqueId and equipementId', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        boutiqueId: VALID_UUID,
        equipementId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it('should reject dateTo before dateFrom', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-31',
        dateTo: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should reject range over 90 days', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-05-01',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '01/01/2026',
        dateTo: '2026-01-31',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid uuid', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        boutiqueId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept same date (1 day range)', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-01',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('exportPdfQuerySchema', () => {
    it('should accept a valid date + boutique', () => {
      const result = exportPdfQuerySchema.safeParse({
        date: '2026-01-01',
        boutiqueId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing boutiqueId (required)', () => {
      const result = exportPdfQuerySchema.safeParse({
        date: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = exportPdfQuerySchema.safeParse({
        date: '2026/01/01',
        boutiqueId: VALID_UUID,
      });
      expect(result.success).toBe(false);
    });
  });
});
