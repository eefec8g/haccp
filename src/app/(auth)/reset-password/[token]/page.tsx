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
    <main
      className="min-h-screen flex items-center justify-center p-6"
      data-testid="reset-malformed"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Lien invalide ou expire</h1>
        <p className="text-sm text-slate-500">
          Le lien de reinitialisation est invalide ou a expire. Demandez un
          nouveau lien pour continuer.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={FORGOT_PASSWORD_HREF}
            className="text-sm text-blue-600 hover:underline"
            data-testid="reset-request-new-link"
          >
            Demander un nouveau lien
          </Link>
          <Link
            href={LOGIN_HREF}
            className="text-sm text-slate-500 hover:underline"
            data-testid="reset-back-to-login"
          >
            Retour a la connexion
          </Link>
        </div>
      </div>
    </main>
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
          <p className="text-sm text-slate-500 mt-2">
            Choisissez un mot de passe robuste pour proteger votre compte.
          </p>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
