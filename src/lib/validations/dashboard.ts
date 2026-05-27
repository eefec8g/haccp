import { z } from 'zod';

/**
 * Schema de query du dashboard (Phase 1).
 *
 * Deux parametres optionnels :
 *   - `boutiqueId` : filtre le scope a UNE boutique (Responsable
 *     multi-boutiques, ou Admin focus). Si non renseigne : tout le
 *     scope du viewer.
 *   - `dateISO` : permet d'inspecter un jour passe (`YYYY-MM-DD`).
 *     Defaut a la date du jour Europe/Paris cote service.
 *
 * Le format `YYYY-MM-DD` est verifie strictement pour aligner sur la
 * convention de `Releve.date` (cf. `@/lib/utils/dates`).
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const dashboardQuerySchema = z.object({
  boutiqueId: z.string().uuid().optional(),
  dateISO: z.string().regex(ISO_DATE_PATTERN).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
