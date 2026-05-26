import { describe, expect, it } from 'vitest';
import {
  formatDateShort,
  getCurrentCreneau,
  getRecentDaysRange,
  isWithinRecentDays,
  parseISODateUtc,
  todayParisISO,
} from './dates';

/**
 * Reference UTC `2026-05-26T<hour>:<minute>:00Z`. En mai (heure d'ete
 * Paris UTC+2), l'heure locale Paris = heure UTC + 2.
 *
 * Pour cibler une heure locale Paris en mai : passer `utcHour - 2`.
 * Pour cibler une heure locale Paris en janvier (UTC+1) : `utcHour - 1`.
 */
function parisInMay(hour: number, minute = 0): Date {
  const utcHour = hour - 2;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return new Date(`2026-05-26T${pad(utcHour)}:${pad(minute)}:00.000Z`);
}

describe('[dates utils]', () => {
  describe('todayParisISO', () => {
    it('should format the Paris-local date as YYYY-MM-DD', () => {
      const now = parisInMay(10);
      expect(todayParisISO(now)).toBe('2026-05-26');
    });

    it('should roll over at Paris midnight, not UTC midnight', () => {
      // 23:30 UTC = 01:30 Paris (mai). Le jour Paris est deja le 27.
      const lateUtc = new Date('2026-05-26T23:30:00.000Z');
      expect(todayParisISO(lateUtc)).toBe('2026-05-27');
    });
  });

  describe('getCurrentCreneau', () => {
    it('should return null at 00h Paris (creux nocturne)', () => {
      // 22:00 UTC = 00:00 Paris (mai).
      const now = new Date('2026-05-26T22:00:00.000Z');
      expect(getCurrentCreneau(now)).toBeNull();
    });

    it('should return MATIN at exactly 5h Paris (borne inclusive)', () => {
      expect(getCurrentCreneau(parisInMay(5))).toBe('MATIN');
    });

    it('should return MATIN at 11:59 Paris', () => {
      expect(getCurrentCreneau(parisInMay(11, 59))).toBe('MATIN');
    });

    it('should return MIDI at exactly 12h Paris (transition MATIN -> MIDI)', () => {
      expect(getCurrentCreneau(parisInMay(12))).toBe('MIDI');
    });

    it('should return MIDI at 16:59 Paris', () => {
      expect(getCurrentCreneau(parisInMay(16, 59))).toBe('MIDI');
    });

    it('should return SOIR at exactly 17h Paris (transition MIDI -> SOIR)', () => {
      expect(getCurrentCreneau(parisInMay(17))).toBe('SOIR');
    });

    it('should return SOIR at 22:59 Paris (dernier creneau actif)', () => {
      expect(getCurrentCreneau(parisInMay(22, 59))).toBe('SOIR');
    });

    it('should return null at 23h Paris (fin SOIR exclusive)', () => {
      expect(getCurrentCreneau(parisInMay(23))).toBeNull();
    });

    it('should return null at 04:59 Paris (avant MATIN)', () => {
      expect(getCurrentCreneau(parisInMay(4, 59))).toBeNull();
    });
  });

  describe('formatDateShort', () => {
    it('should format ISO date to JJ/MM/AAAA', () => {
      expect(formatDateShort('2026-05-26')).toBe('26/05/2026');
    });

    it('should preserve single-digit day/month padding', () => {
      expect(formatDateShort('2026-01-09')).toBe('09/01/2026');
    });

    it('should fall back to input when format is unexpected', () => {
      expect(formatDateShort('not-a-date')).toBe('not-a-date');
    });
  });

  describe('parseISODateUtc', () => {
    it('should produce a UTC date anchored at midnight', () => {
      const date = parseISODateUtc('2026-05-26');
      expect(date.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    });
  });

  describe('getRecentDaysRange', () => {
    it('should span exactly `days` days inclusive when days=7', () => {
      const now = parisInMay(10);
      const { from, to } = getRecentDaysRange(7, now);
      expect(to.toISOString()).toBe('2026-05-26T00:00:00.000Z');
      expect(from.toISOString()).toBe('2026-05-20T00:00:00.000Z');
    });

    it('should return a single-day range when days=1', () => {
      const now = parisInMay(10);
      const { from, to } = getRecentDaysRange(1, now);
      expect(from.getTime()).toBe(to.getTime());
    });

    it('should clamp days<1 to a single-day range (today)', () => {
      const now = parisInMay(10);
      const { from, to } = getRecentDaysRange(0, now);
      expect(from.toISOString()).toBe('2026-05-26T00:00:00.000Z');
      expect(to.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    });
  });

  describe('isWithinRecentDays', () => {
    it('should accept today within a 7-day window', () => {
      expect(isWithinRecentDays('2026-05-26', 7, parisInMay(10))).toBe(true);
    });

    it('should accept the oldest day in the 7-day window', () => {
      expect(isWithinRecentDays('2026-05-20', 7, parisInMay(10))).toBe(true);
    });

    it('should reject a date older than the 7-day window', () => {
      expect(isWithinRecentDays('2026-05-19', 7, parisInMay(10))).toBe(false);
    });

    it('should reject a future date', () => {
      expect(isWithinRecentDays('2026-05-27', 7, parisInMay(10))).toBe(false);
    });
  });
});
