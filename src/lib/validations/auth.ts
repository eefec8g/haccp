import { z } from 'zod';
import { PASSWORD_REGEX } from '@/lib/constants/auth';

const PASSWORDS_DO_NOT_MATCH = 'Les mots de passe ne correspondent pas';
const PASSWORD_TOO_WEAK =
  'Le mot de passe doit contenir au moins 12 caracteres, une minuscule, une majuscule, un chiffre et un caractere special';

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("L'email est invalide");

/**
 * Schema de connexion : email normalise + password non vide.
 * La verification de la force du mot de passe n'a PAS lieu ici
 * (un user existant peut avoir un mot de passe legacy).
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Le mot de passe est requis'),
});

/**
 * Demande de reinitialisation : seul l'email est necessaire.
 */
export const forgotPasswordSchema = z.object({
  email: emailField,
});

/**
 * Reinitialisation effective : token + nouveau password (fort).
 * `confirmPassword` doit etre identique a `password`.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, 'Token invalide'),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_TOO_WEAK),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: PASSWORDS_DO_NOT_MATCH,
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
