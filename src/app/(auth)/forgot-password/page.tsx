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
    <section>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-[#2A3547]">
          Mot de passe oublie
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Saisissez votre email professionnel pour recevoir un lien de
          reinitialisation.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link
          href={LOGIN_HREF}
          className="font-medium text-[#5D87FF] hover:text-[#4570e6]"
          data-testid="forgot-back-to-login"
        >
          Retour a la connexion
        </Link>
      </p>
    </section>
  );
}
