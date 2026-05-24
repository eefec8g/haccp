import Link from 'next/link';
import type { Route } from 'next';
import { AuthLeftPanel } from '@/components/features/auth/AuthLeftPanel';

const HOME_HREF = '/' as Route;

/**
 * Layout des pages auth (Server Component).
 *
 * Split layout style Modernize :
 *   - Gauche (lg+) : AuthLeftPanel (slogan + illustration metier).
 *   - Droite : zone formulaire centree, max-w-lg, bg blanc.
 *
 * Le `data-testid="auth-layout"` est conserve pour donner aux specs E2E
 * un point d'accroche stable sur la zone de formulaire.
 */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AuthLeftPanel />

      <div className="flex w-full flex-col items-center justify-center overflow-y-auto bg-white px-6 py-10 lg:w-5/12 lg:px-10">
        <div className="w-full max-w-lg" data-testid="auth-layout">
          <div className="mb-8">
            <Link
              href={HOME_HREF}
              className="text-2xl font-bold text-[#2A3547]"
              aria-label="Maison Givre - Accueil"
            >
              Maison Givre
            </Link>
            <p className="mt-1 text-xs uppercase tracking-wider text-[#5D87FF]">
              HACCP - Releves de temperature
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
