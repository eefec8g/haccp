import { describe, it, expect } from 'vitest';
import {
  isAnnulationOnlyUpdate,
  IMMUTABILITY_ERROR,
  SIGNATURE_IMMUTABILITY_ERROR,
  db,
} from './prisma';

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

describe('[prisma] SIGNATURE_IMMUTABILITY_ERROR', () => {
  it('should expose a non-empty French message referencing HACCP and the audit DDPP intent', () => {
    expect(typeof SIGNATURE_IMMUTABILITY_ERROR).toBe('string');
    expect(SIGNATURE_IMMUTABILITY_ERROR.length).toBeGreaterThan(0);
    expect(SIGNATURE_IMMUTABILITY_ERROR).toContain('HACCP');
    expect(SIGNATURE_IMMUTABILITY_ERROR).toContain('Signature');
  });
});

/**
 * Le `$extends.query.signature.*` doit throw AVANT toute requete DB
 * (le throw est synchrone dans le hook). On peut donc verifier le
 * contrat sans connexion Postgres : Prisma resout d'abord les hooks
 * `query`, et notre code rejette immediatement le call.
 *
 * Pourquoi tester toutes les operations ? Le hook `update` Releve a
 * une exception controlee (annulation), pas le hook Signature : on
 * verifie explicitement que CHAQUE operation rejette, y compris
 * `update` (pour empecher tout drift futur du contrat).
 */
describe('[prisma] Signature immutability hooks', () => {
  const SIG_ID = 'sig-1';

  it('should throw on signature.update', async () => {
    await expect(
      db.signature.update({
        where: { id: SIG_ID },
        data: { blobUrl: 'tamper' },
      })
    ).rejects.toThrow(SIGNATURE_IMMUTABILITY_ERROR);
  });

  it('should throw on signature.updateMany', async () => {
    await expect(
      db.signature.updateMany({
        where: { boutiqueId: 'b1' },
        data: { blobUrl: 'tamper' },
      })
    ).rejects.toThrow(SIGNATURE_IMMUTABILITY_ERROR);
  });

  it('should throw on signature.delete', async () => {
    await expect(
      db.signature.delete({ where: { id: SIG_ID } })
    ).rejects.toThrow(SIGNATURE_IMMUTABILITY_ERROR);
  });

  it('should throw on signature.deleteMany', async () => {
    await expect(
      db.signature.deleteMany({ where: { boutiqueId: 'b1' } })
    ).rejects.toThrow(SIGNATURE_IMMUTABILITY_ERROR);
  });

  it('should throw on signature.upsert', async () => {
    await expect(
      db.signature.upsert({
        where: { id: SIG_ID },
        create: {
          boutiqueId: 'b1',
          dateISO: '2026-05-27',
          signataireId: 'u1',
          signataireRoleSnapshot: 'SALARIE',
          storageKey: 'k',
          blobUrl: 'u',
        },
        update: { blobUrl: 'tamper' },
      })
    ).rejects.toThrow(SIGNATURE_IMMUTABILITY_ERROR);
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
