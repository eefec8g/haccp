import type { ReactNode } from 'react';
import { AdminLayout } from '@/components/features/admin/AdminLayout';

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
