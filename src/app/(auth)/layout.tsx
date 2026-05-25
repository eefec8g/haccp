import Link from 'next/link';
import type { Route } from 'next';
import { AuthLeftPanel } from '@/components/features/auth/AuthLeftPanel';
import { BRAND_NAME } from '@/lib/constants/brand';

const HOME_HREF = '/' as Route;

/**
 * Layout des pages auth (Server Component).
 *
 * Split layout Maison Givre :
 *   - Gauche (lg+) : AuthLeftPanel (wordmark + signature glacier).
 *   - Droite : zone formulaire sur fond ivoire, max-w-md, padding genereux.
 *
 * Le wordmark de tete pointe vers la vitrine publique. Le `data-testid="auth-layout"`
 * est conserve pour donner aux specs E2E un point d'accroche stable.
 */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-mg-ivoire">
      <AuthLeftPanel />

      <div className="flex w-full flex-col items-center justify-center overflow-y-auto bg-mg-ivoire px-6 py-16 lg:w-5/12 lg:px-12">
        <div className="w-full max-w-md" data-testid="auth-layout">
          <div className="mb-12 space-y-6">
            <Link
              href={HOME_HREF}
              className="group inline-flex items-center gap-2 text-[10px] font-light tracking-[0.25em] text-mg-noir/60 uppercase transition-colors hover:text-mg-or"
              data-testid="auth-back-home"
            >
              <span
                aria-hidden="true"
                className="inline-block transition-transform group-hover:-translate-x-1"
              >
                {String.fromCharCode(8592)}
              </span>
              Retour a l&apos;accueil
            </Link>

            <Link
              href={HOME_HREF}
              className="block text-lg font-light tracking-[0.35em] text-mg-noir uppercase transition-colors hover:text-mg-or"
              aria-label="Maison Givre - Accueil"
            >
              {BRAND_NAME}
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
