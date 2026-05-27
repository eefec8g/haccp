import { cache } from 'react';
import { db } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

export interface SessionUser {
  id: string;
  role: UserRole;
}

/**
 * Retourne la liste des IDs de boutiques accessibles a un utilisateur :
 * - SALARIE : sa boutique unique (boutiqueSalarieId)
 * - RESPONSABLE : ses boutiques (via BoutiqueUser)
 * - ADMIN : toutes les boutiques actives
 *
 * Wrappe via `React.cache` pour memoiser la requete sur la duree d'un
 * render Server Component (Next.js 15 App Router). Plusieurs appels avec
 * la meme `user` resolvent en une seule requete DB.
 */
export const getAccessibleBoutiqueIds = cache(
  async (user: SessionUser): Promise<string[]> => {
    if (user.role === 'ADMIN') {
      const boutiques = await db.boutique.findMany({
        where: { actif: true },
        select: { id: true },
      });
      return boutiques.map((b) => b.id);
    }

    if (user.role === 'RESPONSABLE') {
      const rows = await db.boutiqueUser.findMany({
        where: { userId: user.id },
        select: { boutiqueId: true },
      });
      return rows.map((r) => r.boutiqueId);
    }

    // SALARIE
    const userRow = await db.user.findUnique({
      where: { id: user.id },
      select: { boutiqueSalarieId: true },
    });
    return userRow?.boutiqueSalarieId ? [userRow.boutiqueSalarieId] : [];
  }
);

export function canManageAlertes(user: SessionUser): boolean {
  return user.role === 'RESPONSABLE' || user.role === 'ADMIN';
}

export function canExport(user: SessionUser): boolean {
  return user.role === 'RESPONSABLE' || user.role === 'ADMIN';
}

export function canManageParc(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}
