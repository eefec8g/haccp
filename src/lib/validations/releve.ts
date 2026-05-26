import { z } from 'zod';
import { Creneau } from '@prisma/client';
import {
  COMMENTAIRE_MAX_CHARS,
  MOTIF_ANNULATION_MAX_CHARS,
  MOTIF_ANNULATION_MIN_CHARS,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
} from '@/lib/constants/releve';

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

export type ReleveCreateInput = z.infer<typeof releveCreateSchema>;
export type ReleveAnnulationInput = z.infer<typeof releveAnnulationSchema>;
export type TourneeQuery = z.infer<typeof tourneeQuerySchema>;
export type ReleveHistoryQuery = z.infer<typeof releveHistoryQuerySchema>;
