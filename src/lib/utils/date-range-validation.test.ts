import { describe, expect, it } from 'vitest';
import {
  DATE_RANGE_VALID_STATE,
  computeDateRangeValidation,
  isDateRangeFieldInvalid,
} from './date-range-validation';

const MAX_DATE = '2026-05-27';

function makeArgs(overrides: {
  dateStart?: string;
  dateEnd?: string;
  maxDate?: string;
  maxPeriodeDays?: number;
}) {
  return {
    dateStart: overrides.dateStart ?? '2026-05-01',
    dateEnd: overrides.dateEnd ?? '2026-05-15',
    maxDate: overrides.maxDate ?? MAX_DATE,
    maxPeriodeDays: overrides.maxPeriodeDays ?? 92,
  };
}

describe('[date-range-validation]', () => {
  describe('computeDateRangeValidation', () => {
    it('should return the valid state when all checks pass', () => {
      const state = computeDateRangeValidation(makeArgs({}));
      expect(state).toEqual(DATE_RANGE_VALID_STATE);
    });

    it('should flag dateStart when only it is empty', () => {
      const state = computeDateRangeValidation(makeArgs({ dateStart: '' }));
      expect(state.valid).toBe(false);
      expect(state.invalidFields).toEqual(['dateStart']);
      expect(state.message).toContain('Selectionnez');
    });

    it('should flag dateEnd when only it is empty', () => {
      const state = computeDateRangeValidation(makeArgs({ dateEnd: '' }));
      expect(state.valid).toBe(false);
      expect(state.invalidFields).toEqual(['dateEnd']);
    });

    it('should flag both fields when dateEnd is before dateStart', () => {
      const state = computeDateRangeValidation(
        makeArgs({ dateStart: '2026-05-15', dateEnd: '2026-05-10' })
      );
      expect(state.valid).toBe(false);
      expect(state.invalidFields).toEqual(['dateStart', 'dateEnd']);
      expect(state.message).toContain('superieure ou egale');
    });

    it('should flag dateEnd when it is in the future', () => {
      const state = computeDateRangeValidation(
        makeArgs({ dateEnd: '2026-06-01', maxDate: '2026-05-27' })
      );
      expect(state.valid).toBe(false);
      expect(state.invalidFields).toEqual(['dateEnd']);
      expect(state.message).toContain('futur');
    });

    it('should flag dateEnd when the period exceeds maxPeriodeDays', () => {
      const state = computeDateRangeValidation(
        makeArgs({
          dateStart: '2026-01-01',
          dateEnd: '2026-05-15',
          maxPeriodeDays: 92,
        })
      );
      expect(state.valid).toBe(false);
      expect(state.invalidFields).toEqual(['dateEnd']);
      expect(state.message).toContain('92 jours');
    });

    it('should accept exactly maxPeriodeDays as a valid period', () => {
      // 92 jours = 2026-01-01 -> 2026-04-02 inclus (cf. daysInclusive)
      const state = computeDateRangeValidation(
        makeArgs({
          dateStart: '2026-01-01',
          dateEnd: '2026-04-02',
          maxPeriodeDays: 92,
        })
      );
      expect(state.valid).toBe(true);
    });

    it('should prioritize the order check over the period length check', () => {
      const state = computeDateRangeValidation(
        makeArgs({
          dateStart: '2026-05-15',
          dateEnd: '2026-01-01',
          maxPeriodeDays: 7,
        })
      );
      expect(state.invalidFields).toEqual(['dateStart', 'dateEnd']);
    });
  });

  describe('isDateRangeFieldInvalid', () => {
    it('should return "true" when the field is in invalidFields', () => {
      expect(
        isDateRangeFieldInvalid(
          {
            valid: false,
            message: 'x',
            invalidFields: ['dateEnd'],
          },
          'dateEnd'
        )
      ).toBe('true');
    });

    it('should return undefined when the field is not invalid (a11y safe)', () => {
      expect(
        isDateRangeFieldInvalid(
          {
            valid: false,
            message: 'x',
            invalidFields: ['dateEnd'],
          },
          'dateStart'
        )
      ).toBeUndefined();
    });

    it('should return undefined on the valid state', () => {
      expect(
        isDateRangeFieldInvalid(DATE_RANGE_VALID_STATE, 'dateEnd')
      ).toBeUndefined();
    });
  });
});
