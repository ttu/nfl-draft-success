import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useMatch } from 'react-router-dom';
import { DRAFT_YEAR_BOUNDS } from '../../lib/draftYearBounds';
import { formatYearRange } from '../../lib/laggedWindow';

export type MastheadTab =
  'rankings' | 'team' | 'year' | 'pos' | 'highlights' | 'roster' | 'rosters';

interface MastheadProps {
  active: MastheadTab;
  teamId?: string;
  dataLastUpdatedDate: string;
  /** Year range to use when current URL has no from/to (e.g. on /year/{y}). */
  fallbackRange?: { from: number; to: number };
  onShowInfo: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Masthead({
  active,
  teamId,
  dataLastUpdatedDate,
  fallbackRange,
  onShowInfo,
  dark,
  onToggleDark,
}: MastheadProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const yearMatch = useMatch('/year/:draftYear');
  const activeTabRef = useRef<HTMLButtonElement>(null);

  /**
   * Keep the current tab visible in a nav too wide for its space.
   *
   * The bar scrolls horizontally with its scrollbar hidden, so a tab past the
   * right edge is not merely off-screen — it is silently half-cut, which reads
   * as a broken label rather than as something to scroll to. The team Roster
   * tab is last and the likeliest to land there.
   */
  useEffect(() => {
    const tab = activeTabRef.current;
    const nav = tab?.parentElement;
    if (!tab) return;

    const reveal = () =>
      tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    reveal();

    // One pass is not enough: the web font swaps in and the synced-data block
    // resolves after first paint, and each re-measure can push the tab back
    // over the edge it was just scrolled inside. Re-reveal on every resize.
    if (typeof ResizeObserver === 'undefined' || !nav) return;
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [active]);

  // Effective range: URL search wins, else fallback, else nothing.
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const effectiveFrom =
    urlFrom ?? yearMatch?.params.draftYear ?? fallbackRange?.from?.toString();
  const effectiveTo =
    urlTo ?? yearMatch?.params.draftYear ?? fallbackRange?.to?.toString();
  const search =
    effectiveFrom && effectiveTo
      ? `?from=${effectiveFrom}&to=${effectiveTo}`
      : '';

  const goRankings = () => navigate({ pathname: '/', search });
  const goTeam = () =>
    navigate({ pathname: teamId != null ? `/${teamId}` : '/', search });
  const goRoster = () =>
    teamId != null && navigate({ pathname: `/roster/${teamId}`, search });
  const goYear = () => {
    const y = effectiveTo ?? '2026';
    navigate({ pathname: `/year/${y}`, search });
  };
  const goPos = () => navigate({ pathname: '/position/QB', search });
  const goHighlights = () => navigate({ pathname: '/highlights', search });
  const goRosters = () => navigate({ pathname: '/rosters', search });

  // Team and Roster are two views of one open team, so they appear together.
  // Roster needs the id to link to and is dropped without one.
  const inTeamContext =
    teamId != null || active === 'team' || active === 'roster';

  const tabs: Array<{ id: MastheadTab; label: string; onClick: () => void }> = [
    { id: 'rankings', label: 'Rankings', onClick: goRankings },
    ...(inTeamContext
      ? [{ id: 'team' as const, label: 'Team', onClick: goTeam }]
      : []),
    { id: 'highlights', label: 'Highlights', onClick: goHighlights },
    { id: 'year', label: 'Draft Year', onClick: goYear },
    { id: 'pos', label: 'Position', onClick: goPos },
    { id: 'rosters', label: 'Rosters', onClick: goRosters },
    // The open team's roster sits beside the league-wide board rather than
    // beside its Team tab: the two are the same page at two scopes, and
    // reading one straight after the other is what the pairing is for.
    ...(inTeamContext && teamId != null
      ? [{ id: 'roster' as const, label: 'Roster', onClick: goRoster }]
      : []),
  ];

  return (
    <header className="masthead">
      <button
        type="button"
        className="mast__brand"
        onClick={goRankings}
        aria-label="NFL Draft Success — home"
      >
        <div className="mast__mark">DS</div>
        <div>
          <div className="mast__name">
            NFL Draft <em>Success</em>
          </div>
          <div className="mast__tag">Snap share · Availability · Retention</div>
        </div>
      </button>
      <nav className="mast__nav" aria-label="Primary">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            ref={t.id === active ? activeTabRef : undefined}
            className={t.id === active ? 'is-active' : ''}
            onClick={t.onClick}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mast__meta">
        <div>
          <span className="mast__dot" /> Data synced{' '}
          <b>{dataLastUpdatedDate}</b>
        </div>
        <div>
          32 teams ·{' '}
          {formatYearRange(DRAFT_YEAR_BOUNDS.min, DRAFT_YEAR_BOUNDS.max)}
        </div>
      </div>
      {/* The glyph carries the meaning on mobile, where the label is hidden and
          these sit as icon buttons in the brand row. */}
      <div className="mast__controls">
        <button
          type="button"
          className="mast__ctrl-btn"
          onClick={onShowInfo}
          aria-label="Methodology"
        >
          <span className="mast__ctrl-ico" aria-hidden="true">
            ?
          </span>
          <span className="mast__ctrl-label">Info</span>
        </button>
        <button
          type="button"
          className={`mast__ctrl-btn${dark ? ' is-on' : ''}`}
          onClick={onToggleDark}
          aria-pressed={dark}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          <span className="mast__ctrl-ico" aria-hidden="true">
            {dark ? '☾' : '☀'}
          </span>
          <span className="mast__ctrl-label">{dark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}
