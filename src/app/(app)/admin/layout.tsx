import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminLayout } from '@/components/features/admin/AdminLayout';

/**
 * Empeche l'indexation des routes /admin par les moteurs de recherche :
 * elles sont protegees par auth() et ne presentent aucun contenu public.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout des routes `/admin/*`.
 *
 * Delegue tout (auth, role check, chrome) au composant
 * `AdminLayout` pour eviter de coupler la conformite Next.js (forme
 * d'un layout RSC) avec la logique de presentation.
 */
export default function AdminRouteLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
