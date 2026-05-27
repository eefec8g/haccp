import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { AppShell } from '@/components/features/app/AppShell';

/**
 * Layout racine du route group `(app)` (Server Component).
 *
 * Responsabilites :
 *   - Auth check defense en profondeur : redirect /login si pas de
 *     session, en complement du middleware qui filtre deja en amont.
 *     Aucune information protegee ne traverse vers les enfants sans
 *     verification serveur prealable.
 *   - Empeche l'indexation des routes authentifiees (robots noindex).
 *   - Monte le `AppShell` qui ajoute un FAB mobile-only pour la
 *     navigation transversale (Epic RESPONSIVE, CRITICAL 2).
 *
 * Pourquoi pas de header global ici ?
 *
 * Les pages enfants disposent deja chacune de leur propre chrome de
 * navigation, calque sur leur contexte metier :
 *   - `/releves`           -> `TourneeHeader` (date + utilisateur + role + logout).
 *   - `/alertes`, etc.     -> `AppPageHeader` (eyebrow + titre + back link).
 *   - `/admin/*`           -> `AdminLayout` (sidebar + AdminHeader complet).
 *   - `/dashboard`,        -> `AppPageHeader` (idem).
 *   - `/exports/*`         -> `AppPageHeader` (idem).
 *
 * Inserer un header global creerait un doublon visuel (deux barres
 * sticky superposees, deux LogoutButton). `AppShell` ajoute donc
 * uniquement un overlay (FAB + drawer) qui n'interfere pas avec ces
 * chromes existants. Cela resout le finding CRITICAL initial :
 * "Un RESPONSABLE n'a aucun raccourci vers /alertes, /dashboard,
 * /exports/registre-consolide depuis son mobile".
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface AppRouteLayoutProps {
  readonly children: ReactNode;
}

export default async function AppRouteLayout({
  children,
}: AppRouteLayoutProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  // `pb-24 md:pb-0` reserve un espace de 96px en bas du viewport mobile
  // afin que le FAB de navigation (`AppMobileNavButton`,
  // `fixed bottom-6 right-6 h-14`) ne masque jamais les CTA bas de page
  // (Enregistrer le releve, Signer le registre, etc.). Sur desktop la
  // FAB est cachee (`md:hidden`) donc la compensation disparait.
  return (
    <div className="pb-24 md:pb-0">
      <AppShell viewerRole={session.user.role}>{children}</AppShell>
    </div>
  );
}
