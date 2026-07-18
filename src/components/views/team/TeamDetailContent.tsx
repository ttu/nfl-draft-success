import type { CSSProperties } from 'react';
import { TEAMS } from '../../../data/teams';
import {
  TeamLogo,
  teamColor,
  teamFg,
  Delta,
  StatBlock,
} from '../../design/Primitives';
import { ScoreByYearChart } from '../../design/ScoreByYearChart';
import { getScoreByYear } from '../../../lib/getScoreByYear';
import { PlayerList } from '../../draft/PlayerList';
import { RoleFilter } from '../../filters/RoleFilter';
import {
  buildDraftClassMetricsRows,
  findLatestYearWithAwaitingData,
  shouldHideRosterYearHeading,
} from '../../../lib/draftClassDisplay';
import { activateOnKey } from '../../../lib/activateOnKey';
import type { DraftClass, DraftPick, Role } from '../../../types';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type { RollingDraftScore } from '../../../lib/getRollingDraftScore';

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
}

export function TeamDetailContent({
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
}: TeamDetailContentProps) {
  const color = teamColor(selectedTeam);
  const hideRosterYearHeading = shouldHideRosterYearHeading({
    yearCount,
    draftClassesLength: draftClasses.length,
    rosterByDraftYear,
    draftClassYear: draftClasses[0]?.year,
  });
  const metricsRows = buildDraftClassMetricsRows(draftClasses, selectedTeam, {
    draftingTeamOnly,
  });

  // Jump from a draft-class card down to that year's picks in the roster below.
  // Falls back to the roster section when the year is filtered out of the list.
  const scrollToRosterYear = (year: number) => {
    const target =
      document.getElementById(`roster-year-${year}`) ??
      document.getElementById('team-roster');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <TeamHero
        rollingDraftScore={rollingDraftScore}
        yearCount={yearCount}
        teamRank={teamRank}
        onShowRankings={onShowRankings}
        draftClasses={draftClasses}
        selectedTeam={selectedTeam}
        draftingTeamOnly={draftingTeamOnly}
        depthChartUrl={depthChartUrl}
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
        <SideRail teamRank={teamRank} rollingDraftScore={rollingDraftScore} />
      </section>
    </>
  );
}

interface TeamHeroProps {
  rollingDraftScore: RollingDraftScore;
  yearCount: number;
  teamRank: TeamRank;
  onShowRankings: () => void;
  draftClasses: DraftClass[];
  selectedTeam: string;
  draftingTeamOnly: boolean;
  depthChartUrl: string | null;
}

function TeamHero({
  rollingDraftScore,
  yearCount,
  teamRank,
  onShowRankings,
  draftClasses,
  selectedTeam,
  draftingTeamOnly,
  depthChartUrl,
}: TeamHeroProps) {
  const team = TEAMS.find((t) => t.id === selectedTeam);
  const color = teamColor(selectedTeam);
  const fg = teamFg(color);
  const scoreByYear = getScoreByYear(draftClasses, selectedTeam, {
    draftingTeamOnly,
  });

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
}

type MetricsRow = ReturnType<typeof buildDraftClassMetricsRows>[number];

function ClassGrid({
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
}

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

function SideRail({
  teamRank,
  rollingDraftScore,
}: {
  teamRank: TeamRank;
  rollingDraftScore: RollingDraftScore;
}) {
  return (
    <aside className="side-rail">
      <SideCard title="Trend overview">
        <Delta value={teamRank ? teamRank.rank - 16 : 0} />{' '}
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          vs league midpoint
        </span>
      </SideCard>
      <SideCard title="The verdict" muted>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--f-serif)',
            fontSize: 15,
            lineHeight: 1.45,
            color: 'var(--ink-2)',
          }}
        >
          {rollingDraftScore.coreStarterRate > 0.4
            ? 'A strong run — this team is producing starters at an above-average clip.'
            : rollingDraftScore.coreStarterRate > 0.25
              ? 'A steady, unspectacular run. Retention remains the strength.'
              : 'A lean stretch. Few picks have settled into starter-level snaps.'}
        </p>
      </SideCard>
    </aside>
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
