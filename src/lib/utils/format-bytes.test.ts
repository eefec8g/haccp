import { describe, it, expect } from 'vitest';
import { formatBytes } from './format-bytes';

/**
 * Tests `formatBytes` (US-PHO-001 DRY refactor).
 *
 * Couvre les cas frontieres :
 *   - 0 octet,
 *   - sub-KB (rounding vers 0),
 *   - exact 1 KB,
 *   - sub-MB (taille typique d'une photo compressee),
 *   - exactement 1 MB (frontiere du switch KB->MB),
 *   - multi-MB,
 *   - rounding KB (Math.round).
 */
describe('[Photos] formatBytes', () => {
  it('should format 0 bytes as "0 KB"', () => {
    expect(formatBytes(0)).toBe('0 KB');
  });

  it('should round sub-KB values down to "0 KB"', () => {
    expect(formatBytes(100)).toBe('0 KB');
  });

  it('should format exactly 1024 bytes as "1 KB"', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('should round KB values to the nearest integer', () => {
    // 512_000 / 1024 = 500.0
    expect(formatBytes(512_000)).toBe('500 KB');
  });

  it('should still use KB just below the MB threshold', () => {
    // 1_048_575 (1 MB - 1) / 1024 ~= 1023.999 -> 1024 KB
    expect(formatBytes(1_048_575)).toBe('1024 KB');
  });

  it('should switch to MB at exactly 1 MB (1_048_576 bytes)', () => {
    expect(formatBytes(1_048_576)).toBe('1.0 MB');
  });

  it('should format multi-MB values with one decimal', () => {
    // 1.5 MB
    expect(formatBytes(1_572_864)).toBe('1.5 MB');
  });

  it('should format larger multi-MB values', () => {
    // 5 MB
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
