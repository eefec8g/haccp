import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';
import { BrandDivider } from '@/features/landing/BrandDivider';

export const metadata: Metadata = {
  title: 'Reinitialiser le mot de passe - HACCP Maison Givre',
};

const FORGOT_PASSWORD_HREF = '/forgot-password' as Route;
const LOGIN_HREF = '/login' as Route;

/**
 * Longueur min pour qu'un token soit envisageable. Aligne avec le
 * `min(32)` de `resetPasswordSchema` cote validation. Toute valeur
 * en deca est rejetee sans meme tenter de hit la DB.
 */
const MIN_TOKEN_LENGTH = 32;

interface ResetPasswordPageProps {
  readonly params: Promise<{ readonly token: string }>;
}

const PRIMARY_BUTTON_CLASSES =
  'inline-flex items-center justify-center bg-mg-noir px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-ivoire uppercase transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';
const SECONDARY_BUTTON_CLASSES =
  'inline-flex items-center justify-center border border-mg-or/40 bg-transparent px-6 py-3 text-[11px] font-medium tracking-[0.3em] text-mg-noir uppercase transition-colors hover:border-mg-or hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

function MalformedTokenScreen() {
  return (
    <section data-testid="reset-malformed">
      <header className="mb-10 text-center">
        <h2 className="text-3xl font-light tracking-[0.2em] text-mg-noir uppercase">
          Lien invalide
        </h2>
        <div className="mt-5 flex justify-center">
          <BrandDivider width="small" />
        </div>
        <p className="mt-5 text-xs font-light tracking-wide text-mg-noir/70">
          Le lien de reinitialisation est invalide ou a expire. Demandez un
          nouveau lien pour continuer.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href={FORGOT_PASSWORD_HREF}
          className={PRIMARY_BUTTON_CLASSES}
          data-testid="reset-request-new-link"
        >
          Demander un nouveau lien
        </Link>
        <Link
          href={LOGIN_HREF}
          className={SECONDARY_BUTTON_CLASSES}
          data-testid="reset-back-to-login"
        >
          Retour a la connexion
        </Link>
      </div>
    </section>
  );
}

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const { token } = await params;

  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return <MalformedTokenScreen />;
  }

  return (
    <section>
      <header className="mb-10">
        <h2 className="text-3xl font-light tracking-[0.2em] text-mg-noir uppercase">
          Nouveau mot de passe
        </h2>
        <div className="mt-5">
          <BrandDivider width="small" />
        </div>
        <p className="mt-5 text-xs font-light tracking-wide text-mg-noir/70">
          Choisissez un mot de passe robuste pour proteger votre compte.
        </p>
      </header>

      <ResetPasswordForm token={token} />
    </section>
  );
}
