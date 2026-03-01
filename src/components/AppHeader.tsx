import { TeamSelector } from './TeamSelector';
import { YearRangeFilter } from './YearRangeFilter';
import { getTeamLogoUrl, NFL_LOGO_URL } from '../data/teamColors';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;

export interface AppHeaderProps {
  selectedTeam: string | null;
  showRankingsView: boolean;
  yearRange: [number, number];
  copyFeedback: boolean;
  onShowRankings: () => void;
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onCopyLink: () => void;
  onShowInfo: () => void;
}

export function AppHeader({
  selectedTeam,
  showRankingsView,
  yearRange,
  copyFeedback,
  onShowRankings,
  onTeamSelect,
  onYearRangeChange,
  onCopyLink,
  onShowInfo,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        {selectedTeam ? (
          <img
            src={getTeamLogoUrl(selectedTeam)}
            alt=""
            className="app-header__logo"
            referrerPolicy="no-referrer"
            aria-hidden
          />
        ) : (
          <img
            src={NFL_LOGO_URL}
            alt=""
            className="app-header__logo"
            referrerPolicy="no-referrer"
            aria-hidden
          />
        )}
        <h1>NFL Draft Success</h1>
      </div>
      <div className="app-controls">
        {!showRankingsView && (
          <button
            type="button"
            onClick={onShowRankings}
            className="app-header__rankings-link"
          >
            Team rankings
          </button>
        )}
        {!showRankingsView && selectedTeam && (
          <TeamSelector value={selectedTeam} onChange={onTeamSelect} />
        )}
        <YearRangeFilter
          min={YEAR_MIN}
          max={YEAR_MAX}
          value={yearRange}
          onChange={onYearRangeChange}
        />
        <button
          type="button"
          onClick={onCopyLink}
          className="app-controls__copy-link"
          aria-label={copyFeedback ? 'Copied!' : 'Copy shareable link'}
          title="Copy shareable link"
        >
          {copyFeedback ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onShowInfo}
          className="app-controls__copy-link"
          aria-label="About"
          title="About"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>
    </header>
  );
}
