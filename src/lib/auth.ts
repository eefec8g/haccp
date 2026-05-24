import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateUser } from '@/lib/services/auth.service';
import { loginSchema } from '@/lib/validations/auth';
import { JWT_MAX_AGE_SECONDS } from '@/lib/constants/auth';

// Les declarations module 'next-auth' / '@auth/core/jwt' sont
// centralisees dans src/types/next-auth.d.ts.

export const { handlers, signIn, signOut, auth } = NextAuth({
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
