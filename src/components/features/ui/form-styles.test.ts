import { describe, it, expect } from 'vitest';
import * as formStyles from './form-styles';

/**
 * Tests form-styles : verifient que les exports attendus existent et
 * sont des strings non vides. Garde-fou contre une suppression
 * accidentelle d'un token central (ex: SUBMIT_CLASSES) qui casserait
 * silencieusement plusieurs formulaires.
 */

describe('[UI] form-styles constants', () => {
  it('should export INPUT_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.INPUT_CLASSES).toBe('string');
    expect(formStyles.INPUT_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export INPUT_LARGE_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.INPUT_LARGE_CLASSES).toBe('string');
    expect(formStyles.INPUT_LARGE_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export TEXTAREA_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.TEXTAREA_CLASSES).toBe('string');
    expect(formStyles.TEXTAREA_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export SUBMIT_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.SUBMIT_CLASSES).toBe('string');
    expect(formStyles.SUBMIT_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export SUBMIT_LARGE_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.SUBMIT_LARGE_CLASSES).toBe('string');
    expect(formStyles.SUBMIT_LARGE_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export SUBMIT_DESTRUCTIVE_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.SUBMIT_DESTRUCTIVE_CLASSES).toBe('string');
    expect(formStyles.SUBMIT_DESTRUCTIVE_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export ERROR_BOX_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.ERROR_BOX_CLASSES).toBe('string');
    expect(formStyles.ERROR_BOX_CLASSES.length).toBeGreaterThan(0);
  });

  it('should export LABEL_CLASSES as a non-empty string', () => {
    expect(typeof formStyles.LABEL_CLASSES).toBe('string');
    expect(formStyles.LABEL_CLASSES.length).toBeGreaterThan(0);
  });

  it('should include the Maison Givre palette tokens in INPUT_CLASSES', () => {
    expect(formStyles.INPUT_CLASSES).toContain('bg-mg-ivoire');
    expect(formStyles.INPUT_CLASSES).toContain('text-mg-noir');
    expect(formStyles.INPUT_CLASSES).toContain('focus:border-mg-or');
  });

  it('should style SUBMIT_CLASSES as a dark primary button (mg-noir bg, mg-or hover)', () => {
    expect(formStyles.SUBMIT_CLASSES).toContain('bg-mg-noir');
    expect(formStyles.SUBMIT_CLASSES).toContain('hover:bg-mg-or');
  });

  it('should style SUBMIT_DESTRUCTIVE_CLASSES with mg-or background (no red, per charte)', () => {
    expect(formStyles.SUBMIT_DESTRUCTIVE_CLASSES).toContain('bg-mg-or');
    expect(formStyles.SUBMIT_DESTRUCTIVE_CLASSES).not.toContain('red');
  });

  it('should style ERROR_BOX_CLASSES with mg-or accents (charte sans rouge)', () => {
    expect(formStyles.ERROR_BOX_CLASSES).toContain('border-mg-or');
    expect(formStyles.ERROR_BOX_CLASSES).toContain('text-mg-or');
  });
});
