import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';
import { BrandDivider } from '@/features/landing/BrandDivider';

export const metadata: Metadata = {
  title: 'Mot de passe oublie - HACCP Maison Givre',
};

const LOGIN_HREF = '/login' as Route;

export default function ForgotPasswordPage() {
  return (
    <section>
      <header className="mb-10">
        <h2 className="text-3xl font-light tracking-[0.2em] text-mg-noir uppercase">
          Mot de passe oublie
        </h2>
        <div className="mt-5">
          <BrandDivider width="small" />
        </div>
        <p className="mt-5 text-xs font-light tracking-wide text-mg-noir/70">
          Saisissez votre email professionnel pour recevoir un lien de
          reinitialisation.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="mt-10 text-center">
        <Link
          href={LOGIN_HREF}
          className="text-[11px] font-light uppercase tracking-[0.2em] text-mg-noir/70 transition-colors hover:text-mg-or"
          data-testid="forgot-back-to-login"
        >
          Retour a la connexion
        </Link>
      </p>
    </section>
  );
}
