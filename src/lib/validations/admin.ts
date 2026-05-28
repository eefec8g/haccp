import { z } from 'zod';
import { TypeEquipement, UserRole } from '@prisma/client';
import { PASSWORD_REGEX } from '@/lib/constants/auth';
import {
  ADMIN_PAGE_SIZE,
  ADMIN_PAGE_SIZE_MAX,
  ASSIGNABLE_ROLES,
  BOUTIQUE_ADRESSE_MAX,
  BOUTIQUE_NOM_MAX,
  BOUTIQUE_NOM_MIN,
  BOUTIQUE_VILLE_MAX,
  ENTITY_DISABLE_MOTIF_MAX,
  EQUIPEMENT_NOM_MAX,
  EQUIPEMENT_NOM_MIN,
  SEUIL_TEMP_MAX,
  SEUIL_TEMP_MIN,
  USER_NOM_MAX,
} from '@/lib/constants/admin';

const PASSWORDS_DO_NOT_MATCH = 'Les mots de passe ne correspondent pas';
const PASSWORD_TOO_WEAK =
  'Le mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special';
const SEUILS_INVALID =
  'Le seuil minimum doit etre strictement inferieur au seuil maximum';
const SALARIE_BOUTIQUE_REQUIRED =
  'Un SALARIE doit etre rattache a une boutique';
const RESPONSABLE_BOUTIQUE_REQUIRED =
  'Un RESPONSABLE doit etre rattache a au moins une boutique';
const ROLE_NOT_ASSIGNABLE = 'Ce role ne peut pas etre assigne';
const ASSIGNMENT_NOT_ALLOWED_FOR_ROLE =
  'Ce rattachement de boutique est incompatible avec le role choisi';

const ASSIGNABLE_ROLES_SET = new Set<UserRole>(ASSIGNABLE_ROLES);

const trimmedString = z.string().trim();
const uuidField = z.string().uuid();
const emailField = trimmedString.toLowerCase().email("L'email est invalide");

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_LENGTH = 10;

/**
 * Verifie qu'une date ISO `YYYY-MM-DD` correspond a un jour reel
 * (`2026-02-30` -> false). `new Date(...)` ne throw pas, il decale ; on
 * detecte le drift par round-trip slice UTC (meme strategie que
 * `validations/export.ts`).
 */
function isCalendarDate(dateISO: string): boolean {
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH) === dateISO;
}

/**
 * Champ date ISO `YYYY-MM-DD` obligatoire (input `<input type="date">`).
 * Transforme en `Date` UTC minuit pour persistance Prisma `@db.Date`.
 */
const isoDateField = z
  .string()
  .regex(ISO_DATE_REGEX, 'Date au format YYYY-MM-DD requise')
  .refine(isCalendarDate, 'Date inexistante')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const seuilField = z
  .number({ invalid_type_error: 'Le seuil doit etre un nombre' })
  .min(SEUIL_TEMP_MIN, `Le seuil doit etre >= ${SEUIL_TEMP_MIN}`)
  .max(SEUIL_TEMP_MAX, `Le seuil doit etre <= ${SEUIL_TEMP_MAX}`);

/**
 * Champ texte court optionnel : "" et "   " sont normalises en
 * undefined pour eviter de persister des chaines vides en DB.
 */
function optionalTrimmedField(max: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
    .pipe(z.string().max(max).optional());
}

/**
 * Schemas Boutique.
 */
export const boutiqueCreateSchema = z.object({
  nom: trimmedString
    .min(
      BOUTIQUE_NOM_MIN,
      `Le nom doit faire au moins ${BOUTIQUE_NOM_MIN} caracteres`
    )
    .max(
      BOUTIQUE_NOM_MAX,
      `Le nom doit faire au plus ${BOUTIQUE_NOM_MAX} caracteres`
    ),
  adresse: optionalTrimmedField(BOUTIQUE_ADRESSE_MAX),
  ville: optionalTrimmedField(BOUTIQUE_VILLE_MAX),
  dateOuverture: isoDateField,
});

export const boutiqueUpdateSchema = boutiqueCreateSchema.partial();

/**
 * Schemas Equipement. Seuils obligatoires (decision Epic ADMIN #4),
 * et seuilMin doit etre strictement inferieur a seuilMax (refine).
 */
export const equipementCreateSchema = z
  .object({
    nom: trimmedString
      .min(
        EQUIPEMENT_NOM_MIN,
        `Le nom doit faire au moins ${EQUIPEMENT_NOM_MIN} caractere`
      )
      .max(
        EQUIPEMENT_NOM_MAX,
        `Le nom doit faire au plus ${EQUIPEMENT_NOM_MAX} caracteres`
      ),
    type: z.nativeEnum(TypeEquipement),
    boutiqueId: uuidField,
    seuilMin: seuilField,
    seuilMax: seuilField,
    dateMiseEnService: isoDateField,
  })
  .refine((data) => data.seuilMin < data.seuilMax, {
    message: SEUILS_INVALID,
    path: ['seuilMax'],
  });

/**
 * Update : tous les champs sont optionnels, mais si seuilMin ET
 * seuilMax sont fournis ensemble on revalide la coherence.
 */
export const equipementUpdateSchema = z
  .object({
    nom: trimmedString
      .min(EQUIPEMENT_NOM_MIN)
      .max(EQUIPEMENT_NOM_MAX)
      .optional(),
    type: z.nativeEnum(TypeEquipement).optional(),
    boutiqueId: uuidField.optional(),
    seuilMin: seuilField.optional(),
    seuilMax: seuilField.optional(),
    dateMiseEnService: isoDateField.optional(),
  })
  .refine(
    (data) =>
      data.seuilMin === undefined ||
      data.seuilMax === undefined ||
      data.seuilMin < data.seuilMax,
    { message: SEUILS_INVALID, path: ['seuilMax'] }
  );

/**
 * Invitation user. La coherence role/boutique est verifiee par refine :
 *   - SALARIE -> boutiqueSalarieId requis
 *   - RESPONSABLE -> boutiquesResponsable non vide
 *   - ADMIN -> pas de boutique (aucune contrainte)
 */
export const userInviteSchema = z
  .object({
    email: emailField,
    name: trimmedString.min(1, 'Le nom est requis').max(USER_NOM_MAX),
    role: z.nativeEnum(UserRole).refine((r) => ASSIGNABLE_ROLES_SET.has(r), {
      message: ROLE_NOT_ASSIGNABLE,
    }),
    boutiqueSalarieId: uuidField.optional(),
    boutiquesResponsable: z.array(uuidField).default([]),
  })
  .refine(
    (data) =>
      data.role !== 'SALARIE' || typeof data.boutiqueSalarieId === 'string',
    { message: SALARIE_BOUTIQUE_REQUIRED, path: ['boutiqueSalarieId'] }
  )
  .refine(
    (data) =>
      data.role !== 'RESPONSABLE' || data.boutiquesResponsable.length > 0,
    { message: RESPONSABLE_BOUTIQUE_REQUIRED, path: ['boutiquesResponsable'] }
  );

/**
 * Edition des rattachements d'un utilisateur existant (US-ADM-006).
 *
 * Memes regles de coherence role/rattachement que `userInviteSchema`,
 * mais sans email/name (immuables ici) et avec un `userId` cible.
 *   - SALARIE     -> boutiqueSalarieId requis, boutiquesResponsable vide
 *   - RESPONSABLE -> boutiquesResponsable non vide, boutiqueSalarieId absent
 *   - ADMIN       -> aucun rattachement
 *
 * Contrairement a l'invitation, on impose aussi l'ABSENCE du
 * rattachement non pertinent (ex : un SALARIE ne doit pas porter de
 * boutiquesResponsable residuelles) pour eviter tout etat incoherent
 * persiste en base.
 */
export const updateUserAssignmentSchema = z
  .object({
    userId: uuidField,
    role: z.nativeEnum(UserRole).refine((r) => ASSIGNABLE_ROLES_SET.has(r), {
      message: ROLE_NOT_ASSIGNABLE,
    }),
    boutiqueSalarieId: uuidField.optional(),
    boutiquesResponsable: z.array(uuidField).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'SALARIE') {
      if (typeof data.boutiqueSalarieId !== 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: SALARIE_BOUTIQUE_REQUIRED,
          path: ['boutiqueSalarieId'],
        });
      }
      if (data.boutiquesResponsable.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: ASSIGNMENT_NOT_ALLOWED_FOR_ROLE,
          path: ['boutiquesResponsable'],
        });
      }
      return;
    }
    if (data.role === 'RESPONSABLE') {
      if (data.boutiquesResponsable.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: RESPONSABLE_BOUTIQUE_REQUIRED,
          path: ['boutiquesResponsable'],
        });
      }
      if (typeof data.boutiqueSalarieId === 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: ASSIGNMENT_NOT_ALLOWED_FOR_ROLE,
          path: ['boutiqueSalarieId'],
        });
      }
      return;
    }
    // role === ADMIN : aucun rattachement autorise.
    if (typeof data.boutiqueSalarieId === 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ASSIGNMENT_NOT_ALLOWED_FOR_ROLE,
        path: ['boutiqueSalarieId'],
      });
    }
    if (data.boutiquesResponsable.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ASSIGNMENT_NOT_ALLOWED_FOR_ROLE,
        path: ['boutiquesResponsable'],
      });
    }
  });

/**
 * Acceptation d'invitation : token + password fort + confirm match.
 * On reutilise le PASSWORD_REGEX d'auth.ts (DRY).
 */
export const acceptInvitationSchema = z
  .object({
    token: z.string().min(32, 'Token invalide'),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_TOO_WEAK),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: PASSWORDS_DO_NOT_MATCH,
    path: ['confirmPassword'],
  });

/**
 * Desactivation d'entite : motif optionnel pour la tracabilite admin.
 */
export const entityDisableSchema = z.object({
  id: uuidField,
  motif: trimmedString.max(ENTITY_DISABLE_MOTIF_MAX).optional(),
});

/**
 * Coercion `?page=2&pageSize=50` -> nombres. Bornes appliquees.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_PAGE_SIZE_MAX)
    .default(ADMIN_PAGE_SIZE),
});

export type BoutiqueCreateInput = z.infer<typeof boutiqueCreateSchema>;
export type BoutiqueUpdateInput = z.infer<typeof boutiqueUpdateSchema>;
export type EquipementCreateInput = z.infer<typeof equipementCreateSchema>;
export type EquipementUpdateInput = z.infer<typeof equipementUpdateSchema>;
export type UserInviteInput = z.infer<typeof userInviteSchema>;
export type UpdateUserAssignmentInput = z.infer<
  typeof updateUserAssignmentSchema
>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type EntityDisableInput = z.infer<typeof entityDisableSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
