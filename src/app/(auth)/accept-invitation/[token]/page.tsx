import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { AcceptInvitationForm } from '@/components/features/auth/AcceptInvitationForm';
import { validateInvitationToken } from '@/lib/services/user.service';

export const metadata: Metadata = {
  title: 'Activer mon compte - HACCP Maison Givre',
};

const LOGIN_HREF = '/login' as Route;
const MIN_TOKEN_LENGTH = 32;

interface AcceptInvitationPageProps {
  readonly params: Promise<{ readonly token: string }>;
}

const ERROR_BUTTON_PRIMARY =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

/**
 * Ecran d'erreur generique (token manquant / invalide / expire / utilise).
 *
 * On affiche le MEME message pour les trois cas afin de ne pas leaker
 * d'information sur la cause exacte (anti-enum) ; cote serveur le
 * service `validateInvitationToken` distingue INVALID/EXPIRED/USED pour
 * la trace ops mais l'UI les regroupe.
 */
function InvitationErrorScreen() {
  return (
    <section data-testid="accept-invitation-error">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-[#2A3547]">
          Lien invalide ou expire
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Le lien d'invitation est invalide ou a expire. Demandez une nouvelle
          invitation a votre administrateur.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href={LOGIN_HREF}
          className={ERROR_BUTTON_PRIMARY}
          data-testid="accept-invitation-back-to-login"
        >
          Retour a la connexion
        </Link>
      </div>
    </section>
  );
}

/**
 * Page d'acceptation d'invitation (Server Component, US-ADM-003).
 *
 * Public (l'utilisateur invite n'est pas encore authentifie).
 * Route placee sous `(auth)/` pour beneficier du layout d'authentification
 * (split panel Modernize) et eviter la garde middleware `/admin`.
 *
 * Pipeline :
 *   1. Validation rapide du format token (length >= 32). Sinon ecran
 *      generique sans hit DB.
 *   2. `validateInvitationToken` (verif hash + expiresAt + usedAt). Toute
 *      erreur -> meme ecran generique.
 *   3. Render `AcceptInvitationForm` avec email + role pour informer
 *      l'utilisateur de la cible de son invitation.
 */
export default async function AcceptInvitationPage({
  params,
}: AcceptInvitationPageProps) {
  const { token } = await params;

  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return <InvitationErrorScreen />;
  }

  const validation = await validateInvitationToken(token);
  if (!validation.success) {
    return <InvitationErrorScreen />;
  }

  return (
    <section data-testid="accept-invitation-page">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-[#2A3547]">
          Activer mon compte
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Choisissez un mot de passe robuste pour finaliser la creation de votre
          compte.
        </p>
      </header>

      <AcceptInvitationForm
        token={token}
        email={validation.data.email}
        role={validation.data.role}
      />
    </section>
  );
}
