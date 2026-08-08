import { memo, useCallback, useMemo, type CSSProperties } from 'react';
import { TEAMS } from '../../../data/teams';
import {
  TeamLogo,
  teamColor,
  teamFg,
  StatBlock,
} from '../../design/Primitives';
import { ScoreByYearChart } from '../../design/ScoreByYearChart';
import { getScoreByYear, type YearScore } from '../../../lib/getScoreByYear';
import { buildTeamNarrative } from '../../../lib/teamNarrative';
import { PlayerList } from '../../draft/PlayerList';
import { RoleFilter } from '../../filters/RoleFilter';
import {
  buildDraftClassMetricsRows,
  findLatestYearWithAwaitingData,
  shouldHideRosterYearHeading,
} from '../../../lib/draftClassDisplay';
import { activateOnKey } from '../../../lib/activateOnKey';
import {
  getUnitBreakdown,
  getPositionBreakdown,
  type UnitBreakdownRow,
  type PositionBreakdownRow,
} from '../../../lib/pickBreakdowns';
import { formatOrdinal } from '../../../lib/formatOrdinal';
import { formatOverSlot } from '../../../lib/formatOverSlot';
import {
  teamStory,
  type CorrelationRow,
} from '../../../lib/draftSuccessCorrelation';
import {
  formatYearRangeShort,
  type LaggedWindows,
} from '../../../lib/laggedWindow';
import type { DraftClass, DraftPick, Role } from '../../../types';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type { RollingDraftScore } from '../../../lib/getRollingDraftScore';
import { getTeamPicks } from '../../../lib/picksByTeam';

export interface RosterPick {
  pick: DraftPick;
  draftYear: number;
}

type TeamRank = { rank: number; total: number; rankings: TeamRanking[] } | null;

export interface TeamDetailContentProps {
  rollingDraftScore: RollingDraftScore;
  yearCount: number;
  teamRank: TeamRank;
  onShowRankings: () => void;
  draftClasses: DraftClass[];
  selectedTeam: string;
  draftingTeamOnly: boolean;
  roleFilter: Set<Role>;
  setRoleFilter: (value: Set<Role>) => void;
  rosterByDraftYear: { year: number; picks: RosterPick[] }[];
  depthChartUrl: string | null;
  showDeparted: boolean;
  setShowDeparted: (value: boolean) => void;
  /** This team's lagged draft-score↔win-rate row; null hides the card. */
  correlationRow: CorrelationRow | null;
  onShowMethodology: () => void;
  /** Fixed draft/win windows behind the correlation card. */
  windows: LaggedWindows;
}

function TeamDetailContentImpl({
  rollingDraftScore,
  yearCount,
  teamRank,
  onShowRankings,
  draftClasses,
  selectedTeam,
  draftingTeamOnly,
  roleFilter,
  setRoleFilter,
  rosterByDraftYear,
  depthChartUrl,
  showDeparted,
  setShowDeparted,
  correlationRow,
  onShowMethodology,
  windows,
}: TeamDetailContentProps) {
  const color = teamColor(selectedTeam);
  const hideRosterYearHeading = shouldHideRosterYearHeading({
    yearCount,
    draftClassesLength: draftClasses.length,
    rosterByDraftYear,
    draftClassYear: draftClasses[0]?.year,
  });
  // The hero, class grid and side rail are memoized and do not depend on the
  // roster's toggles, so everything feeding them is memoized too — otherwise
  // flipping "show departed" would re-render the whole page instead of the
  // roster alone.
  const metricsRows = useMemo(
    () =>
      buildDraftClassMetricsRows(draftClasses, selectedTeam, {
        draftingTeamOnly,
      }),
    [draftClasses, selectedTeam, draftingTeamOnly],
  );

  // Breakdowns count every pick the team made in the window — independent of the
  // roster's "Hide departed" toggle and role filter.
  const allTeamPicks = useMemo(
    () => getTeamPicks(draftClasses, selectedTeam),
    [draftClasses, selectedTeam],
  );
  const unitBreakdown = useMemo(
    () => getUnitBreakdown(allTeamPicks),
    [allTeamPicks],
  );
  const positionBreakdown = useMemo(
    () => getPositionBreakdown(allTeamPicks),
    [allTeamPicks],
  );

  // The per-class trend feeds both the hero chart and the Summary card's
  // trajectory beat, so it is computed once here and passed to both.
  const scoreByYear = useMemo(
    () => getScoreByYear(draftClasses, selectedTeam, { draftingTeamOnly }),
    [draftClasses, selectedTeam, draftingTeamOnly],
  );
  const narrative = useMemo(
    () =>
      buildTeamNarrative({
        coreStarterCount: rollingDraftScore.coreStarterCount,
        retainedCount: rollingDraftScore.retainedCount,
        scoredPickCount: rollingDraftScore.scoredPickCount,
        overSlot: rollingDraftScore.skillScore,
        scoreByYear,
      }),
    [rollingDraftScore, scoreByYear],
  );

  // Jump from a draft-class card down to that year's picks in the roster below.
  // Falls back to the roster section when the year is filtered out of the list.
  const scrollToRosterYear = useCallback((year: number) => {
    const target =
      document.getElementById(`roster-year-${year}`) ??
      document.getElementById('team-roster');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <>
      <TeamHero
        rollingDraftScore={rollingDraftScore}
        yearCount={yearCount}
        teamRank={teamRank}
        onShowRankings={onShowRankings}
        selectedTeam={selectedTeam}
        depthChartUrl={depthChartUrl}
        scoreByYear={scoreByYear}
      />

      <ClassGrid
        metricsRows={metricsRows}
        color={color}
        onSelectYear={scrollToRosterYear}
      />

      <section className="team-body">
        <RosterSection
          rosterByDraftYear={rosterByDraftYear}
          selectedTeam={selectedTeam}
          draftingTeamOnly={draftingTeamOnly}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          showDeparted={showDeparted}
          setShowDeparted={setShowDeparted}
          hideRosterYearHeading={hideRosterYearHeading}
        />
        <SideRail
          color={color}
          unitBreakdown={unitBreakdown}
          positionBreakdown={positionBreakdown}
          narrative={narrative}
          depthChartUrl={depthChartUrl}
          correlationRow={correlationRow}
          onShowMethodology={onShowMethodology}
          windows={windows}
        />
      </section>
    </>
  );
}

interface TeamHeroProps {
  rollingDraftScore: RollingDraftScore;
  yearCount: number;
  teamRank: TeamRank;
  onShowRankings: () => void;
  selectedTeam: string;
  depthChartUrl: string | null;
  scoreByYear: YearScore[];
}

const TeamHero = memo(function TeamHero({
  rollingDraftScore,
  yearCount,
  teamRank,
  onShowRankings,
  selectedTeam,
  depthChartUrl,
  scoreByYear,
}: TeamHeroProps) {
  const team = TEAMS.find((t) => t.id === selectedTeam);
  const color = teamColor(selectedTeam);
  const fg = teamFg(color);

  return (
    <section
      className="team-hero"
      style={
        {
          ['--team' as never]: color,
          ['--team-fg' as never]: fg,
        } as CSSProperties
      }
    >
      <div className="team-hero__grid">
        <div className="team-hero__color">
          <div
            style={{
              position: 'absolute',
              right: -40,
              bottom: -40,
              opacity: 0.18,
              pointerEvents: 'none',
            }}
          >
            <TeamLogo teamId={selectedTeam} size={280} ring={false} />
          </div>
          <div className="team-hero__kicker">
            Draft window · {yearCount} season{yearCount === 1 ? '' : 's'}
          </div>
          <div className="team-hero__abbrev">{selectedTeam}</div>
          <h1 className="team-hero__name">
            <span className="team-hero__city">
              {team?.name.split(' ').slice(0, -1).join(' ')}
            </span>
            {team?.name.split(' ').slice(-1)[0]}
          </h1>
          <div className="team-hero__score-row">
            <span className="team-hero__score">
              {rollingDraftScore.score.toFixed(1)}
            </span>
            <TeamHeroScoreCaption yearCount={yearCount} />
          </div>
        </div>

        <div className="team-hero__right">
          <div className="hero-stats-row">
            <StatBlock
              variant="hero"
              label="League Rank"
              value={teamRank ? `#${teamRank.rank}` : '—'}
              sub={teamRank ? `of ${teamRank.total}` : ''}
            />
            <StatBlock
              variant="hero"
              label="Core Starter Rate"
              value={`${(rollingDraftScore.coreStarterRate * 100).toFixed(0)}%`}
              sub="of all picks"
            />
            <StatBlock
              variant="hero"
              label="Retention"
              value={`${(rollingDraftScore.retentionRate * 100).toFixed(0)}%`}
              sub="on roster"
            />
            <StatBlock
              variant="hero"
              label="Total Picks"
              value={String(rollingDraftScore.totalPicks)}
              sub="in window"
            />
          </div>

          <ScoreByYearChart points={scoreByYear} stroke={color} />

          <button type="button" className="fab-link" onClick={onShowRankings}>
            ← Back to rankings
          </button>
          {depthChartUrl && (
            <a
              className="fab-link"
              href={depthChartUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 10 }}
            >
              Open depth chart ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
});

function TeamHeroScoreCaption({ yearCount }: { yearCount: number }) {
  return (
    <div style={{ lineHeight: 1.1 }}>
      <div className="team-hero__kicker" style={{ marginBottom: 0 }}>
        Draft Success Score
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}
      >
        {yearCount} season{yearCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

type MetricsRow = ReturnType<typeof buildDraftClassMetricsRows>[number];

const ClassGrid = memo(function ClassGrid({
  metricsRows,
  color,
  onSelectYear,
}: {
  metricsRows: MetricsRow[];
  color: string;
  onSelectYear: (year: number) => void;
}) {
  const latestYearWithAwaiting = findLatestYearWithAwaitingData(metricsRows);
  const totalPicks = metricsRows.reduce((a, r) => a + r.metrics.totalPicks, 0);

  return (
    <section
      className="class-grid-section"
      style={{ ['--team' as never]: color } as CSSProperties}
    >
      <div className="section-head">
        <h2>The classes, year by year.</h2>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {metricsRows.length} draft
          {metricsRows.length === 1 ? '' : 's'} · {totalPicks} picks
        </div>
      </div>
      <div className="class-grid">
        {metricsRows.map(({ dc, metrics }) => {
          const showAwait =
            latestYearWithAwaiting != null &&
            dc.year === latestYearWithAwaiting;
          return (
            <div
              key={dc.year}
              className="class-card"
              role="button"
              tabIndex={0}
              aria-label={`Jump to the ${dc.year} draft class in the roster below`}
              onClick={() => onSelectYear(dc.year)}
              onKeyDown={activateOnKey(() => onSelectYear(dc.year))}
            >
              <div className="class-card__bar" />
              <div className="class-card__head">
                <span className="class-card__year">{dc.year}</span>
                <span className="class-card__score">
                  {metrics.totalPicks > 0
                    ? `${Math.round(metrics.draftScore)}`
                    : '—'}
                </span>
              </div>
              <div className="class-card__divider" />
              <div className="class-card__row">
                <span>Picks</span>
                <span>{metrics.totalPicks}</span>
              </div>
              <div className="class-card__row class-card__row--highlight">
                <span>Core starters</span>
                <span>{metrics.coreStarterCount}</span>
              </div>
              <div className="class-card__row">
                <span>Contributors</span>
                <span>{metrics.contributorCount}</span>
              </div>
              <div className="class-card__row">
                <span>Retained</span>
                <span>
                  {metrics.retentionCount}/{metrics.totalPicks}
                </span>
              </div>
              {showAwait && (
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-4)',
                    marginTop: 8,
                  }}
                >
                  Awaiting season data
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

interface RosterSectionProps {
  rosterByDraftYear: { year: number; picks: RosterPick[] }[];
  selectedTeam: string;
  draftingTeamOnly: boolean;
  roleFilter: Set<Role>;
  setRoleFilter: (value: Set<Role>) => void;
  showDeparted: boolean;
  setShowDeparted: (value: boolean) => void;
  hideRosterYearHeading: boolean;
}

function RosterSection({
  rosterByDraftYear,
  selectedTeam,
  draftingTeamOnly,
  roleFilter,
  setRoleFilter,
  showDeparted,
  setShowDeparted,
  hideRosterYearHeading,
}: RosterSectionProps) {
  return (
    <div className="roster-section" id="team-roster">
      <div className="section-head">
        <h2>
          Current roster{' '}
          <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>
            · {rosterByDraftYear.reduce((a, g) => a + g.picks.length, 0)} picks
          </span>
        </h2>
        <label className="roster-controls">
          <input
            type="checkbox"
            checked={showDeparted}
            onChange={(e) => setShowDeparted(e.target.checked)}
            aria-label="Show departed players"
          />
          <span>Show departed</span>
        </label>
      </div>

      <RoleFilter value={roleFilter} onChange={setRoleFilter} />

      {rosterByDraftYear.map(({ year, picks }) => (
        <div key={year} id={`roster-year-${year}`} className="roster-year">
          {!hideRosterYearHeading && (
            <div className="roster-year__head">
              <span className="roster-year__title">Draft {year}</span>
              <span className="kicker">{picks.length} picks</span>
              <span className="roster-year__rule" />
            </div>
          )}
          <PlayerList
            picks={picks}
            teamId={selectedTeam}
            draftingTeamOnly={draftingTeamOnly}
          />
        </div>
      ))}
    </div>
  );
}

const SideRail = memo(function SideRail({
  color,
  unitBreakdown,
  positionBreakdown,
  narrative,
  depthChartUrl,
  correlationRow,
  onShowMethodology,
  windows,
}: {
  color: string;
  unitBreakdown: UnitBreakdownRow[];
  positionBreakdown: PositionBreakdownRow[];
  /** The Summary card's read, one sentence per beat. */
  narrative: string[];
  depthChartUrl: string | null;
  correlationRow: CorrelationRow | null;
  onShowMethodology: () => void;
  windows: LaggedWindows;
}) {
  return (
    <aside
      className="side-rail"
      style={{ ['--team' as never]: color } as CSSProperties}
    >
      <WherePicksWentCard rows={unitBreakdown} />
      <PicksByPositionCard rows={positionBreakdown} />
      {correlationRow && (
        <ValidationCard
          row={correlationRow}
          onShowMethodology={onShowMethodology}
          windows={windows}
        />
      )}
      <SummaryCard narrative={narrative} depthChartUrl={depthChartUrl} />
    </aside>
  );
});

/**
 * This team's own version of the league's lagged correlation: how its early
 * draft-success score and its later win rate each rank among the 32, and a
 * one-line read on the gap between them. Only shown when the team has outcome
 * data for the win window.
 */
function ValidationCard({
  row,
  onShowMethodology,
  windows,
}: {
  row: CorrelationRow;
  onShowMethodology: () => void;
  windows: LaggedWindows;
}) {
  const draftLabel = formatYearRangeShort(windows.draftFrom, windows.draftTo);
  const winLabel = formatYearRangeShort(windows.winFrom, windows.winTo);
  return (
    <SideCard title="Draft, then winning">
      <PctBar
        label={`Over slot ${draftLabel}`}
        value={formatOverSlot(row.overSlot)}
        pct={row.overSlotPercentile}
        variant="team"
      />
      <PctBar
        label={`Win rate ${winLabel}`}
        value={`${Math.round(row.winPct * 100)}%`}
        pct={row.winPctPercentile}
      />
      <div className="validation-card__counts">
        <span>
          Playoffs{' '}
          <b>
            {row.playoffApps}/{row.seasons}
          </b>
        </span>
        <span>
          SB apps <b>{row.sbApps}</b>
        </span>
        <span>
          SB wins <b>{row.sbWins}</b>
        </span>
      </div>
      {teamStory(row).map((beat) => (
        <p key={beat} className="validation-card__take">
          {beat}
        </p>
      ))}
      <button
        type="button"
        className="fab-link side-card__cta"
        onClick={onShowMethodology}
      >
        See all 32 teams in Methodology →
      </button>
    </SideCard>
  );
}

/** A labelled percentile bar: label, value + ordinal percentile, filled track. */
function PctBar({
  label,
  value,
  pct,
  variant,
}: {
  label: string;
  value: string;
  pct: number;
  variant?: 'team';
}) {
  return (
    <div className="pct-bar">
      <div className="pct-bar__head">
        <span>{label}</span>
        <span className="mono pct-bar__value">
          {value} · {formatOrdinal(pct)} pct
        </span>
      </div>
      <div className="bar-track">
        <div
          className={`bar-fill${variant === 'team' ? ' bar-fill--team' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Offense / defense / special-teams split, one full-width bar per unit. */
function WherePicksWentCard({ rows }: { rows: UnitBreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <SideCard title="Where the picks went">
      {rows.map((row) => (
        <div key={row.unit} className="breakdown-row">
          <div className="breakdown-row__head">
            <span>{row.label}</span>
            <span className="mono breakdown-row__count">{row.count}</span>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill bar-fill--team"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </SideCard>
  );
}

/** Per-position pick counts, sorted most-drafted first. */
function PicksByPositionCard({ rows }: { rows: PositionBreakdownRow[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <SideCard title="Picks by position">
      {rows.map((row) => (
        <div key={row.position} className="pos-row">
          <span className="mono pos-row__label">{row.position}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
          <span className="mono pos-row__count">{row.count}</span>
        </div>
      ))}
    </SideCard>
  );
}

function SummaryCard({
  narrative,
  depthChartUrl,
}: {
  narrative: string[];
  depthChartUrl: string | null;
}) {
  return (
    <SideCard title="Summary" muted>
      {narrative.map((beat) => (
        <p key={beat} className="side-card__prose">
          {beat}
        </p>
      ))}
      {depthChartUrl && (
        <a
          className="fab-link side-card__cta"
          href={depthChartUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open external depth chart ↗
        </a>
      )}
    </SideCard>
  );
}

function SideCard({
  title,
  children,
  muted,
}: {
  title: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={`side-card${muted ? ' side-card--muted' : ''}`}>
      <div className="kicker side-card__head">{title}</div>
      {children}
    </section>
  );
}

/**
 * Memoized: `AppContent` re-renders on state this tree does not read (theme,
 * the info modal, route bookkeeping). Every prop it receives is referentially
 * stable by construction — derived values are memoized and handlers are
 * wrapped in `useCallback` in App.tsx — so the comparison actually bails out.
 */
export const TeamDetailContent = memo(TeamDetailContentImpl);
