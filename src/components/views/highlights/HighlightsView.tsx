import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PlayerAvatar,
  TeamLogo,
  teamColor,
  scoreTierClass,
} from '../../design/Primitives';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import { activateOnKey } from '../../../lib/activateOnKey';
import {
  HIGHLIGHT_LIST_SIZE,
  type LeagueHighlights,
  type PlayerHighlight,
  type TeamHighlight,
} from '../../../lib/getLeagueHighlights';

export interface HighlightsViewProps {
  highlights: LeagueHighlights;
  startYear: number;
  endYear: number;
  onTeamSelect: (teamId: string) => void;
}

/** Two-digit season suffix, e.g. 2021 → "'21". */
function seasonTag(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}

export function HighlightsView({
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
            The <em>steals</em>, the busts, the factories.
          </h1>
          <p className="page-hero__lede">
            The picks and teams that stand out across the window — the best
            late-round value, the priciest misses, and who churned out the most
            every-down starters.
          </p>
        </div>
      </section>

      <div className="highlights-lists">
        <PlayerList
          kicker="Steals of the window"
          note="round 4+ · best value"
          accent="core"
          items={steals}
          emptyLabel="No round 4+ picks with data in this window yet."
        />
        <PlayerList
          kicker="Biggest busts"
          note="round 1 · priciest misses"
          accent="non"
          items={busts}
          emptyLabel="No round 1 picks with data in this window yet."
        />
      </div>

      <TeamLeader highlight={mostCoreStarters} onTeamSelect={onTeamSelect} />

      <div className="highlights-foot">
        The draft success score (0–100) combines how much a player is on the
        field with how available he stays. Steals are picks from round 4 or
        later; busts are round 1. Players are credited to the team that drafted
        them.
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
  items: PlayerHighlight[];
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
            {visible.map((h, i) => (
              <PlayerRow
                key={h.pick.playerId}
                rank={i + 1}
                highlight={h}
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

function PlayerRow({
  rank,
  highlight,
  accent,
}: {
  rank: number;
  highlight: PlayerHighlight;
  accent: 'core' | 'non';
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pick, team, draftYear, score } = highlight;
  const scoreClass = scoreTierClass(score, {
    high: 'highlight-row__score--high',
    low: 'highlight-row__score--low',
  });
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
          <div className="highlight-row__meta mono">
            {pick.position} · {seasonTag(draftYear)} · R{pick.round} #
            {pick.overallPick}
            <TeamLogo teamId={pick.teamId} size={14} ring={false} />
            {team?.abbreviation ?? pick.teamId}
          </div>
        </div>
        <div className={`highlight-row__score ${scoreClass} tnum`}>
          {score.toFixed(0)}
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
