import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

/**
 * Recharts utilise ResizeObserver et un layout dynamique pour calculer
 * la taille des charts. En SSR + jsdom, ces APIs ne sont pas
 * disponibles. On mock les composants recharts vers des wrappers
 * inertes : on garde l'API React mais on ne dessine rien.
 *
 * Cela permet de tester :
 *   - wrapper data-testid, role="img", aria-label,
 *   - propagation du titre, des donnees au format converti.
 * Le rendu visuel (SVG) sera valide en E2E Playwright en Phase 2.
 */

vi.mock('recharts', () => {
  const passthrough = ({ children }: { readonly children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: passthrough,
    LineChart: passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

import { TrendChart } from '../TrendChart';

describe('[Dashboard] TrendChart', () => {
  it('should render the wrapper with role=img and a computed aria-label', () => {
    const data = [
      { dateISO: '2026-05-20', value: 0 },
      { dateISO: '2026-05-21', value: 2 },
      { dateISO: '2026-05-22', value: 1 },
    ] as const;
    const html = renderToStaticMarkup(
      <TrendChart data={data} title="Alertes 7j" />
    );
    expect(html).toContain('data-testid="trend-chart"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Alertes 7j : 3 sur 3 jours."');
  });

  it('should render the provided title', () => {
    const html = renderToStaticMarkup(
      <TrendChart data={[]} title="Conformite jour" />
    );
    expect(html).toContain('Conformite jour');
  });

  it('should support a custom testId', () => {
    const html = renderToStaticMarkup(
      <TrendChart data={[]} title="Alertes" testId="trend-alertes" />
    );
    expect(html).toContain('data-testid="trend-alertes"');
  });

  it('should accept an empty dataset without crashing (0/0 days)', () => {
    const html = renderToStaticMarkup(<TrendChart data={[]} title="Vide" />);
    expect(html).toContain('Vide : 0 sur 0 jours.');
  });
});
