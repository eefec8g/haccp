import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AppPageHeader } from '@/components/features/ui/AppPageHeader';
import { ChangePasswordForm } from '@/components/features/auth/ChangePasswordForm';

export const metadata: Metadata = {
  title: 'Mon mot de passe - HACCP Maison Givre',
  robots: { index: false, follow: false },
};

const BACK_HREF: Route = '/dashboard';
const SECTION_CLASSES = 'px-6 py-10 sm:px-10';
const FORM_WRAPPER_CLASSES = 'max-w-xl';
const PAGE_TITLE = 'Mon mot de passe';
const PAGE_SUBTITLE =
  'Saisissez votre mot de passe actuel puis choisissez-en un nouveau.';

/**
 * Page de changement de mot de passe de l'utilisateur connecte.
 *
 * Server Component async :
 *   - Garde auth : redirect /login si pas de session (defense en
 *     profondeur, le middleware filtre deja en amont).
 *   - Accessible aux trois roles (SALARIE/RESPONSABLE/ADMIN) : chacun ne
 *     peut changer QUE son propre mot de passe (scope cote action via la
 *     session, jamais via le formulaire).
 *   - Metadata noindex : page personnelle, jamais indexee.
 */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div data-testid="change-password-page">
      <AppPageHeader
        title={PAGE_TITLE}
        eyebrow="Maison Givre - Compte"
        subtitle={PAGE_SUBTITLE}
        backHref={BACK_HREF}
        testId="change-password-header"
      />
      <section className={SECTION_CLASSES}>
        <div className={FORM_WRAPPER_CLASSES}>
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
