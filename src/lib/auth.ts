import NextAuth from 'next-auth';
import { cache } from 'react';
import Credentials from 'next-auth/providers/credentials';
import { authenticateUser } from '@/lib/services/auth.service';
import { loginSchema } from '@/lib/validations/auth';
import { JWT_MAX_AGE_SECONDS } from '@/lib/constants/auth';

// Les declarations module 'next-auth' / '@auth/core/jwt' sont
// centralisees dans src/types/next-auth.d.ts.

const nextAuthInstance = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: JWT_MAX_AGE_SECONDS,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const result = await authenticateUser(
          parsed.data.email,
          parsed.data.password
        );
        if (!result.success) {
          return null;
        }

        const { user } = result.data;
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          boutiqueIds: user.boutiqueIds,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.boutiqueIds = user.boutiqueIds ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.boutiqueIds = token.boutiqueIds;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuthInstance;

/**
 * `auth` est exporte tel quel (toutes ses signatures), mais l'overload
 * "no-args" (utilise par les Server Components et Server Actions) est
 * memoise via `react.cache`.
 *
 * Pourquoi ? Sur une page admin, `auth()` est invoque 4 fois par requete
 * (layout `(app)`, layout admin, AdminHeader, page elle-meme). Chaque
 * appel deserialise le JWT depuis le cookie -> CPU + alloc pour rien.
 * `cache()` partage le resultat pendant la duree d'une requete (scope
 * React Server Components), sans toucher au cache entre requetes.
 *
 * Les autres overloads (middleware `auth((req) => ...)`, route handlers
 * `auth(req, res)`) passent par les signatures avec arguments et ne sont
 * PAS memoisees : leur cle d'identite varie a chaque requete, ce qui
 * rendrait le cache inutile et fragile.
 *
 * Implementation : on memoise uniquement le helper `()` et on
 * fallback sur l'instance NextAuth pour les autres formes (proxy via
 * `Object.assign`). Les types restent ceux que NextAuth expose.
 */
const cachedAuthRSC = cache(() => nextAuthInstance.auth());

type NextAuthAuth = typeof nextAuthInstance.auth;
type AnyArgs = readonly unknown[];

/**
 * Le cast est requis car la signature surchargee de NextAuth ne se
 * resout pas via spread `args` (TS choisit la derniere overload, dont la
 * tuple d'args est plus restrictive). On wrappe en `unknown[]` pour
 * router toutes les formes vers l'instance native, et on caste le tout
 * en `NextAuthAuth` pour reexposer les overloads aux consommateurs.
 *
 * Les autres overloads (middleware, pages router, route handlers) passent
 * par leur propre flux et ne beneficient PAS de la memoisation : c'est
 * volontaire (cf. JSDoc plus haut).
 */
const authImpl = (...args: AnyArgs): unknown => {
  if (args.length === 0) {
    return cachedAuthRSC();
  }
  return (nextAuthInstance.auth as (...rest: AnyArgs) => unknown)(...args);
};

export const auth: NextAuthAuth = authImpl as unknown as NextAuthAuth;
