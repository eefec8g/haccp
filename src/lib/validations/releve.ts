import { z } from 'zod';
import { Creneau } from '@prisma/client';
import {
  COMMENTAIRE_MAX_CHARS,
  MOTIF_ANNULATION_MAX_CHARS,
  MOTIF_ANNULATION_MIN_CHARS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
} from '@/lib/constants/releve';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PERIODE_DAYS,
  MAX_PAGE_SIZE,
  MAX_PERIODE_DAYS,
} from '@/lib/constants/releve-listing';
import { MILLIS_PER_DAY } from '@/lib/constants/time';
import { daysInclusive, todayParisISO } from '@/lib/utils/dates';

/**
 * Schemas Zod du module Releve (socle commun, Epic RELEVE).
 *
 * La regle metier "commentaire obligatoire si hors seuils" n'est PAS
 * appliquee au niveau Zod : on ne connait pas les seuils equipement
 * sans une lecture DB. Elle est donc enforcee dans `releve.service`
 * (RG-COMM-001).
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const temperatureField = z
  .number({ invalid_type_error: 'La temperature doit etre un nombre' })
  .finite('La temperature doit etre finie')
  .min(TEMPERATURE_MIN, `La temperature doit etre >= ${TEMPERATURE_MIN}`)
  .max(TEMPERATURE_MAX, `La temperature doit etre <= ${TEMPERATURE_MAX}`);

const commentaireOptional = z
  .string()
  .trim()
  .max(COMMENTAIRE_MAX_CHARS, `Le commentaire est trop long`)
  .optional()
  .transform((value) =>
    value !== undefined && value.length > 0 ? value : undefined
  );

/**
 * Creation d'un releve (US-REL-002). La boutique est deduite de
 * l'equipement (RG-PER-001), jamais acceptee du client.
 */
export const releveCreateSchema = z.object({
  equipementId: z.string().uuid('Identifiant equipement invalide'),
  creneau: z.nativeEnum(Creneau),
  temperature: temperatureField,
  commentaire: commentaireOptional,
});

/**
 * Annulation d'un releve (US-REL-004). Le motif est obligatoire.
 * `replacement` permet de creer un nouveau releve actif a la place
 * (scenario "la vraie valeur etait -22") dans la meme transaction.
 */
export const releveAnnulationSchema = z.object({
  releveId: z.string().uuid('Identifiant releve invalide'),
  motif: z
    .string()
    .trim()
    .min(
      MOTIF_ANNULATION_MIN_CHARS,
      `Le motif doit faire au moins ${MOTIF_ANNULATION_MIN_CHARS} caracteres`
    )
    .max(
      MOTIF_ANNULATION_MAX_CHARS,
      `Le motif doit faire au plus ${MOTIF_ANNULATION_MAX_CHARS} caracteres`
    ),
  replacement: z
    .object({
      temperature: temperatureField,
      commentaire: commentaireOptional,
    })
    .optional(),
});

/**
 * Correction inline d'un releve par son auteur depuis la tournee guidee
 * (fix/signature-action-context). Le salarie corrige SON PROPRE releve du
 * jour AVANT signature : on identifie le releve a corriger (`releveId`) et
 * on fournit la nouvelle valeur. Le motif d'annulation est auto-genere
 * cote service (pas demande au salarie). Le creneau est verifie cote
 * service contre le releve original (defense en profondeur).
 */
export const releveCorrectionSchema = z.object({
  releveId: z.string().uuid('Identifiant releve invalide'),
  equipementId: z.string().uuid('Identifiant equipement invalide'),
  creneau: z.nativeEnum(Creneau),
  temperature: temperatureField,
  commentaire: commentaireOptional,
});

/**
 * Query string `/releves?date=YYYY-MM-DD` (US-REL-001). Par defaut
 * (date absente) le service prend la date du jour Europe/Paris.
 */
export const tourneeQuerySchema = z.object({
  date: z
    .string()
    .regex(ISO_DATE_REGEX, 'La date doit etre au format YYYY-MM-DD')
    .optional(),
});

/**
 * Pagination de l'historique salarie (US-REL-003). Borne pageSize a 50
 * pour eviter `?pageSize=10000`.
 */
export const releveHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  equipementId: z.string().uuid().optional(),
});

/**
 * Schema query du listing releves multi-jours (Epic LISTING, Phase 1).
 *
 * Tous les filtres sont optionnels (defauts appliques pour `dateStart`,
 * `dateEnd`, `page`, `pageSize`). La validation custom `.superRefine`
 * verifie cote Zod l'ordre + max + futur de la periode (defense en
 * profondeur cote service via `validateListingPeriode`).
 *
 * - `dateStart`/`dateEnd` : ISO `YYYY-MM-DD`. Defaut = derniers
 *   `DEFAULT_PERIODE_DAYS` jours jusqu'a today Europe/Paris.
 * - `page`/`pageSize` : `z.coerce.number` pour accepter les query strings
 *   `?page=2`. Bornes : page >= 1, pageSize 1..`MAX_PAGE_SIZE`.
 * - `boutiqueId`/`equipementId` : UUID stricts. Le service verifie
 *   ensuite le scope multi-tenant (anti-enum).
 * - `creneau` : nativeEnum Prisma.
 * - `statut` : enum literal aligne sur `ReleveListingStatut`.
 */
const LISTING_ISO_DATE_FIELD = z
  .string()
  .regex(ISO_DATE_REGEX, 'La date doit etre au format YYYY-MM-DD');

function computeDefaultPeriode(): {
  readonly dateStart: string;
  readonly dateEnd: string;
} {
  const today = todayParisISO();
  const startMs =
    new Date(`${today}T00:00:00.000Z`).getTime() -
    (DEFAULT_PERIODE_DAYS - 1) * MILLIS_PER_DAY;
  const dateStart = new Date(startMs).toISOString().slice(0, 10);
  return { dateStart, dateEnd: today };
}

interface NormalizedListingQuery {
  readonly boutiqueId?: string;
  readonly equipementId?: string;
  readonly creneau?: Creneau;
  readonly statut?: 'SAISI' | 'ALERTE' | 'MANQUANT' | 'ANNULE';
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly page: number;
  readonly pageSize: number;
}

export const releveListingQuerySchema = z
  .object({
    boutiqueId: z.string().uuid('Identifiant boutique invalide').optional(),
    equipementId: z.string().uuid('Identifiant equipement invalide').optional(),
    creneau: z.nativeEnum(Creneau).optional(),
    statut: z.enum(['SAISI', 'ALERTE', 'MANQUANT', 'ANNULE']).optional(),
    dateStart: LISTING_ISO_DATE_FIELD.optional(),
    dateEnd: LISTING_ISO_DATE_FIELD.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
  })
  .transform((data): NormalizedListingQuery => {
    // Si l'une des bornes est absente, on applique le defaut "30 derniers
    // jours" pour les deux (eviter une periode tronquee mi-explicite).
    if (data.dateStart && data.dateEnd) {
      return { ...data, dateStart: data.dateStart, dateEnd: data.dateEnd };
    }
    const defaults = computeDefaultPeriode();
    return {
      ...data,
      dateStart: data.dateStart ?? defaults.dateStart,
      dateEnd: data.dateEnd ?? defaults.dateEnd,
    };
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
    if (daysInclusive(data.dateStart, data.dateEnd) > MAX_PERIODE_DAYS) {
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

export type ReleveCreateInput = z.infer<typeof releveCreateSchema>;
export type ReleveAnnulationInput = z.infer<typeof releveAnnulationSchema>;
export type ReleveCorrectionInput = z.infer<typeof releveCorrectionSchema>;
export type TourneeQuery = z.infer<typeof tourneeQuerySchema>;
export type ReleveHistoryQuery = z.infer<typeof releveHistoryQuerySchema>;
export type ReleveListingQueryInput = z.infer<typeof releveListingQuerySchema>;
