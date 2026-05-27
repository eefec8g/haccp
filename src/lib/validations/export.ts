import { z } from 'zod';
import { MAX_EXPORT_RANGE_DAYS } from '@/lib/constants/export';
import {
  CONSOLIDE_DATE_ISO_REGEX,
  MAX_PERIODE_DAYS,
} from '@/lib/constants/export-consolide';
import { MILLIS_PER_DAY } from '@/lib/constants/time';
import { daysInclusive, todayParisISO } from '@/lib/utils/dates';

/**
 * Schemas Zod de l'Epic EXPORT.
 *
 * Borne range a `MAX_EXPORT_RANGE_DAYS` jours pour eviter (a) l'OOM
 * serverless (b) un export que personne ne sera capable de relire pour
 * un audit. Les filtres optionnels (boutique, equipement) sont la pour
 * permettre a un responsable de scope ses exports par site.
 *
 * `exportConsolideQuerySchema` (Epic REGISTRE US-REG-001) :
 *   Borne dure a `MAX_PERIODE_DAYS` jours et refuse les dates futures.
 *   `boutiqueId` est OPTIONNEL : si absent, le service utilisera tout le
 *   scope viewer (mode "toutes mes boutiques").
 *   Validation supplementaire (SEC-1) : la regex YYYY-MM-DD accepte
 *   `2026-02-30` qui n'existe pas. Un `.refine` valide le round-trip
 *   ISO via `new Date(...).toISOString().slice(0,10) === input`.
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

/**
 * Verifie qu'une date ISO `YYYY-MM-DD` correspond a un jour qui existe
 * reellement (2026-02-30 -> false). Le `new Date('2026-02-30T...')` ne
 * throw pas ; il decale vers `2026-03-02` (UTC) -- on detecte le drift
 * par round-trip slice.
 */
function isCalendarDate(dateISO: string): boolean {
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH) === dateISO;
}

const isoDateField = z
  .string()
  .regex(ISO_DATE_REGEX, 'Date au format YYYY-MM-DD requise')
  .refine(isCalendarDate, 'Date inexistante');

const consolideIsoDateField = z
  .string()
  .regex(CONSOLIDE_DATE_ISO_REGEX, 'Date au format YYYY-MM-DD requise')
  .refine(isCalendarDate, 'Date inexistante');

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

/**
 * Schema du registre journalier consolide (US-REG-001).
 *
 * Validation en chaine (les `superRefine` issuent des erreurs avec un
 * `path` precis pour permettre un affichage UI cible) :
 *   1. `dateStart` et `dateEnd` au format ISO YYYY-MM-DD (regex + round-trip).
 *   2. `boutiqueId` UUID si fourni.
 *   3. `dateEnd >= dateStart` (sinon PERIODE_INVALID cote service).
 *   4. Difference jours <= `MAX_PERIODE_DAYS` (sinon PERIODE_TOO_LARGE).
 *   5. `dateEnd <= today Europe/Paris` (sinon PERIODE_IN_FUTURE).
 *
 * Les memes regles sont reverifiees cote service (defense en profondeur)
 * pour ne pas dependre uniquement du parsing Zod a l'API.
 */
export const exportConsolideQuerySchema = z
  .object({
    boutiqueId: uuidField.optional(),
    dateStart: consolideIsoDateField,
    dateEnd: consolideIsoDateField,
  })
  .superRefine((data, ctx) => {
    if (new Date(data.dateEnd).getTime() < new Date(data.dateStart).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'La date de fin doit etre superieure ou egale a la date de debut',
        path: ['dateEnd'],
      });
      return;
    }
    const days = daysInclusive(data.dateStart, data.dateEnd);
    if (days > MAX_PERIODE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `La periode doit etre inferieure ou egale a ${MAX_PERIODE_DAYS} jours`,
        path: ['dateEnd'],
      });
      return;
    }
    if (data.dateEnd > todayParisISO()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date de fin ne peut pas etre dans le futur',
        path: ['dateEnd'],
      });
    }
  });

export type ExportCsvQuery = z.infer<typeof exportCsvQuerySchema>;
export type ExportPdfQuery = z.infer<typeof exportPdfQuerySchema>;
export type ExportConsolideQuery = z.infer<typeof exportConsolideQuerySchema>;
