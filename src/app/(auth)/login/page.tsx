import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/features/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Connexion - HACCP Maison Givre',
};

function LoginFormFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="h-64 animate-pulse rounded-md bg-slate-100"
      data-testid="login-form-loading"
    />
  );
}

export default function LoginPage() {
  return (
    <section>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-[#2A3547]">Bon retour</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connectez-vous pour saisir les releves de temperature du jour.
        </p>
      </header>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
