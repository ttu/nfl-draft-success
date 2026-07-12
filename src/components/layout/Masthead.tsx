import { useNavigate, useSearchParams, useMatch } from 'react-router-dom';

export type MastheadTab = 'rankings' | 'team' | 'year' | 'pos';

interface MastheadProps {
  active: MastheadTab;
  dataLastUpdatedDate: string;
  /** Year range to use when current URL has no from/to (e.g. on /year/{y}). */
  fallbackRange?: { from: number; to: number };
  onShowInfo: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Masthead({
  active,
  dataLastUpdatedDate,
  fallbackRange,
  onShowInfo,
  dark,
  onToggleDark,
}: MastheadProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const yearMatch = useMatch('/year/:draftYear');

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
  const goTeam = () => navigate({ pathname: '/', search });
  const goYear = () => {
    const y = effectiveTo ?? '2026';
    navigate({ pathname: `/year/${y}`, search });
  };
  const goPos = () => navigate({ pathname: '/position/QB', search });

  const tabs: Array<{ id: MastheadTab; label: string; onClick: () => void }> = [
    { id: 'rankings', label: 'Rankings', onClick: goRankings },
    // The Team tab points at a specific team's detail view, so it only makes
    // sense once a team is selected — i.e. when it is itself the active tab.
    ...(active === 'team'
      ? [{ id: 'team' as const, label: 'Team', onClick: goTeam }]
      : []),
    { id: 'year', label: 'Draft Year', onClick: goYear },
    { id: 'pos', label: 'Position', onClick: goPos },
  ];

  return (
    <header className="masthead">
      <button
        type="button"
        className="mast__brand"
        onClick={goRankings}
        aria-label="NFL Draft Success — home"
      >
        <div className="mast__mark">ND</div>
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
        <div>32 teams · 2018–2026</div>
      </div>
      <div className="mast__controls">
        <button
          type="button"
          className="mast__ctrl-btn"
          onClick={onShowInfo}
          aria-label="Methodology"
        >
          ? Info
        </button>
        <button
          type="button"
          className={`mast__ctrl-btn${dark ? ' is-on' : ''}`}
          onClick={onToggleDark}
          aria-pressed={dark}
          title="Toggle dark mode"
        >
          {dark ? '☾ Dark' : '☀ Light'}
        </button>
      </div>
    </header>
  );
}
