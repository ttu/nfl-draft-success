import { useEffect, useId, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelId = useId();
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const draftsLinkYear = clampDraftYear(yearRange[1]);
  const draftsBoardTitle = `Open the ${draftsLinkYear} draft board (every pick). Choose a different year on that page.`;

  const closeMenu = () => setMenuOpen(false);

  const handleAbout = () => {
    closeMenu();
    onShowInfo();
  };

  const handleTeamRankings = () => {
    closeMenu();
    onShowRankings();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) menuCloseRef.current?.focus();
  }, [menuOpen]);

  return (
    <header className="app-header">
      <div className="app-header__bar">
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
          </div>
        </div>
        <button
          type="button"
          className="app-controls__icon-btn app-header__menu-btn"
          aria-expanded={menuOpen}
          aria-controls={menuPanelId}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          title="Menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            className="app-header__menu-backdrop"
            aria-hidden
            onClick={closeMenu}
          />
          <div
            id={menuPanelId}
            className="app-header__menu-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-header-menu-title"
          >
            <div className="app-header__menu-panel-header">
              <h2 id="app-header-menu-title" className="app-header__menu-title">
                Menu
              </h2>
              <button
                ref={menuCloseRef}
                type="button"
                className="app-controls__icon-btn app-header__menu-close"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="app-header__menu-body">
              <nav aria-label="Site navigation">
                <ul className="app-header__menu-list">
                  <li>
                    <button
                      type="button"
                      className="app-header__menu-item"
                      onClick={handleTeamRankings}
                    >
                      Team rankings
                    </button>
                  </li>
                  <li>
                    <Link
                      to={`/year/${draftsLinkYear}`}
                      className="app-header__menu-item"
                      title={draftsBoardTitle}
                      onClick={closeMenu}
                    >
                      Drafts
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={{
                        pathname: '/position/QB',
                        search: positionBrowseSearch,
                      }}
                      className="app-header__menu-item"
                      title="All quarterbacks drafted in the years selected for team scores"
                      onClick={closeMenu}
                    >
                      By position
                    </Link>
                  </li>
                  <li className="app-header__menu-footer">
                    <button
                      type="button"
                      className="app-header__menu-item"
                      onClick={handleAbout}
                    >
                      About
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </>
      )}
      <div className="app-controls app-controls--grouped">
        {!showRankingsView && selectedTeam && (
          <div
            className="app-controls__group app-controls__group--nav"
            role="group"
            aria-label="Team navigation"
          >
            <TeamSelector value={selectedTeam} onChange={onTeamSelect} />
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
