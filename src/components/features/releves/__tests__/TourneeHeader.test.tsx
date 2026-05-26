import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Le LogoutButton importe un Server Action ('use server'). Pour le SSR
// pur de test on n'a besoin que de son markup -> on mock vers un
// placeholder identifiable. Cf. logout.test.ts pour l'action elle-meme.
vi.mock('@/components/features/auth/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" data-testid="logout-button">
      Se deconnecter
    </button>
  ),
}));

// Apres le mock, on importe le composant cible (ordre obligatoire avec vi.mock).
import { TourneeHeader } from '../TourneeHeader';

/**
 * Tests TourneeHeader (US-REL-001) :
 *   - titre "Ma tournee du jour" present
 *   - date courte affichee `JJ/MM/AAAA`
 *   - identite user (name) visible
 *   - role traduit ("Salarie", "Responsable", "Administrateur")
 *   - LogoutButton present (mocke)
 */

describe('[Releves] TourneeHeader', () => {
  it('should render page title "Ma tournee du jour"', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Alice Dupont"
        userRole="SALARIE"
      />
    );
    expect(html).toContain('Ma tournee du jour');
  });

  it('should render date in JJ/MM/AAAA format', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Alice Dupont"
        userRole="SALARIE"
      />
    );
    expect(html).toContain('data-testid="tournee-header-date"');
    expect(html).toContain('26/05/2026');
  });

  it('should render the user name', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Alice Dupont"
        userRole="SALARIE"
      />
    );
    expect(html).toContain('data-testid="tournee-header-user"');
    expect(html).toContain('Alice Dupont');
  });

  it('should render translated role label for SALARIE', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Alice Dupont"
        userRole="SALARIE"
      />
    );
    expect(html).toContain('data-testid="tournee-header-role"');
    expect(html).toContain('Salarie');
  });

  it('should render translated role label for RESPONSABLE', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Bob Martin"
        userRole="RESPONSABLE"
      />
    );
    expect(html).toContain('Responsable');
  });

  it('should render translated role label for ADMIN', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Carla Admin"
        userRole="ADMIN"
      />
    );
    expect(html).toContain('Administrateur');
  });

  it('should include the LogoutButton', () => {
    const html = renderToStaticMarkup(
      <TourneeHeader
        dateISO="2026-05-26"
        userName="Alice Dupont"
        userRole="SALARIE"
      />
    );
    expect(html).toContain('data-testid="logout-button"');
  });
});
