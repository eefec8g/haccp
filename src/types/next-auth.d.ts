// Extension des types NextAuth pour injecter role + boutiqueIds.
// Centralise la declaration au lieu de la dupliquer dans src/lib/auth.ts.
import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      boutiqueIds: readonly string[];
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    boutiqueIds?: readonly string[];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    boutiqueIds: readonly string[];
  }
}
