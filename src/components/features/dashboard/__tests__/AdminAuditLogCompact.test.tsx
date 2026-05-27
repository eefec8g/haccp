import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuditLogCompactItem } from '@/types/audit';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
  }) => (
    <a href={href} className={className} data-testid={dataTestid}>
      {children}
    </a>
  ),
}));

import { AdminAuditLogCompact } from '../AdminAuditLogCompact';

/**
 * Tests AdminAuditLogCompact (US-DAS-002).
 *
 * Couvre :
 *  - empty state quand entries est vide,
 *  - rendu de N entries (acteur, action, entite),
 *  - presence du lien "Voir tout" vers /admin/audit-log,
 *  - formattage compact de la date en fr-FR/Europe-Paris incluant
 *    l'annee (Security L6).
 */

function buildEntry(
  overrides: Partial<AuditLogCompactItem> = {}
): AuditLogCompactItem {
  return {
    id: 'audit-1',
    action: 'CREATE',
    entityType: 'BOUTIQUE',
    entityId: 'b-1',
    entityLabel: 'MG Paris 11',
    performedById: 'u-1',
    performedByName: 'Alice Admin',
    createdAt: new Date('2026-05-26T08:30:00.000Z'),
    ...overrides,
  };
}

describe('[Dashboard] AdminAuditLogCompact', () => {
  it('should render an empty state when entries is empty', () => {
    const html = renderToStaticMarkup(<AdminAuditLogCompact entries={[]} />);
    expect(html).toContain('data-testid="admin-audit-log-compact-empty"');
    expect(html).toContain('Aucune activite recente');
  });

  it('should render every entry with actor, action and entity', () => {
    const entries: readonly AuditLogCompactItem[] = [
      buildEntry({ id: 'a1', performedByName: 'Alice', action: 'CREATE' }),
      buildEntry({
        id: 'a2',
        performedByName: 'Bob',
        action: 'UPDATE',
        entityType: 'EQUIPEMENT',
        entityLabel: 'Congel 1',
      }),
      buildEntry({
        id: 'a3',
        performedByName: 'Carol',
        action: 'DISABLE',
        entityType: 'USER',
        entityLabel: null,
      }),
    ];
    const html = renderToStaticMarkup(
      <AdminAuditLogCompact entries={entries} />
    );
    expect(html).toContain('data-testid="admin-audit-log-compact-entry-a1"');
    expect(html).toContain('data-testid="admin-audit-log-compact-entry-a2"');
    expect(html).toContain('data-testid="admin-audit-log-compact-entry-a3"');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('Carol');
    expect(html).toContain('create');
    expect(html).toContain('update');
    expect(html).toContain('disable');
    expect(html).toContain('Congel 1');
  });

  it('should render a "Voir tout" link pointing to /admin/audit-log', () => {
    const html = renderToStaticMarkup(
      <AdminAuditLogCompact entries={[buildEntry()]} />
    );
    expect(html).toContain('data-testid="admin-audit-log-compact-view-all"');
    expect(html).toContain('href="/admin/audit-log"');
    expect(html).toMatch(/Voir tout/);
  });

  it('should format the createdAt date in compact fr-FR Europe/Paris with the year', () => {
    const html = renderToStaticMarkup(
      <AdminAuditLogCompact
        entries={[
          buildEntry({ createdAt: new Date('2026-05-26T08:30:00.000Z') }),
        ]}
      />
    );
    // 08:30 UTC = 10:30 Europe/Paris en mai (CEST UTC+2).
    expect(html).toContain('10:30');
    expect(html).toContain('26/05/2026');
    expect(html).toMatch(/dateTime="2026-05-26T08:30:00\.000Z"/i);
  });

  it('should NOT leak any email field in the rendered HTML', () => {
    // Regression: AdminAuditLogCompact ne doit pas serialiser PII email
    // (cf. AuditLogCompactItem qui exclut performedByEmail).
    const html = renderToStaticMarkup(
      <AdminAuditLogCompact entries={[buildEntry()]} />
    );
    expect(html).not.toContain('@');
  });
});
