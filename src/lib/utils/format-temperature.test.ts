import { describe, expect, it } from 'vitest';
import {
  TEMPERATURE_PLACEHOLDER_DEFAULT,
  formatTemperature,
} from './format-temperature';

describe('[format-temperature utils]', () => {
  describe('formatTemperature', () => {
    it('should format a negative temperature with one decimal and degC suffix', () => {
      expect(formatTemperature(-18.5)).toBe('-18.5 degC');
    });

    it('should format a positive temperature with one decimal and degC suffix', () => {
      expect(formatTemperature(3.2)).toBe('3.2 degC');
    });

    it('should format zero as 0.0 degC (preserve trailing zero)', () => {
      expect(formatTemperature(0)).toBe('0.0 degC');
    });

    it('should round to one decimal (banker rounding via toFixed)', () => {
      expect(formatTemperature(-18.456)).toBe('-18.5 degC');
      expect(formatTemperature(-18.444)).toBe('-18.4 degC');
    });

    it('should return the default em-dash placeholder for null', () => {
      expect(formatTemperature(null)).toBe(TEMPERATURE_PLACEHOLDER_DEFAULT);
      expect(formatTemperature(null)).toBe('—');
    });

    it('should return the default em-dash placeholder for undefined', () => {
      expect(formatTemperature(undefined)).toBe('—');
    });

    it('should use the provided placeholder when value is null', () => {
      expect(formatTemperature(null, '-')).toBe('-');
      expect(formatTemperature(null, '--')).toBe('--');
      expect(formatTemperature(null, 'N/A')).toBe('N/A');
    });

    it('should use the provided placeholder when value is undefined', () => {
      expect(formatTemperature(undefined, '-')).toBe('-');
    });

    it('should ignore the placeholder when value is a valid number', () => {
      expect(formatTemperature(-20.5, 'N/A')).toBe('-20.5 degC');
    });
  });
});
