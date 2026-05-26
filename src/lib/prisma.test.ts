import { describe, it, expect } from 'vitest';
import { isAnnulationOnlyUpdate, IMMUTABILITY_ERROR } from './prisma';

/**
 * Tests unitaires du middleware d'immutabilite Releve (RG-IMMU-001).
 *
 * Pourquoi tester `isAnnulationOnlyUpdate` directement plutot que via une
 * vraie instance Prisma ?
 *   - Pas de dependance DB pour la suite unitaire (F.I.R.S.T : Fast +
 *     Independent).
 *   - La fonction encapsule TOUTE la logique de filtrage : tester son
 *     comportement = tester le garde-fou.
 *   - Les hooks Prisma `$extends.query.releve.*` se contentent d'appeler
 *     `isAnnulationOnlyUpdate(args.data)` puis de throw `IMMUTABILITY_ERROR`
 *     sur false (cf. prisma.ts). La verification que les hooks `delete`,
 *     `deleteMany`, `updateMany`, `upsert` throwent TOUJOURS est garantie
 *     par lecture (pas de branchement). On encadre par un test smoke sur
 *     le contrat exporte (presence + non-empty du message).
 */

describe('[prisma] IMMUTABILITY_ERROR', () => {
  it('should expose a non-empty French message referencing HACCP and the annulation pattern', () => {
    expect(typeof IMMUTABILITY_ERROR).toBe('string');
    expect(IMMUTABILITY_ERROR.length).toBeGreaterThan(0);
    expect(IMMUTABILITY_ERROR).toContain('HACCP');
    expect(IMMUTABILITY_ERROR).toContain('annulation');
  });
});

describe('[prisma] isAnnulationOnlyUpdate', () => {
  it('should reject a temperature update (champ metier)', () => {
    expect(isAnnulationOnlyUpdate({ temperature: -5 })).toBe(false);
  });

  it('should reject a commentaire update (champ metier)', () => {
    expect(isAnnulationOnlyUpdate({ commentaire: 'tampering' })).toBe(false);
  });

  it('should accept { annuleParId: <uuid string> } (whitelist one-way)', () => {
    expect(
      isAnnulationOnlyUpdate({
        annuleParId: '11111111-1111-4111-8111-111111111111',
      })
    ).toBe(true);
  });

  it('should reject { annuleParId: null } (reset interdit, one-way only)', () => {
    expect(isAnnulationOnlyUpdate({ annuleParId: null })).toBe(false);
  });

  it('should reject { annuleParId: undefined } (no-op interdit)', () => {
    expect(isAnnulationOnlyUpdate({ annuleParId: undefined })).toBe(false);
  });

  it('should reject { annuleParId: "" } (string vide rejetee)', () => {
    expect(isAnnulationOnlyUpdate({ annuleParId: '' })).toBe(false);
  });

  it('should reject mixed update { annuleParId, temperature } (mix interdit)', () => {
    expect(
      isAnnulationOnlyUpdate({
        annuleParId: '11111111-1111-4111-8111-111111111111',
        temperature: -5,
      })
    ).toBe(false);
  });

  it('should reject empty data {} (au moins un champ requis)', () => {
    expect(isAnnulationOnlyUpdate({})).toBe(false);
  });

  it('should reject null / undefined data (input invalide)', () => {
    expect(isAnnulationOnlyUpdate(null)).toBe(false);
    expect(isAnnulationOnlyUpdate(undefined)).toBe(false);
  });

  it('should reject non-object data (string / number / boolean)', () => {
    expect(isAnnulationOnlyUpdate('hack')).toBe(false);
    expect(isAnnulationOnlyUpdate(42)).toBe(false);
    expect(isAnnulationOnlyUpdate(true)).toBe(false);
  });

  it('should reject annuleParId as a number (must be string uuid)', () => {
    expect(isAnnulationOnlyUpdate({ annuleParId: 42 })).toBe(false);
  });

  it('should reject any field outside the whitelist even if value is a uuid string', () => {
    expect(
      isAnnulationOnlyUpdate({
        userId: '11111111-1111-4111-8111-111111111111',
      })
    ).toBe(false);
  });
});
