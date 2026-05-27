import { describe, it, expect } from 'vitest';
import { buildRegistreJournalierPdf } from './pdf-builder';
import type { RegistreJournalier } from '@/types/export';

function makeRegistre(
  overrides: Partial<RegistreJournalier> = {}
): RegistreJournalier {
  return {
    dateISO: '2026-05-27',
    boutique: {
      id: 'b1',
      nom: 'MG Paris 11',
      adresse: '12 rue de la Roquette',
      ville: '75011 Paris',
    },
    generatedBy: { nom: 'Jane Doe', role: 'RESPONSABLE' },
    generatedAt: new Date('2026-05-27T10:30:00Z'),
    equipements: [
      {
        equipementId: 'e1',
        equipementNom: 'Congelateur CGL-01',
        equipementType: 'CONGELATEUR',
        seuilMin: -25,
        seuilMax: -18,
        creneaux: [
          {
            creneau: 'MATIN',
            temperature: -20.5,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: 'Nina',
            heureSaisie: '08:30',
          },
          {
            creneau: 'MIDI',
            temperature: -10,
            commentaire: 'Porte ouverte',
            alerteHorsSeuils: true,
            salarieNom: 'Nina',
            heureSaisie: '13:45',
          },
          {
            creneau: 'SOIR',
            temperature: null,
            commentaire: null,
            alerteHorsSeuils: false,
            salarieNom: null,
            heureSaisie: null,
          },
        ],
      },
    ],
    alertes: [
      {
        alerteId: 'a1',
        equipementNom: 'Congelateur CGL-01',
        creneau: 'MIDI',
        temperature: -10,
        seuilMin: -25,
        seuilMax: -18,
        status: 'RESOLUE',
        commentaireResolution:
          'Porte refermee apres livraison, temperature revenue a -20',
        resoluParNom: 'Manager Dupont',
        resoluAt: new Date('2026-05-27T15:00:00Z'),
      },
    ],
    ...overrides,
  };
}

describe('[pdf-builder]', () => {
  it('should return a non-empty Buffer that starts with the PDF magic bytes', async () => {
    const buf = await buildRegistreJournalierPdf(makeRegistre());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('should still produce a valid PDF when there are no releves and no alertes', async () => {
    const buf = await buildRegistreJournalierPdf(
      makeRegistre({ equipements: [], alertes: [] })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('should produce a valid PDF for a boutique without address', async () => {
    const buf = await buildRegistreJournalierPdf(
      makeRegistre({
        boutique: {
          id: 'b1',
          nom: 'MG Bastille',
          adresse: null,
          ville: null,
        },
      })
    );
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
