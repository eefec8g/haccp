import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    'data-testid': dataTestid,
    'aria-label': ariaLabel,
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly 'data-testid'?: string;
    readonly 'aria-label'?: string;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestid}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

import { TourneeButtons } from '../TourneeButtons';

describe('[Dashboard] TourneeButtons', () => {
  it('should render 3 buttons (matin/midi/soir) with hrefs to the tournee pages', () => {
    const html = renderToStaticMarkup(<TourneeButtons />);

    expect(html).toContain('data-testid="tournee-buttons"');
    expect(html).toContain('data-testid="tournee-button-matin"');
    expect(html).toContain('data-testid="tournee-button-midi"');
    expect(html).toContain('data-testid="tournee-button-soir"');
    expect(html).toContain('href="/releves/tournee/MATIN"');
    expect(html).toContain('href="/releves/tournee/MIDI"');
    expect(html).toContain('href="/releves/tournee/SOIR"');
  });

  it('should add the boutiqueId query param to the hrefs when provided', () => {
    const html = renderToStaticMarkup(<TourneeButtons boutiqueId="b-42" />);

    expect(html).toContain('href="/releves/tournee/MATIN?boutiqueId=b-42"');
    expect(html).toContain('href="/releves/tournee/MIDI?boutiqueId=b-42"');
    expect(html).toContain('href="/releves/tournee/SOIR?boutiqueId=b-42"');
  });

  it('should expose readable aria-labels per creneau', () => {
    const html = renderToStaticMarkup(<TourneeButtons />);

    expect(html).toContain('aria-label="Demarrer la tournee Matin"');
    expect(html).toContain('aria-label="Demarrer la tournee Midi"');
    expect(html).toContain('aria-label="Demarrer la tournee Soir"');
  });

  it('should use a custom testId when provided', () => {
    const html = renderToStaticMarkup(
      <TourneeButtons testId="dashboard-tournee-buttons" />
    );
    expect(html).toContain('data-testid="dashboard-tournee-buttons"');
  });
});
