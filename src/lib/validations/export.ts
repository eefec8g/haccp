import { z } from 'zod';
import { MAX_EXPORT_RANGE_DAYS } from '@/lib/constants/export';

/**
 * Schemas Zod de l'Epic EXPORT.
 *
 * Borne range a `MAX_EXPORT_RANGE_DAYS` jours pour eviter (a) l'OOM
 * serverless (b) un export que personne ne sera capable de relire pour
 * un audit. Les filtres optionnels (boutique, equipement) sont la pour
 * permettre a un responsable de scope ses exports par site.
 */

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format YYYY-MM-DD requise');

const uuidField = z.string().uuid('Identifiant invalide');

export const exportCsvQuerySchema = z
  .object({
    dateFrom: isoDateField,
    dateTo: isoDateField,
    boutiqueId: uuidField.optional(),
    equipementId: uuidField.optional(),
  })
  .refine(
    (data) =>
      new Date(data.dateTo).getTime() >= new Date(data.dateFrom).getTime(),
    {
      message:
        'La date de fin doit etre superieure ou egale a la date de debut',
      path: ['dateTo'],
    }
  )
  .refine(
    (data) => {
      const diffMs =
        new Date(data.dateTo).getTime() - new Date(data.dateFrom).getTime();
      const diffDays = Math.floor(diffMs / MILLIS_PER_DAY);
      return diffDays <= MAX_EXPORT_RANGE_DAYS;
    },
    {
      message: `La periode doit etre inferieure ou egale a ${MAX_EXPORT_RANGE_DAYS} jours`,
      path: ['dateTo'],
    }
  );

export const exportPdfQuerySchema = z.object({
  date: isoDateField,
  boutiqueId: uuidField,
});

export type ExportCsvQuery = z.infer<typeof exportCsvQuerySchema>;
export type ExportPdfQuery = z.infer<typeof exportPdfQuerySchema>;
