import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { BrandDivider } from '@/features/landing/BrandDivider';

export const metadata: Metadata = {
  title: 'Connexion - HACCP Maison Givre',
};

function LoginFormFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="h-64 animate-pulse bg-mg-noir/5"
      data-testid="login-form-loading"
    />
  );
}

export default function LoginPage() {
  return (
    <section>
      <header className="mb-10">
        <h2 className="text-3xl font-light tracking-[0.2em] text-mg-noir uppercase">
          Connexion
        </h2>
        <div className="mt-5">
          <BrandDivider width="small" />
        </div>
        <p className="mt-5 text-xs font-light tracking-wide text-mg-noir/70">
          Connectez-vous pour saisir les releves de temperature du jour.
        </p>
      </header>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
