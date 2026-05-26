/**
 * Sentinel string utilise par `redirect()` de Next.js pour propager
 * la navigation server-side via une exception. On ne doit JAMAIS
 * intercepter cette erreur, sinon la redirection ne se produit pas.
 */
const NEXT_REDIRECT_DIGEST = 'NEXT_REDIRECT';

/**
 * Detecte si une erreur est en realite un `redirect()` Next.js
 * (mecanisme interne base sur un `digest` commencant par
 * `NEXT_REDIRECT`). A re-throw systematiquement.
 */
export function isNextRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith(NEXT_REDIRECT_DIGEST)
  );
}
