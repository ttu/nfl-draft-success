import { Link } from 'react-router-dom';
import { TeamSelector } from './TeamSelector';
import { YearRangeFilter } from './YearRangeFilter';
import { DraftYearPicker } from './DraftYearPicker';
import { getTeamLogoUrl, NFL_LOGO_URL } from '../data/teamColors';
import { getPositionDisplayName } from '../lib/positionDisplayName';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;

function clampDraftYear(y: number): number {
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));
}

export interface AppHeaderProps {
  selectedTeam: string | null;
  showRankingsView: boolean;
  /** Full-draft-by-year page (/year/:y) — show Team rankings control like team detail */
  showYearDraftView?: boolean;
  /** Cross-year position browser (/position/:code) */
  showPositionView?: boolean;
  /** Year for drafts-page picker only */
  draftPickYear: number;
  onDraftPickYear: (year: number) => void;
  yearRange: [number, number];
  onShowRankings: () => void;
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onShowInfo: () => void;
  /** Query string for “By position” link from rankings (preserves year window) */
  positionBrowseSearch?: string;
  positionOptions?: string[];
  selectedPosition?: string | null;
  onPositionChange?: (position: string) => void;
}

export function AppHeader({
  selectedTeam,
  showRankingsView,
  showYearDraftView = false,
  showPositionView = false,
  draftPickYear,
  onDraftPickYear,
  yearRange,
  onShowRankings,
  onTeamSelect,
  onYearRangeChange,
  onShowInfo,
  positionBrowseSearch = '',
  positionOptions = [],
  selectedPosition = null,
  onPositionChange,
}: AppHeaderProps) {
  const draftsLinkYear = clampDraftYear(yearRange[1]);
  const draftsBoardTitle = `Open the ${draftsLinkYear} draft board (every pick). Choose a different year on that page.`;

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
        <div className="app-header__title-row">
          <h1>NFL Draft Success</h1>
          <button
            type="button"
            onClick={onShowInfo}
            className="app-controls__icon-btn app-header__info-btn"
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
      </div>
      <div className="app-controls app-controls--grouped">
        {(!showRankingsView || showYearDraftView || showPositionView) && (
          <div
            className="app-controls__group app-controls__group--nav"
            role="group"
            aria-label="Team navigation"
          >
            <button
              type="button"
              onClick={onShowRankings}
              className="app-header__rankings-link"
            >
              Team rankings
            </button>
            {!showRankingsView && selectedTeam && (
              <TeamSelector value={selectedTeam} onChange={onTeamSelect} />
            )}
          </div>
        )}

        {!showYearDraftView && (
          <div
            className="app-controls__group"
            role="group"
            aria-labelledby="app-header-score-window-heading"
          >
            <div
              id="app-header-score-window-heading"
              className="app-controls__group-heading"
            >
              Team score window
            </div>
            <p className="app-controls__group-hint">
              Draft classes from these years feed the rankings and team scores
              below.
            </p>
            <YearRangeFilter
              min={YEAR_MIN}
              max={YEAR_MAX}
              value={yearRange}
              onChange={onYearRangeChange}
              groupAriaLabel="Years included in team scores (rankings below)"
            />
          </div>
        )}

        {showRankingsView && !showYearDraftView && (
          <div
            className="app-controls__group"
            role="group"
            aria-labelledby="app-header-draft-board-heading"
          >
            <div
              id="app-header-draft-board-heading"
              className="app-controls__group-heading"
            >
              League drafts
            </div>
            <p className="app-controls__group-hint">
              Browse one draft year or one position across your selected years.
            </p>
            <div className="app-header__draft-links">
              <Link
                to={`/year/${draftsLinkYear}`}
                className="app-header__rankings-link"
                title={draftsBoardTitle}
              >
                Drafts
              </Link>
              <Link
                to={{ pathname: '/position/QB', search: positionBrowseSearch }}
                className="app-header__rankings-link"
                title="All quarterbacks drafted in the years selected for team scores"
              >
                By position
              </Link>
            </div>
          </div>
        )}

        {showPositionView && (
          <div
            className="app-controls__group"
            role="group"
            aria-labelledby="app-header-position-heading"
          >
            <div
              id="app-header-position-heading"
              className="app-controls__group-heading"
            >
              Position
            </div>
            <p className="app-controls__group-hint">
              Switch position; the year window matches team score settings.
            </p>
            <select
              role="combobox"
              aria-label="Select position"
              className="draft-year-picker__select app-header__position-select"
              value={selectedPosition ?? ''}
              disabled={
                !onPositionChange ||
                positionOptions.length === 0 ||
                selectedPosition == null
              }
              onChange={(e) => onPositionChange?.(e.target.value)}
            >
              {positionOptions.map((p) => (
                <option key={p} value={p}>
                  {getPositionDisplayName(p)} ({p})
                </option>
              ))}
            </select>
          </div>
        )}

        {showYearDraftView && (
          <div
            className="app-controls__group"
            role="group"
            aria-labelledby="app-header-which-draft-heading"
          >
            <div
              id="app-header-which-draft-heading"
              className="app-controls__group-heading"
            >
              Which draft
            </div>
            <p className="app-controls__group-hint">
              Pick a year to load that draft&apos;s full pick list.
            </p>
            <DraftYearPicker
              min={YEAR_MIN}
              max={YEAR_MAX}
              value={draftPickYear}
              onChange={onDraftPickYear}
              showLabel={false}
            />
          </div>
        )}
      </div>
    </header>
  );
}
