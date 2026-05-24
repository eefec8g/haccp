import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';

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

function MalformedTokenScreen() {
  return (
    <section data-testid="reset-malformed">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-[#2A3547]">
          Lien invalide ou expire
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Le lien de reinitialisation est invalide ou a expire. Demandez un
          nouveau lien pour continuer.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href={FORGOT_PASSWORD_HREF}
          className="inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2"
          data-testid="reset-request-new-link"
        >
          Demander un nouveau lien
        </Link>
        <Link
          href={LOGIN_HREF}
          className="inline-flex items-center justify-center rounded-[7px] border border-[#DFE5EF] bg-white px-4 py-3 text-sm font-semibold text-[#2A3547] transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2"
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
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-[#2A3547]">
          Nouveau mot de passe
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choisissez un mot de passe robuste pour proteger votre compte.
        </p>
      </header>

      <ResetPasswordForm token={token} />
    </section>
  );
}
