import { describe, expect, it } from 'vitest';
import {
  countJoursAttendus,
  dateDebutEffective,
  isJourAttendu,
} from './date-debut';
import { parseISODateUtc } from './dates';

const d = parseISODateUtc;

describe('[date-debut utils]', () => {
  describe('dateDebutEffective', () => {
    it('should return the equipement date when it is later than the boutique date', () => {
      const result = dateDebutEffective({
        dateOuverture: d('2026-01-01'),
        dateMiseEnService: d('2026-03-15'),
      });
      expect(result.getTime()).toBe(d('2026-03-15').getTime());
    });

    it('should return the boutique date when it is later than the equipement date', () => {
      const result = dateDebutEffective({
        dateOuverture: d('2026-04-10'),
        dateMiseEnService: d('2026-02-01'),
      });
      expect(result.getTime()).toBe(d('2026-04-10').getTime());
    });

    it('should return either when both dates are equal', () => {
      const result = dateDebutEffective({
        dateOuverture: d('2026-05-20'),
        dateMiseEnService: d('2026-05-20'),
      });
      expect(result.getTime()).toBe(d('2026-05-20').getTime());
    });
  });

  describe('isJourAttendu', () => {
    const debut = d('2026-03-10');

    it('should be false for a day strictly before the start date', () => {
      expect(isJourAttendu('2026-03-09', debut)).toBe(false);
    });

    it('should be true on the exact start day (inclusive boundary)', () => {
      expect(isJourAttendu('2026-03-10', debut)).toBe(true);
    });

    it('should be true for a day after the start date', () => {
      expect(isJourAttendu('2026-03-11', debut)).toBe(true);
    });
  });

  describe('countJoursAttendus', () => {
    it('should count all days when the start date precedes the whole period', () => {
      expect(
        countJoursAttendus('2026-05-01', '2026-05-05', d('2026-01-01'))
      ).toBe(5);
    });

    it('should count zero when the start date is after the whole period', () => {
      expect(
        countJoursAttendus('2026-05-01', '2026-05-05', d('2026-06-01'))
      ).toBe(0);
    });

    it('should count only the days from the start date (inclusive) onward', () => {
      // periode 01..05, debut le 03 -> jours 03,04,05 = 3
      expect(
        countJoursAttendus('2026-05-01', '2026-05-05', d('2026-05-03'))
      ).toBe(3);
    });

    it('should count a single day when start equals end and is expected', () => {
      expect(
        countJoursAttendus('2026-05-03', '2026-05-03', d('2026-05-01'))
      ).toBe(1);
    });

    it('should return 0 when the period is inverted', () => {
      expect(
        countJoursAttendus('2026-05-05', '2026-05-01', d('2026-01-01'))
      ).toBe(0);
    });
  });
});
