import { TeamSelector } from './TeamSelector';
import { YearRangeFilter } from './YearRangeFilter';
import { getTeamLogoUrl, NFL_LOGO_URL } from '../data/teamColors';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;

export interface AppHeaderProps {
  selectedTeam: string | null;
  showRankingsView: boolean;
  yearRange: [number, number];
  onShowRankings: () => void;
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onShowInfo: () => void;
}

export function AppHeader({
  selectedTeam,
  showRankingsView,
  yearRange,
  onShowRankings,
  onTeamSelect,
  onYearRangeChange,
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
          onClick={onShowInfo}
          className="app-controls__icon-btn"
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
