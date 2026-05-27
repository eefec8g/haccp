import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  releveAnnulationSchema,
  releveCreateSchema,
  releveHistoryQuerySchema,
  releveListingQuerySchema,
  tourneeQuerySchema,
} from './releve';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const FROZEN_TODAY = new Date('2026-05-15T10:00:00Z');

describe('[releve validations]', () => {
  describe('releveCreateSchema', () => {
    it('should accept a valid creation payload with no commentaire', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: VALID_UUID,
        creneau: 'MATIN',
        temperature: -19.5,
      });
      expect(result.success).toBe(true);
    });

    it('should normalize empty commentaire to undefined', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: VALID_UUID,
        creneau: 'MIDI',
        temperature: -20,
        commentaire: '   ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.commentaire).toBeUndefined();
      }
    });

    it('should reject a non-uuid equipementId', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: 'not-an-uuid',
        creneau: 'SOIR',
        temperature: -20,
      });
      expect(result.success).toBe(false);
    });

    it('should reject a temperature below TEMPERATURE_MIN', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: VALID_UUID,
        creneau: 'SOIR',
        temperature: -999,
      });
      expect(result.success).toBe(false);
    });

    it('should reject a temperature above TEMPERATURE_MAX', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: VALID_UUID,
        creneau: 'SOIR',
        temperature: 999,
      });
      expect(result.success).toBe(false);
    });

    it('should reject a non-Creneau enum value', () => {
      const result = releveCreateSchema.safeParse({
        equipementId: VALID_UUID,
        creneau: 'NUIT',
        temperature: -20,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('releveAnnulationSchema', () => {
    it('should accept a valid annulation without replacement', () => {
      const result = releveAnnulationSchema.safeParse({
        releveId: VALID_UUID,
        motif: 'Erreur de saisie temperature',
      });
      expect(result.success).toBe(true);
    });

    it('should accept a valid annulation with replacement', () => {
      const result = releveAnnulationSchema.safeParse({
        releveId: VALID_UUID,
        motif: 'Erreur de saisie temperature',
        replacement: { temperature: -21, commentaire: 'valeur correcte' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject a motif shorter than 10 chars (after trim)', () => {
      const result = releveAnnulationSchema.safeParse({
        releveId: VALID_UUID,
        motif: '   typo   ',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tourneeQuerySchema', () => {
    it('should accept an empty query (default today)', () => {
      const result = tourneeQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject a date not matching YYYY-MM-DD', () => {
      const result = tourneeQuerySchema.safeParse({ date: '26/05/2026' });
      expect(result.success).toBe(false);
    });
  });

  describe('releveHistoryQuerySchema', () => {
    it('should default page and pageSize when missing', () => {
      const result = releveHistoryQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it('should coerce string page and pageSize', () => {
      const result = releveHistoryQuerySchema.safeParse({
        page: '3',
        pageSize: '50',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('should reject pageSize above 50', () => {
      const result = releveHistoryQuerySchema.safeParse({ pageSize: 51 });
      expect(result.success).toBe(false);
    });
  });

  describe('releveListingQuerySchema', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FROZEN_TODAY);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should accept an empty query and default to last 30 days', () => {
      const result = releveListingQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateEnd).toBe('2026-05-15');
        // 30 days inclusive : start = today - 29
        expect(result.data.dateStart).toBe('2026-04-16');
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('should accept a valid explicit period', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-01',
        dateEnd: '2026-05-10',
        page: '2',
        pageSize: '25',
        creneau: 'MATIN',
        statut: 'ALERTE',
        boutiqueId: VALID_UUID,
        equipementId: VALID_UUID,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(25);
        expect(result.data.creneau).toBe('MATIN');
        expect(result.data.statut).toBe('ALERTE');
      }
    });

    it('should reject when dateStart > dateEnd (PERIODE_INVALID)', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-10',
        dateEnd: '2026-05-01',
      });
      expect(result.success).toBe(false);
    });

    it('should reject a period larger than 92 days (PERIODE_TOO_LARGE)', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-01-01',
        dateEnd: '2026-05-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject dateEnd in the future (PERIODE_IN_FUTURE)', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-10',
        dateEnd: '2026-05-20',
      });
      expect(result.success).toBe(false);
    });

    it('should reject an invalid date format', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '15/05/2026',
        dateEnd: '2026-05-15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject an invalid statut enum', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-01',
        dateEnd: '2026-05-10',
        statut: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should reject pageSize above MAX_PAGE_SIZE', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-01',
        dateEnd: '2026-05-10',
        pageSize: 500,
      });
      expect(result.success).toBe(false);
    });

    it('should reject a non-uuid boutiqueId', () => {
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-05-01',
        dateEnd: '2026-05-10',
        boutiqueId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept the exact 92-day boundary', () => {
      // 2026-02-13 -> 2026-05-15 = 92 jours inclus
      const result = releveListingQuerySchema.safeParse({
        dateStart: '2026-02-13',
        dateEnd: '2026-05-15',
      });
      expect(result.success).toBe(true);
    });
  });
});
