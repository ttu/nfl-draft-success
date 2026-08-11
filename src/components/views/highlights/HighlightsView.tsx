import { memo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlayerAvatar, TeamLogo, teamColor } from '../../design/Primitives';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import {
  formatOverSlot,
  isOverSlotPositive,
} from '../../../lib/formatOverSlot';
import { activateOnKey } from '../../../lib/activateOnKey';
import {
  HIGHLIGHT_LIST_SIZE,
  type LeagueHighlights,
  type PlayerHighlight,
  type TeamHighlight,
} from '../../../lib/getLeagueHighlights';
import { seasonTag } from '../../../lib/seasonTag';
import type {
  CareerShapeHighlights,
  RankedPlayer,
} from '../../../lib/careerShapeHighlights';
import type { TeamRateHighlight } from '../../../lib/retentionHighlights';
import type { DraftPick, Team } from '../../../types';

/**
 * What every highlight row needs, whatever list it came from. Each list adapts
 * its own rows into this shape, so the row component never branches on which
 * list it is rendering.
 */
interface HighlightRowData {
  pick: DraftPick;
  team: Team | undefined;
  draftYear: number;
  /** Right-hand column, e.g. `+12.4` or `5`. */
  headline: string;
  /** Colour cue for the headline. */
  tone: 'high' | 'low';
  /** Trailing text on the meta line, e.g. `score 84` or `90% when active`. */
  detail: string;
  /** Tooltip on the headline. */
  headlineTitle: string;
}

/** Steals and busts: ranked on the over-slot residual, with the raw score below. */
function fromPlayerHighlight(h: PlayerHighlight): HighlightRowData {
  return {
    pick: h.pick,
    team: h.team,
    draftYear: h.draftYear,
    headline: formatOverSlot(h.overSlot),
    tone: isOverSlotPositive(h.overSlot) ? 'high' : 'low',
    detail: `score ${h.score.toFixed(0)}`,
    headlineTitle: 'Draft score above or below what this draft slot predicted',
  };
}

/** Every other list: the lib already formatted its own headline and detail. */
function fromRankedPlayer(r: RankedPlayer, title: string): HighlightRowData {
  return {
    pick: r.pick,
    team: r.team,
    draftYear: r.draftYear,
    headline: r.headline,
    tone: 'high',
    detail: r.detail,
    headlineTitle: title,
  };
}

/** Which {@link RankedPlayer} list to render, and how to label it. */
interface RankedListSpec {
  key: keyof CareerShapeHighlights | 'gotAway';
  kicker: string;
  note: string;
  accent: 'core' | 'non';
  /** Tooltip explaining what the right-hand number counts. */
  headlineTitle: string;
}

/** Snakebit takes the bust accent: it is a story about loss, and should read as one. */
const CAREER_SHAPE_LISTS: RankedListSpec[] = [
  {
    key: 'dayOneStarters',
    kicker: 'Day-one starters',
    note: 'rookie-year snap share',
    accent: 'core',
    headlineTitle: 'Snap share in his rookie season',
  },
  {
    key: 'lateBloomers',
    kicker: 'Late bloomers',
    note: 'rise from rookie year to peak',
    accent: 'core',
    headlineTitle: 'Snap-share points gained from rookie year to peak',
  },
  {
    key: 'ironMen',
    kicker: 'Iron men',
    note: 'longest run of full seasons',
    accent: 'core',
    headlineTitle: 'Consecutive full, contributing seasons',
  },
  {
    key: 'snakebit',
    kicker: 'Snakebit',
    note: 'games missed by a full-time player',
    accent: 'non',
    headlineTitle: 'Team games missed',
  },
];

const RETENTION_LISTS: RankedListSpec[] = [
  {
    key: 'gotAway',
    kicker: 'The ones that got away',
    note: 'score gained after leaving',
    accent: 'non',
    headlineTitle: 'Season-score points gained after leaving',
  },
];

const NO_PICKS_LABEL = 'No picks with data in this window yet.';

/** A labelled group of highlight lists. */
function HighlightBand({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="highlights-band">
      <h2 className="highlights-band__title kicker">{title}</h2>
      <div className="highlights-lists">{children}</div>
    </section>
  );
}

/** The lists in `specs`, each read out of `highlights` by its own key. */
function RankedLists({
  specs,
  highlights,
}: {
  specs: RankedListSpec[];
  highlights: LeagueHighlights;
}) {
  return (
    <>
      {specs.map((spec) => (
        <PlayerList
          key={spec.key}
          kicker={spec.kicker}
          note={spec.note}
          accent={spec.accent}
          items={highlights[spec.key].map((r) =>
            fromRankedPlayer(r, spec.headlineTitle),
          )}
          emptyLabel={NO_PICKS_LABEL}
        />
      ))}
    </>
  );
}

export interface HighlightsViewProps {
  highlights: LeagueHighlights;
  startYear: number;
  endYear: number;
  onTeamSelect: (teamId: string) => void;
}

function HighlightsViewImpl({
  highlights,
  startYear,
  endYear,
  onTeamSelect,
}: HighlightsViewProps) {
  const { steals, busts, mostCoreStarters } = highlights;

  return (
    <section className="highlights-view" aria-label="Draft highlights">
      <section className="page-hero">
        <div className="highlights-hero">
          <div className="kicker" style={{ marginBottom: 12 }}>
            Draft highlights · {seasonTag(startYear)} → {seasonTag(endYear)}
          </div>
          <h1 className="page-hero__headline">
            The <em>steals</em>, the busts, the bodies, the ones who left.
          </h1>
          <p className="page-hero__lede">
            The picks and teams that stand out across the window — who beat what
            their draft slot predicted and who fell short of it, who arrived
            ready and who took years to get there, who never missed a week and
            who spent his career hurt, and which teams kept the players worth
            keeping.
          </p>
        </div>
      </section>

      <HighlightBand title="Value">
        <PlayerList
          kicker="Steals of the window"
          note="best value vs draft slot"
          accent="core"
          items={steals.map(fromPlayerHighlight)}
          emptyLabel={NO_PICKS_LABEL}
        />
        <PlayerList
          kicker="Biggest busts"
          note="worst value vs draft slot"
          accent="non"
          items={busts.map(fromPlayerHighlight)}
          emptyLabel={NO_PICKS_LABEL}
        />
      </HighlightBand>

      <HighlightBand title="Career shape">
        <RankedLists specs={CAREER_SHAPE_LISTS} highlights={highlights} />
      </HighlightBand>

      <HighlightBand title="Retention">
        <RankedLists specs={RETENTION_LISTS} highlights={highlights} />
        <TeamRateList
          kicker="Kept the band together"
          note="keepers still with the drafting team"
          rows={highlights.keptTheBand}
          onTeamSelect={onTeamSelect}
        />
      </HighlightBand>

      <TeamLeader highlight={mostCoreStarters} onTeamSelect={onTeamSelect} />

      <div className="highlights-foot">
        <p>
          The draft success score (0–100) combines how much a player is on the
          field with how available he stays. The value lists rank by the big
          number: how far the score landed above or below what the draft slot
          predicted. That is why a seventh-rounder scoring 83 outranks a
          fourth-rounder scoring 96 — and why no round filter is needed, since
          early picks have little room to beat their slot and late picks little
          room to miss. Players are credited to the team that drafted them.
        </p>
        <p>
          Career shape ignores the score and reads the career itself: how much
          of his rookie year a player was on the field, how far he climbed from
          that first year to his best one, how long he went without missing a
          week, and how many weeks were taken from a player who started whenever
          he dressed. One difference is worth naming. A player who{' '}
          <em>sat before he started</em> counts that quiet rookie year here,
          because the rise from it is the whole point — while the draft score
          elsewhere forgives an apprentice season rather than counting it
          against him. Retention looks at who stayed: a pick who found a
          starting job somewhere else is charged to the team that let him go,
          and the retention rate counts only the picks worth keeping, so cutting
          a miss early never looks like a failure to keep anyone.
        </p>
        <p>
          One limit worth stating plainly. Every number here counts snaps and
          games, never how well anyone played them, so the ones that got away
          are the picks who could not get on the field for the team that drafted
          them and did somewhere else. A player who started every week and
          started badly, then became a star elsewhere, does not show up: he was
          already playing, so by this measure he never rose.
        </p>
      </div>
    </section>
  );
}

function PlayerList({
  kicker,
  note,
  accent,
  items,
  emptyLabel,
}: {
  kicker: string;
  note: string;
  accent: 'core' | 'non';
  items: HighlightRowData[];
  emptyLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = items.length > HIGHLIGHT_LIST_SIZE;
  const visible =
    expanded || !canExpand ? items : items.slice(0, HIGHLIGHT_LIST_SIZE);

  return (
    <article className={`highlight-list highlight-list--${accent}`}>
      <div className="highlight-list__head">
        <div className="kicker">{kicker}</div>
        <div className="highlight-list__note mono">{note}</div>
      </div>
      {items.length === 0 ? (
        <div className="highlight-list__empty">{emptyLabel}</div>
      ) : (
        <>
          <ol className="highlight-list__rows">
            {visible.map((row, i) => (
              <PlayerRow
                key={row.pick.playerId}
                rank={i + 1}
                row={row}
                accent={accent}
              />
            ))}
          </ol>
          {canExpand && (
            <button
              type="button"
              className="highlight-list__more"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : `Show top ${items.length}`}
            </button>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Position, class, pick reference, team and the list's own detail under a
 * player's name. Grouped so the line only ever breaks between groups — never
 * inside a pick reference, and never between a team logo and its code.
 */
function PlayerMeta({
  pick,
  team,
  draftYear,
  detail,
}: Pick<HighlightRowData, 'pick' | 'team' | 'draftYear' | 'detail'>) {
  return (
    <div className="highlight-row__meta mono">
      <span>
        {pick.position} · {seasonTag(draftYear)} ·
      </span>
      <span className="nowrap">
        R{pick.round} #{pick.overallPick}
      </span>
      <span className="nowrap">
        <TeamLogo teamId={pick.teamId} size={14} ring={false} />
        {team?.abbreviation ?? pick.teamId} · {detail}
      </span>
    </div>
  );
}

function PlayerRow({
  rank,
  row,
  accent,
}: {
  rank: number;
  row: HighlightRowData;
  accent: 'core' | 'non';
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pick, team, draftYear, detail, headline, tone, headlineTitle } = row;
  const openPlayer = () =>
    navigate(
      buildPlayerHref(pick.playerId, location.pathname + location.search),
    );

  return (
    <li>
      <button
        type="button"
        className="highlight-row"
        aria-label={`View ${pick.playerName}`}
        onClick={openPlayer}
      >
        <span className={`highlight-row__rank highlight-row__rank--${accent}`}>
          {rank}
        </span>
        <PlayerAvatar
          teamId={pick.teamId}
          name={pick.playerName}
          src={pick.headshotUrl}
          size={44}
        />
        <div className="highlight-row__id">
          <div className="highlight-row__name">{pick.playerName}</div>
          <PlayerMeta
            pick={pick}
            team={team}
            draftYear={draftYear}
            detail={detail}
          />
        </div>
        <div
          className={`highlight-row__score tnum highlight-row__score--${tone}`}
          title={headlineTitle}
        >
          {headline}
        </div>
      </button>
    </li>
  );
}

/**
 * A team ranking in the same card language as {@link PlayerList}: one row per
 * team, the rate as the headline, and the counts behind it on the meta line so
 * a thin sample cannot hide behind a round percentage.
 */
function TeamRateList({
  kicker,
  note,
  rows,
  onTeamSelect,
}: {
  kicker: string;
  note: string;
  rows: TeamRateHighlight[];
  onTeamSelect: (teamId: string) => void;
}) {
  return (
    <article className="highlight-list highlight-list--core">
      <div className="highlight-list__head">
        <div className="kicker">{kicker}</div>
        <div className="highlight-list__note mono">{note}</div>
      </div>
      {rows.length === 0 ? (
        <div className="highlight-list__empty">
          No team has enough keepers in this window yet.
        </div>
      ) : (
        <ol className="highlight-list__rows">
          {rows.map((row, i) => (
            <TeamRateRow
              key={row.teamId}
              rank={i + 1}
              row={row}
              onTeamSelect={onTeamSelect}
            />
          ))}
        </ol>
      )}
    </article>
  );
}

function TeamRateRow({
  rank,
  row,
  onTeamSelect,
}: {
  rank: number;
  row: TeamRateHighlight;
  onTeamSelect: (teamId: string) => void;
}) {
  const { teamId, team, kept, keepers, rate } = row;

  return (
    <li>
      <button
        type="button"
        className="highlight-row"
        aria-label={`View ${team?.name ?? teamId}`}
        onClick={() => onTeamSelect(teamId)}
      >
        <span className="highlight-row__rank highlight-row__rank--core">
          {rank}
        </span>
        <TeamLogo teamId={teamId} size={44} ring={false} />
        <div className="highlight-row__id">
          <div className="highlight-row__name">{team?.name ?? teamId}</div>
          <div className="highlight-row__meta mono">
            <span className="nowrap">
              {kept} of {keepers} keepers kept
            </span>
          </div>
        </div>
        <div
          className="highlight-row__score tnum highlight-row__score--high"
          title="Share of this team's starter-grade picks still with the team in their latest season"
        >
          {Math.round(rate * 100)}%
        </div>
      </button>
    </li>
  );
}

function TeamLeader({
  highlight,
  onTeamSelect,
}: {
  highlight: TeamHighlight | null;
  onTeamSelect: (teamId: string) => void;
}) {
  const kicker = 'Most core starters';

  if (!highlight) {
    return (
      <article className="highlight-leader highlight-leader--empty">
        <div className="kicker">{kicker}</div>
        <div className="highlight-leader__empty">
          No core starters produced in this window yet.
        </div>
      </article>
    );
  }

  const { teamId, team, count } = highlight;

  return (
    <div
      className="highlight-leader"
      role="button"
      tabIndex={0}
      aria-label={`View ${team?.name ?? teamId}`}
      onClick={() => onTeamSelect(teamId)}
      onKeyDown={activateOnKey(() => onTeamSelect(teamId))}
    >
      <div
        className="highlight-leader__bar"
        style={{ background: teamColor(teamId) }}
        aria-hidden
      />
      <TeamLogo teamId={teamId} size={52} ring={false} />
      <div className="highlight-leader__id">
        <div className="kicker">{kicker}</div>
        <div className="highlight-leader__name">{team?.name ?? teamId}</div>
      </div>
      <div className="highlight-leader__count">
        <span className="highlight-leader__num tnum">{count}</span>
        <span className="highlight-leader__label mono">
          core starters produced
        </span>
      </div>
    </div>
  );
}

/**
 * Memoized: `AppContent` re-renders on state this tree does not read (theme,
 * the info modal, route bookkeeping). Every prop it receives is referentially
 * stable by construction — derived values are memoized and handlers are
 * wrapped in `useCallback` in App.tsx — so the comparison actually bails out.
 */
export const HighlightsView = memo(HighlightsViewImpl);
