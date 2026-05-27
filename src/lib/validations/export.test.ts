import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  exportConsolideQuerySchema,
  exportCsvQuerySchema,
  exportPdfQuerySchema,
} from './export';

const VALID_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Stabilise "today" pour les tests `exportConsolideQuerySchema` qui
 * refusent les dates futures. On fige `Date.now()` au 15/03/2026 :
 * une periode jusqu'au 14/03 est dans le passe, jusqu'au 16/03 dans
 * le futur, peu importe la date reelle de la machine de CI.
 */
const FROZEN_TODAY = new Date('2026-03-15T10:00:00Z');

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

  describe('exportConsolideQuerySchema', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function freezeToday(): void {
      vi.useFakeTimers();
      vi.setSystemTime(FROZEN_TODAY);
    }

    it('should accept a valid 31-day range without boutiqueId', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-02-13',
        dateEnd: '2026-03-15',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a single-day range with boutiqueId', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        boutiqueId: VALID_UUID,
        dateStart: '2026-03-14',
        dateEnd: '2026-03-14',
      });
      expect(result.success).toBe(true);
    });

    it('should reject dateEnd before dateStart (PERIODE_INVALID)', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-03-10',
        dateEnd: '2026-03-09',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['dateEnd']);
      }
    });

    it('should reject a 32-day range (PERIODE_TOO_LARGE)', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-02-12',
        dateEnd: '2026-03-15',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['dateEnd']);
      }
    });

    it('should reject a dateEnd in the future (PERIODE_IN_FUTURE)', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-03-15',
        dateEnd: '2026-03-16',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['dateEnd']);
      }
    });

    it('should reject an invalid date format', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '15/03/2026',
        dateEnd: '2026-03-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject an invalid uuid', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        boutiqueId: 'not-a-uuid',
        dateStart: '2026-03-14',
        dateEnd: '2026-03-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject a non-existent calendar date (SEC-1: 2026-02-30)', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-02-30',
        dateEnd: '2026-03-15',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('inexistante');
      }
    });

    it('should reject another non-existent date (2026-13-01, month 13)', () => {
      freezeToday();
      const result = exportConsolideQuerySchema.safeParse({
        dateStart: '2026-01-01',
        dateEnd: '2026-13-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('exportCsvQuerySchema date refine (SEC-1)', () => {
    it('should reject a non-existent calendar date in dateFrom', () => {
      const result = exportCsvQuerySchema.safeParse({
        dateFrom: '2026-02-30',
        dateTo: '2026-03-15',
      });
      expect(result.success).toBe(false);
    });
  });
});
