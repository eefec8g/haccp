import { describe, it, expect } from 'vitest';
import {
  acceptInvitationSchema,
  boutiqueCreateSchema,
  boutiqueUpdateSchema,
  entityDisableSchema,
  equipementCreateSchema,
  equipementUpdateSchema,
  paginationQuerySchema,
  userInviteSchema,
} from './admin';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_PASSWORD = 'StrongPass1!aZ';
const VALID_TOKEN = 'a'.repeat(43);
const VALID_DATE_ISO = '2026-01-01';

describe('[admin validations]', () => {
  describe('boutiqueCreateSchema', () => {
    it('should accept a minimal valid input (nom + dateOuverture)', () => {
      const result = boutiqueCreateSchema.safeParse({
        nom: 'MG Paris 11',
        dateOuverture: VALID_DATE_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('should reject when dateOuverture is missing', () => {
      const result = boutiqueCreateSchema.safeParse({ nom: 'MG Paris 11' });
      expect(result.success).toBe(false);
    });

    it('should transform dateOuverture into a UTC midnight Date', () => {
      const parsed = boutiqueCreateSchema.parse({
        nom: 'MG Paris 11',
        dateOuverture: VALID_DATE_ISO,
      });
      expect(parsed.dateOuverture).toEqual(
        new Date(`${VALID_DATE_ISO}T00:00:00.000Z`)
      );
    });

    it('should reject a nom that is too short', () => {
      const result = boutiqueCreateSchema.safeParse({
        nom: 'A',
        dateOuverture: VALID_DATE_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('should trim the nom', () => {
      const parsed = boutiqueCreateSchema.parse({
        nom: '  MG Lyon  ',
        dateOuverture: VALID_DATE_ISO,
      });
      expect(parsed.nom).toBe('MG Lyon');
    });

    it('should convert empty string adresse to undefined', () => {
      const parsed = boutiqueCreateSchema.parse({
        nom: 'MG Paris',
        adresse: '',
        dateOuverture: VALID_DATE_ISO,
      });
      expect(parsed.adresse).toBeUndefined();
    });
  });

  describe('boutiqueUpdateSchema', () => {
    it('should accept a partial update with only ville', () => {
      const result = boutiqueUpdateSchema.safeParse({ ville: 'Paris' });
      expect(result.success).toBe(true);
    });

    it('should accept an empty update', () => {
      const result = boutiqueUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('equipementCreateSchema', () => {
    function baseInput(overrides: Record<string, unknown> = {}) {
      return {
        nom: 'CGL-01',
        type: 'CONGELATEUR',
        boutiqueId: VALID_UUID,
        seuilMin: -25,
        seuilMax: -18,
        dateMiseEnService: VALID_DATE_ISO,
        ...overrides,
      };
    }

    it('should accept a valid equipement', () => {
      const result = equipementCreateSchema.safeParse(baseInput());
      expect(result.success).toBe(true);
    });

    it('should reject when dateMiseEnService is missing', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ dateMiseEnService: undefined })
      );
      expect(result.success).toBe(false);
    });

    it('should reject when seuilMin >= seuilMax', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ seuilMin: -10, seuilMax: -18 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject when seuilMin equals seuilMax', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ seuilMin: -18, seuilMax: -18 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject when seuilMin is below the absolute minimum', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ seuilMin: -100 })
      );
      expect(result.success).toBe(false);
    });

    it('should reject an invalid TypeEquipement', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ type: 'NOT_A_TYPE' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject a non-uuid boutiqueId', () => {
      const result = equipementCreateSchema.safeParse(
        baseInput({ boutiqueId: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject when seuils are missing (decision Epic ADMIN #4)', () => {
      const result = equipementCreateSchema.safeParse({
        nom: 'CGL-01',
        type: 'CONGELATEUR',
        boutiqueId: VALID_UUID,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('equipementUpdateSchema', () => {
    it('should accept a partial update with only one seuil', () => {
      const result = equipementUpdateSchema.safeParse({ seuilMin: -22 });
      expect(result.success).toBe(true);
    });

    it('should reject when seuilMin and seuilMax are both set but invalid', () => {
      const result = equipementUpdateSchema.safeParse({
        seuilMin: -10,
        seuilMax: -18,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('userInviteSchema', () => {
    it('should accept a SALARIE with a boutique', () => {
      const result = userInviteSchema.safeParse({
        email: 'salarie@example.com',
        name: 'Salarie 1',
        role: 'SALARIE',
        boutiqueSalarieId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    it('should reject a SALARIE without boutiqueSalarieId', () => {
      const result = userInviteSchema.safeParse({
        email: 'salarie@example.com',
        name: 'Salarie 1',
        role: 'SALARIE',
      });
      expect(result.success).toBe(false);
    });

    it('should accept a RESPONSABLE with multiple boutiques', () => {
      const result = userInviteSchema.safeParse({
        email: 'resp@example.com',
        name: 'Responsable 1',
        role: 'RESPONSABLE',
        boutiquesResponsable: [VALID_UUID, OTHER_UUID],
      });
      expect(result.success).toBe(true);
    });

    it('should reject a RESPONSABLE with empty boutiquesResponsable', () => {
      const result = userInviteSchema.safeParse({
        email: 'resp@example.com',
        name: 'Responsable 1',
        role: 'RESPONSABLE',
        boutiquesResponsable: [],
      });
      expect(result.success).toBe(false);
    });

    it('should accept an ADMIN with no boutique', () => {
      const result = userInviteSchema.safeParse({
        email: 'admin@example.com',
        name: 'Admin 1',
        role: 'ADMIN',
      });
      expect(result.success).toBe(true);
    });

    it('should lowercase and trim the email', () => {
      const result = userInviteSchema.parse({
        email: '  USER@Example.COM ',
        name: 'X',
        role: 'ADMIN',
      });
      expect(result.email).toBe('user@example.com');
    });

    it('should reject when email is invalid', () => {
      const result = userInviteSchema.safeParse({
        email: 'not-an-email',
        name: 'X',
        role: 'ADMIN',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('acceptInvitationSchema', () => {
    it('should accept a valid token + strong password + matching confirm', () => {
      const result = acceptInvitationSchema.safeParse({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      });
      expect(result.success).toBe(true);
    });

    it('should reject when password is too weak', () => {
      const result = acceptInvitationSchema.safeParse({
        token: VALID_TOKEN,
        password: 'weak',
        confirmPassword: 'weak',
      });
      expect(result.success).toBe(false);
    });

    it('should reject when confirm does not match', () => {
      const result = acceptInvitationSchema.safeParse({
        token: VALID_TOKEN,
        password: VALID_PASSWORD,
        confirmPassword: `${VALID_PASSWORD}X`,
      });
      expect(result.success).toBe(false);
    });

    it('should reject when token is too short', () => {
      const result = acceptInvitationSchema.safeParse({
        token: 'short',
        password: VALID_PASSWORD,
        confirmPassword: VALID_PASSWORD,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('entityDisableSchema', () => {
    it('should accept a valid uuid + motif', () => {
      const result = entityDisableSchema.safeParse({
        id: VALID_UUID,
        motif: 'Materiel hors service',
      });
      expect(result.success).toBe(true);
    });

    it('should reject a non-uuid id', () => {
      const result = entityDisableSchema.safeParse({ id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('paginationQuerySchema', () => {
    it('should apply defaults when params are missing', () => {
      const result = paginationQuerySchema.parse({});
      expect(result).toEqual({ page: 1, pageSize: 25 });
    });

    it('should coerce string query params to numbers', () => {
      const result = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
      expect(result).toEqual({ page: 3, pageSize: 50 });
    });

    it('should reject pageSize above the hard cap', () => {
      const result = paginationQuerySchema.safeParse({ pageSize: 10000 });
      expect(result.success).toBe(false);
    });

    it('should reject page below 1', () => {
      const result = paginationQuerySchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });
  });
});
