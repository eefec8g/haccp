import { describe, expect, it } from 'vitest';
import {
  releveAnnulationSchema,
  releveCreateSchema,
  releveHistoryQuerySchema,
  tourneeQuerySchema,
} from './releve';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

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
});
