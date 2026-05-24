import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Mot de passe oublie - HACCP Maison Givre',
};

const LOGIN_HREF = '/login' as Route;

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Mot de passe oublie</h1>
          <p className="text-sm text-slate-500 mt-2">
            Saisissez votre email pour recevoir un lien de reinitialisation.
          </p>
        </div>
        <ForgotPasswordForm />
        <div className="text-center">
          <Link
            href={LOGIN_HREF}
            className="text-sm text-blue-600 hover:underline"
            data-testid="forgot-back-to-login"
          >
            Retour a la connexion
          </Link>
        </div>
      </div>
    </main>
  );
}
