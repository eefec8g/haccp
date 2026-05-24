import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Releves du jour - HACCP Maison Givre',
};

export default async function RelevesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Releves du jour</h1>
          <p className="text-sm text-slate-500">
            Connecte : {session.user.name} ({session.user.role})
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button
            type="submit"
            className="text-sm px-3 py-2 rounded-md border border-slate-300"
            data-testid="logout-button"
          >
            Deconnexion
          </button>
        </form>
      </header>
      <section className="rounded-lg border border-slate-200 p-6 text-center text-slate-500">
        <p className="font-medium">
          Tournee du jour - a venir (US-REL-001 / US-REL-002)
        </p>
        <p className="text-sm mt-2">
          Cette page sera implementee dans le sprint v1.0. Elle affichera la
          grille equipements x creneaux (matin/midi/soir).
        </p>
      </section>
    </main>
  );
}
