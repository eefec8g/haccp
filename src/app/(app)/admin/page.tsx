import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/features/admin/AdminPageHeader';

export const metadata: Metadata = {
  title: 'Administration - HACCP Maison Givre',
};

/**
 * Dashboard admin (placeholder pour US-ADM-005).
 *
 * Les widgets statistiques (nombre de boutiques actives, equipements,
 * users, alertes en cours...) seront ajoutes par les US individuelles.
 * On garde une page neutre qui valide juste le layout + l'auth.
 */
export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        title="Bienvenue dans l'administration"
        subtitle="Pilotez les boutiques, equipements et utilisateurs de Maison Givre."
      />
      <section
        className="rounded-[7px] border border-[#DFE5EF] bg-white p-8 text-center text-sm text-[#5A6A85]"
        data-testid="admin-dashboard-placeholder"
      >
        <p className="font-medium text-[#2A3547]">
          Tableau de bord en construction
        </p>
        <p className="mt-2">
          Les indicateurs (parc, conformite, alertes) seront ajoutes dans une
          prochaine iteration.
        </p>
      </section>
    </>
  );
}
