import { describe, it, expect } from 'vitest';
import { getTemperatureBand } from '@/lib/utils/temperature-band';

describe('[getTemperatureBand]', () => {
  it('should return null for null or undefined', () => {
    expect(getTemperatureBand(null)).toBeNull();
    expect(getTemperatureBand(undefined)).toBeNull();
  });

  it('should classify strictly negative temperatures as COLD', () => {
    expect(getTemperatureBand(-22.5)).toBe('COLD');
    expect(getTemperatureBand(-0.1)).toBe('COLD');
  });

  it('should classify 0 to 20 inclusive as NORMAL', () => {
    expect(getTemperatureBand(0)).toBe('NORMAL');
    expect(getTemperatureBand(10)).toBe('NORMAL');
    expect(getTemperatureBand(20)).toBe('NORMAL');
  });

  it('should classify strictly above 20 as HIGH', () => {
    expect(getTemperatureBand(20.1)).toBe('HIGH');
    expect(getTemperatureBand(35)).toBe('HIGH');
  });
});
