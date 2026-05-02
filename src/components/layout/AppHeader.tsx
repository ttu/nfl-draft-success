import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamSelector } from '../TeamSelector';
import { YearRangeFilter } from '../filters/YearRangeFilter';
import { DraftYearPicker } from '../draft/DraftYearPicker';
import { getTeamLogoUrl, NFL_LOGO_URL } from '../../data/teamColors';
import { getPositionDisplayName } from '../../lib/positionDisplayName';
import { ActiveView } from '../../types';

const YEAR_MIN = 2018;
const YEAR_MAX = 2026;

const VIEW_SPECIFIC_CONTENT = {
  positionList: {
    headingId: 'app-header-draft-years-heading',
    heading: 'Draft years',
    hint: 'Player lists below use this range.',
    rangeAriaLabel:
      'Years shown for player lists below (same window as team scores)',
  },
  teamDetail: {
    headingId: 'app-header-draft-years-heading',
    heading: 'Draft years',
    hint: 'Rolling score, draft cards, and roster use this window.',
    rangeAriaLabel:
      'Years included in rolling score, draft cards, and roster below',
  },
  teamRankings: {
    headingId: 'app-header-draft-years-heading',
    heading: 'Draft years',
    hint: 'Classes in this window feed team scores and rankings.',
    rangeAriaLabel: 'Years included in team scores and rankings below',
  },
};

function clampDraftYear(y: number): number {
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));
}

export interface AppHeaderTeamRankingsProps {
  yearRange: [number, number];
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onShowInfo: () => void;
  positionBrowseSearch: string;
  dataLastUpdatedDate: string;
}

export interface AppHeaderTeamDetailsProps {
  yearRange: [number, number];
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onShowRankings: () => void;
  onShowInfo: () => void;
  positionBrowseSearch: string;
  dataLastUpdatedDate: string;
}

export interface AppHeaderPositionListProps {
  yearRange: [number, number];
  onTeamSelect: (teamId: string) => void;
  onYearRangeChange: (range: [number, number]) => void;
  onShowRankings: () => void;
  positionBrowseSearch: string;
  positionOptions: string[];
  selectedPosition: string | null;
  onPositionChange: (position: string) => void;
  onShowInfo: () => void;
  dataLastUpdatedDate: string;
}

export interface AppHeaderDraftYearsProps {
  draftPickYear: number;
  onDraftPickYear: (year: number) => void;
  onShowRankings: () => void;
  onShowInfo: () => void;
  positionBrowseSearch: string;
  dataLastUpdatedDate: string;
}

interface AppHeaderProps {
  activeView: ActiveView;
  selectedTeam: string | null;

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
  /** e.g. "30 April 2026" from `data-meta.json`; shown under About in the menu */
  dataLastUpdatedDate: string;
}

export function AppHeaderTeamRankings({
  yearRange,
  onTeamSelect,
  onYearRangeChange,
  onShowInfo,
  positionBrowseSearch,
  dataLastUpdatedDate,
}: AppHeaderTeamRankingsProps) {
  return (
    <AppHeader
      activeView={ActiveView.TeamRankings}
      selectedTeam={null}
      draftPickYear={0}
      onDraftPickYear={() => {}}
      yearRange={yearRange}
      onShowRankings={() => {}}
      onTeamSelect={onTeamSelect}
      onYearRangeChange={onYearRangeChange}
      onShowInfo={onShowInfo}
      positionBrowseSearch={positionBrowseSearch}
      positionOptions={[]}
      selectedPosition={null}
      onPositionChange={() => {}}
      dataLastUpdatedDate={dataLastUpdatedDate}
    />
  );
}

export function AppHeaderTeamDetails({
  selectedTeam,
  yearRange,
  onTeamSelect,
  onYearRangeChange,
  onShowRankings,
  onShowInfo,
  positionBrowseSearch,
  dataLastUpdatedDate,
}: AppHeaderTeamDetailsProps) {
  return (
    <AppHeader
      activeView={ActiveView.TeamDetail}
      selectedTeam={selectedTeam}
      draftPickYear={0}
      onDraftPickYear={() => {}}
      yearRange={yearRange}
      onShowRankings={onShowRankings}
      onTeamSelect={onTeamSelect}
      onYearRangeChange={onYearRangeChange}
      onShowInfo={onShowInfo}
      positionBrowseSearch={positionBrowseSearch}
      positionOptions={[]}
      selectedPosition={null}
      onPositionChange={() => {}}
      dataLastUpdatedDate={dataLastUpdatedDate}
    />
  );
}

export function AppHeaderPositionList({
  yearRange,
  onShowRankings,
  onTeamSelect,
  onYearRangeChange,
  positionBrowseSearch = '',
  positionOptions = [],
  selectedPosition = null,
  onPositionChange,
  onShowInfo,
  dataLastUpdatedDate,
}: AppHeaderPositionListProps) {
  return (
    <AppHeader
      activeView={ActiveView.Position}
      selectedTeam={null}
      draftPickYear={0}
      onDraftPickYear={() => {}}
      yearRange={yearRange}
      onShowRankings={onShowRankings}
      onTeamSelect={onTeamSelect}
      onYearRangeChange={onYearRangeChange}
      onShowInfo={onShowInfo}
      positionBrowseSearch={positionBrowseSearch}
      positionOptions={positionOptions}
      selectedPosition={selectedPosition}
      onPositionChange={onPositionChange}
      dataLastUpdatedDate={dataLastUpdatedDate}
    />
  );
}

export function AppHeaderDraftYears({
  draftPickYear,
  onDraftPickYear,
  onShowRankings,
  onShowInfo,
  positionBrowseSearch,
  dataLastUpdatedDate,
}: AppHeaderDraftYearsProps) {
  return (
    <AppHeader
      activeView={ActiveView.DraftYears}
      selectedTeam={null}
      draftPickYear={draftPickYear}
      onDraftPickYear={onDraftPickYear}
      yearRange={[YEAR_MIN, YEAR_MAX]}
      onShowRankings={onShowRankings}
      onTeamSelect={() => {}}
      onYearRangeChange={() => {}}
      onShowInfo={onShowInfo}
      positionBrowseSearch={positionBrowseSearch}
      positionOptions={[]}
      selectedPosition={null}
      onPositionChange={() => {}}
      dataLastUpdatedDate={dataLastUpdatedDate}
    />
  );
}

function AppHeader({
  activeView,
  selectedTeam,
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
  dataLastUpdatedDate,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelId = useId();
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const draftsLinkYear = clampDraftYear(yearRange[1]);

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
        <AppHeaderBrand selectedTeam={selectedTeam} />
        <MenuButton
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          menuPanelId={menuPanelId}
        />
      </div>

      {menuOpen && (
        <MenuSection
          closeMenu={closeMenu}
          menuPanelId={menuPanelId}
          menuCloseRef={menuCloseRef}
          draftsLinkYear={draftsLinkYear}
          handleTeamRankings={handleTeamRankings}
          handleAbout={handleAbout}
          positionBrowseSearch={positionBrowseSearch}
          dataLastUpdatedDate={dataLastUpdatedDate}
        />
      )}

      <div className="app-controls app-controls--grouped">
        {activeView === ActiveView.TeamDetail && selectedTeam && (
          /* selectedTeam should always be set at this point */
          <>
            <TeamSelectorSection
              selectedTeam={selectedTeam}
              onTeamSelect={onTeamSelect}
            />
            <YearRangeFilterSection
              yearRange={yearRange}
              onYearRangeChange={onYearRangeChange}
              draftYearsSection={VIEW_SPECIFIC_CONTENT.teamDetail}
            />
          </>
        )}

        {activeView === ActiveView.TeamRankings && (
          <YearRangeFilterSection
            yearRange={yearRange}
            onYearRangeChange={onYearRangeChange}
            draftYearsSection={VIEW_SPECIFIC_CONTENT.teamRankings}
          />
        )}

        {activeView === ActiveView.Position && (
          <>
            <YearRangeFilterSection
              yearRange={yearRange}
              onYearRangeChange={onYearRangeChange}
              draftYearsSection={VIEW_SPECIFIC_CONTENT.positionList}
            />
            <PositionSelectorSection
              selectedPosition={selectedPosition}
              onPositionChange={onPositionChange ?? (() => {})}
              positionOptions={positionOptions}
            />
          </>
        )}

        {activeView === ActiveView.DraftYears && (
          <DraftYearPickerSection
            draftPickYear={draftPickYear}
            onDraftPickYear={onDraftPickYear}
          />
        )}
      </div>
    </header>
  );
}

const TeamSelectorSection = ({
  selectedTeam,
  onTeamSelect,
}: {
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
}) => {
  return (
    <div
      className="app-controls__group app-controls__group--nav"
      role="group"
      aria-label="Team navigation"
    >
      <TeamSelector value={selectedTeam} onChange={onTeamSelect} />
    </div>
  );
};

const YearRangeFilterSection = ({
  yearRange,
  onYearRangeChange,
  draftYearsSection,
}: {
  yearRange: [number, number];
  onYearRangeChange: (range: [number, number]) => void;
  draftYearsSection: {
    headingId: string;
    heading: string;
    hint: string;
    rangeAriaLabel: string;
  };
}) => {
  return (
    <div
      className="app-controls__group"
      role="group"
      aria-labelledby={draftYearsSection.headingId}
    >
      <div
        id={draftYearsSection.headingId}
        className="app-controls__group-heading"
      >
        {draftYearsSection.heading}
      </div>
      <p className="app-controls__group-hint">{draftYearsSection.hint}</p>
      <YearRangeFilter
        min={YEAR_MIN}
        max={YEAR_MAX}
        value={yearRange}
        onChange={onYearRangeChange}
        groupAriaLabel={draftYearsSection.rangeAriaLabel}
      />
    </div>
  );
};

const PositionSelectorSection = ({
  selectedPosition,
  onPositionChange,
  positionOptions,
}: {
  selectedPosition: string | null;
  onPositionChange: (position: string) => void;
  positionOptions: string[];
}) => {
  return (
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
        Filter by position; draft years are set above.
      </p>
      <select
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
  );
};

const DraftYearPickerSection = ({
  draftPickYear,
  onDraftPickYear,
}: {
  draftPickYear: number;
  onDraftPickYear: (year: number) => void;
}) => {
  return (
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
  );
};

const AppHeaderBrand = ({ selectedTeam }: { selectedTeam: string | null }) => {
  return (
    <div className="app-header__brand">
      <img
        src={selectedTeam ? getTeamLogoUrl(selectedTeam) : NFL_LOGO_URL}
        alt=""
        className="app-header__logo"
        referrerPolicy="no-referrer"
        aria-hidden
      />
      <div className="app-header__title-row">
        <h1>NFL Draft Success</h1>
      </div>
    </div>
  );
};

const MenuButton = ({
  menuOpen,
  setMenuOpen,
  menuPanelId,
}: {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  menuPanelId: string;
}) => {
  return (
    <button
      type="button"
      className="app-controls__icon-btn app-header__menu-btn"
      aria-expanded={menuOpen}
      aria-controls={menuPanelId}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      title="Menu"
      onClick={() => setMenuOpen(!menuOpen)}
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
  );
};

const MenuSection = ({
  closeMenu,
  menuPanelId,
  menuCloseRef,
  draftsLinkYear,
  handleTeamRankings,
  handleAbout,
  positionBrowseSearch,
  dataLastUpdatedDate,
}: {
  closeMenu: () => void;
  menuPanelId: string;
  menuCloseRef: React.RefObject<HTMLButtonElement | null>;
  draftsLinkYear: number;
  handleTeamRankings: () => void;
  handleAbout: () => void;
  positionBrowseSearch: string;
  dataLastUpdatedDate: string;
}) => {
  return (
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
                  title={`Open the ${draftsLinkYear} draft board (every pick). Choose a different year on that page.`}
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
                <hr className="app-header__menu-footer-divider" aria-hidden />
                <p className="app-header__menu-data-updated" aria-live="polite">
                  Data last updated: {dataLastUpdatedDate}
                </p>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};
