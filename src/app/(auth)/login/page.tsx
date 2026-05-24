import type { Metadata } from 'next';
import { LoginForm } from '@/components/features/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Connexion - HACCP Maison Givre',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">HACCP Maison Givre</h1>
          <p className="text-sm text-slate-500 mt-2">
            Releves de temperature - boutiques
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
