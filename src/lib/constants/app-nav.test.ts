import { describe, it, expect } from 'vitest';
import { UserRole } from '@prisma/client';
import { getAppNavGroupsForRole } from './app-nav';

/**
 * Tests `getAppNavGroupsForRole` (refactor/unified-sidebar).
 *
 * La navigation unifiee est organisee en groupes filtres par role :
 *   - SALARIE     : "Operations" seul (dashboard + alertes).
 *   - RESPONSABLE : "Operations" a 4 items, pas d'"Administration".
 *   - ADMIN       : "Operations" + "Administration".
 * Un groupe sans item visible doit etre entierement masque (pas de
 * titre orphelin).
 */
describe('[app-nav] getAppNavGroupsForRole', () => {
  it('should expose only the Operations group with 2 items for SALARIE', () => {
    const groups = getAppNavGroupsForRole(UserRole.SALARIE);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.slug).toBe('operations');
    const slugs = groups[0]?.items.map((item) => item.slug);
    expect(slugs).toEqual(['dashboard', 'alertes']);
  });

  it('should expose the Operations group with 4 items and no Administration for RESPONSABLE', () => {
    const groups = getAppNavGroupsForRole(UserRole.RESPONSABLE);

    expect(groups).toHaveLength(1);
    const operations = groups[0];
    expect(operations?.slug).toBe('operations');
    expect(operations?.items.map((item) => item.slug)).toEqual([
      'dashboard',
      'releves-listing',
      'alertes',
      'registre-consolide',
    ]);
    expect(groups.some((group) => group.slug === 'administration')).toBe(false);
  });

  it('should expose both Operations and Administration groups for ADMIN', () => {
    const groups = getAppNavGroupsForRole(UserRole.ADMIN);

    expect(groups.map((group) => group.slug)).toEqual([
      'operations',
      'administration',
    ]);
    const administration = groups.find(
      (group) => group.slug === 'administration'
    );
    expect(administration?.items.map((item) => item.slug)).toEqual([
      'admin-users',
      'admin-boutiques',
      'admin-equipements',
      'admin-audit',
    ]);
  });

  it('should never include the legacy "Espace admin" toggle item', () => {
    const adminGroups = getAppNavGroupsForRole(UserRole.ADMIN);
    const allSlugs = adminGroups.flatMap((group) =>
      group.items.map((item) => item.slug)
    );

    expect(allSlugs).not.toContain('admin');
  });

  it('should only return groups that have at least one visible item', () => {
    for (const role of [
      UserRole.SALARIE,
      UserRole.RESPONSABLE,
      UserRole.ADMIN,
    ]) {
      const groups = getAppNavGroupsForRole(role);
      for (const group of groups) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });
});
