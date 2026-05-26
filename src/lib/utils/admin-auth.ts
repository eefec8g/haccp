import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Garde-fou centralise pour les Server Actions admin reservees aux
 * Promise<void> (boutons toggle desactivation/reactivation).
 *
 * Comportement :
 *   - Si la session est manquante ou si le role n'est pas ADMIN ->
 *     `redirect('/login')`. `redirect()` Next.js leve une exception
 *     `NEXT_REDIRECT` que la fonction appelante DOIT laisser remonter
 *     telle quelle (la navigation client en depend).
 *   - Sinon -> retourne `{ userId }` que le caller utilise comme
 *     `performedById` pour les ecritures audit log.
 *
 * Factorise un pattern duplique 6x dans les fichiers `admin-*.ts`
 * (DRY, Clean Code #4). Cf. `assertAdminOrRedirect.test.ts`.
 */
export async function assertAdminOrRedirect(): Promise<{
  readonly userId: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }
  return { userId: session.user.id };
}
