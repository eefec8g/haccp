import { NextResponse } from 'next/server';

/**
 * Helpers pour construire des reponses API typees et homogenes.
 *
 * Tous les endpoints HACCP repondent en JSON avec la meme forme
 * `{ error, code }` pour les cas non-2xx, ce qui permet au client
 * (LoginForm, hooks fetch) de discriminer les erreurs sans parser
 * le message FR.
 *
 * Pattern aligne sur C8GApp (lib/api/response.ts) pour faciliter le
 * partage de helpers et la lecture cross-projet.
 */

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_INTERNAL_ERROR = 500;

const MILLISECONDS_PER_SECOND = 1000;

const GENERIC_INTERNAL_ERROR = 'Erreur interne';
const DEFAULT_UNAUTHORIZED = 'Non autorise';
const DEFAULT_FORBIDDEN = 'Acces interdit';
const DEFAULT_NOT_FOUND = 'Ressource non trouvee';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  readonly error: string;
  readonly code: ApiErrorCode;
}

/**
 * Construit une reponse d'erreur typee `{ error, code }` avec le status
 * HTTP correspondant. Centralisation indispensable pour ne jamais oublier
 * le champ `code` (consume par le client pour discriminer les erreurs).
 */
export function createErrorResponse(
  error: string,
  code: ApiErrorCode,
  status: number
): NextResponse<ApiErrorResponse> {
  return NextResponse.json({ error, code }, { status });
}

export function unauthorizedResponse(
  message: string = DEFAULT_UNAUTHORIZED
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, 'UNAUTHORIZED', HTTP_STATUS_UNAUTHORIZED);
}

export function forbiddenResponse(
  message: string = DEFAULT_FORBIDDEN
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, 'FORBIDDEN', HTTP_STATUS_FORBIDDEN);
}

export function validationErrorResponse(
  message: string
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    message,
    'VALIDATION_ERROR',
    HTTP_STATUS_BAD_REQUEST
  );
}

export function notFoundResponse(
  message: string = DEFAULT_NOT_FOUND
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, 'NOT_FOUND', HTTP_STATUS_NOT_FOUND);
}

/**
 * Reponse 429 avec header `Retry-After` (en secondes, arrondi superieur)
 * et message FR contenant le delai humain (ex: "30 secondes").
 *
 * Le message exact est fourni par l'appelant car son formatage depend
 * du contexte (format different selon le rate-limit type).
 */
export function rateLimitErrorResponse(
  message: string,
  retryAfterMs: number
): NextResponse<ApiErrorResponse> {
  const response = createErrorResponse(
    message,
    'RATE_LIMIT_EXCEEDED',
    HTTP_STATUS_TOO_MANY_REQUESTS
  );
  response.headers.set(
    'Retry-After',
    String(Math.ceil(retryAfterMs / MILLISECONDS_PER_SECOND))
  );
  return response;
}

export function internalErrorResponse(): NextResponse<ApiErrorResponse> {
  return createErrorResponse(
    GENERIC_INTERNAL_ERROR,
    'INTERNAL_ERROR',
    HTTP_STATUS_INTERNAL_ERROR
  );
}
