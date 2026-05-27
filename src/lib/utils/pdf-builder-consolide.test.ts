import { describe, it, expect } from 'vitest';
import { buildRegistreConsolidePdf } from './pdf-builder-consolide';
import type { RegistreConsolide } from '@/types/export-consolide';

/**
 * Tests du PDF builder consolide (Epic REGISTRE Phase 2).
 *
 * Strategie alignee sur `pdf-builder.test.ts` :
 *   - On valide les "PDF magic bytes" (`%PDF-`) et une taille minimale ;
 *     suffisant pour garantir que pdfmake n'a pas throw et que le doc
 *     definition est syntaxiquement valide.
 *   - On valide les cas degrades (donnees vides) pour s'assurer que les
 *     placeholders "Aucune donnee" sont injectes sans casser le rendu.
 *
 * On ne fait PAS de regex sur le PDF binaire (Helvetica encode les
 * caracteres en `Tj` operators non-ASCII): ces verifications seraient
 * fragiles. Le contenu textuel est valide a travers les tests du service
 * en amont (`export-consolide.service.test.ts`).
 */

const EMPTY_STATS = {
  totalRelevesAttendus: 0,
  totalRelevesSaisis: 0,
  relevesManquants: 0,
  tauxConformite: 0,
  totalAlertes: 0,
  alertesOuvertes: 0,
  alertesTraitees: 0,
  tauxResolutionAlertes: 0,
  totalSignatures: 0,
  joursAvecSignature: 0,
} as const;

function makeRegistre(
  overrides: Partial<RegistreConsolide> = {}
): RegistreConsolide {
  return {
    periode: { dateStart: '2026-05-01', dateEnd: '2026-05-03', jours: 3 },
    boutiques: [{ id: 'b1', nom: 'MG Paris 11', ville: 'Paris' }],
    jours: [
      {
        dateISO: '2026-05-01',
        equipements: [
          {
            equipementId: 'e1',
            equipementNom: 'CGL-01',
            boutiqueId: 'b1',
            boutiqueNom: 'MG Paris 11',
            releves: {
              matin: { temperature: -22, alerte: false, salarieNom: 'Nina' },
              midi: { temperature: -10, alerte: true, salarieNom: 'Nina' },
              soir: null,
            },
          },
        ],
      },
    ],
    alertes: [
      {
        id: 'a1',
        dateISO: '2026-05-01',
        equipementNom: 'CGL-01',
        boutiqueNom: 'MG Paris 11',
        temperature: -10,
        creneau: 'MIDI',
        statut: 'RESOLUE',
        motif: 'Porte refermee',
        salarieNom: 'Nina',
        signaleeAt: new Date('2026-05-01T13:45:00Z'),
        traiteeAt: new Date('2026-05-01T15:00:00Z'),
        traiteParNom: 'Manager Dupont',
      },
    ],
    signatures: [
      {
        id: 's1',
        dateISO: '2026-05-01',
        boutiqueNom: 'MG Paris 11',
        signataireNom: 'Sophie',
        signataireRoleSnapshot: 'RESPONSABLE',
        signedAt: new Date('2026-05-01T18:00:00Z'),
      },
    ],
    stats: {
      totalRelevesAttendus: 9,
      totalRelevesSaisis: 7,
      relevesManquants: 2,
      tauxConformite: 78,
      totalAlertes: 1,
      alertesOuvertes: 0,
      alertesTraitees: 1,
      tauxResolutionAlertes: 100,
      totalSignatures: 1,
      joursAvecSignature: 1,
    },
    ...overrides,
  };
}

describe('[pdf-builder-consolide] buildRegistreConsolidePdf', () => {
  it('should return a non-empty Buffer starting with the PDF magic bytes for a complete payload', async () => {
    const buf = await buildRegistreConsolidePdf(makeRegistre());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should produce a valid PDF when no releves are recorded over the periode', async () => {
    const buf = await buildRegistreConsolidePdf(
      makeRegistre({ jours: [], stats: EMPTY_STATS })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('should produce a valid PDF when there are no alertes', async () => {
    const buf = await buildRegistreConsolidePdf(makeRegistre({ alertes: [] }));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should produce a valid PDF when the annexe signatures is empty', async () => {
    const buf = await buildRegistreConsolidePdf(
      makeRegistre({ signatures: [] })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should produce a valid PDF for a single-day single-boutique minimal payload', async () => {
    const buf = await buildRegistreConsolidePdf(
      makeRegistre({
        periode: { dateStart: '2026-05-01', dateEnd: '2026-05-01', jours: 1 },
        jours: [],
        alertes: [],
        signatures: [],
        stats: EMPTY_STATS,
        boutiques: [],
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should produce a valid PDF when boutique has no ville', async () => {
    const buf = await buildRegistreConsolidePdf(
      makeRegistre({
        boutiques: [{ id: 'b1', nom: 'MG Test', ville: null }],
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should handle an alerte without motif (traiteParNom null) without throwing', async () => {
    const buf = await buildRegistreConsolidePdf(
      makeRegistre({
        alertes: [
          {
            id: 'a2',
            dateISO: '2026-05-02',
            equipementNom: 'CGL-02',
            boutiqueNom: 'MG Paris 11',
            temperature: -8,
            creneau: 'MATIN',
            statut: 'OUVERTE',
            motif: null,
            salarieNom: 'Nina',
            signaleeAt: new Date('2026-05-02T08:00:00Z'),
            traiteeAt: null,
            traiteParNom: null,
          },
        ],
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
