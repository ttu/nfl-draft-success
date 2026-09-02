import { Link } from 'react-router-dom';
import type { DraftClass } from '../../../types';
import { DRAFT_YEAR_BOUNDS } from '../../../lib/draftYearBounds';
import { hasRosterSnapshot } from '../../../lib/currentRoster';
import {
  getRosterRankings,
  type RosterRanking,
} from '../../../lib/rosterRankings';
import { TeamLogo, teamColor } from '../../design/Primitives';
import { StatBlock } from '../../design/StatBlock';

interface RosterRankingsViewProps {
  /** All shipped classes — the roster is not a year-range question. */
  draftClasses: DraftClass[];
}

/**
 * All 32 rosters as they stand today, ranked by the average career score of
 * the tracked draftees on them.
 *
 * Deliberately not a slice of the year selector: unlike the draft rankings,
 * this asks who is on the team now, so it reads every shipped class.
 */
export function RosterRankingsView({ draftClasses }: RosterRankingsViewProps) {
  const rankings = getRosterRankings(draftClasses);

  return (
    <section className="rankings-view" aria-label="Current roster rankings">
      <RosterRankingsHero rankings={rankings} />

      <div className="divider-em" />

      {hasRosterSnapshot(draftClasses) ? (
        <RosterRankingsTable rankings={rankings} />
      ) : (
        <p className="roster-view__empty mono">
          This season&rsquo;s roster snapshot has not been published yet.
        </p>
      )}

      <div className="rankings-foot">
        <div className="rankings-foot__text">
          Only players drafted {DRAFT_YEAR_BOUNDS.min}–{DRAFT_YEAR_BOUNDS.max}{' '}
          are tracked, so undrafted players and older veterans are missing —
          this is not the full 53. Players yet to take a snap are counted but
          not scored.
        </div>
      </div>
    </section>
  );
}

function RosterRankingsHero({ rankings }: { rankings: RosterRanking[] }) {
  const scored = rankings.filter((r) => r.score !== undefined);
  const leagueAvg =
    scored.length === 0
      ? undefined
      : scored.reduce((sum, r) => sum + r.score!, 0) / scored.length;
  const players = rankings.reduce((sum, r) => sum + r.players, 0);
  const best = scored[0];

  return (
    <section className="page-hero" aria-label="Current rosters">
      <div className="page-hero__grid">
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>
            Current rosters · all 32 teams
          </div>
          <h1 className="page-hero__headline">
            Whose roster is <em>stocked</em> right now.
          </h1>
          <p className="page-hero__lede">
            Every tracked draftee on a roster today, scored on the seasons he
            actually played — wherever he was drafted. A team&rsquo;s score is
            the average of those.
          </p>
        </div>

        <StatBlock
          label="Best roster"
          value={best?.teamId ?? '—'}
          sub={best ? `${best.score!.toFixed(1)} · roster score` : ''}
          href={best ? `/roster/${best.teamId}` : undefined}
          accent
        />
        <StatBlock
          label="League average"
          value={leagueAvg === undefined ? '—' : leagueAvg.toFixed(1)}
          sub="roster score"
        />
        <StatBlock
          label="Tracked draftees"
          value={String(players)}
          sub="players on all 32 rosters"
        />
      </div>
    </section>
  );
}

function RosterRankingsTable({ rankings }: { rankings: RosterRanking[] }) {
  return (
    <div className="rankings-table-wrap">
      <table className="rankings-table roster-board">
        <colgroup>
          <col className="roster-board__col-rank" />
          <col />
          <col className="roster-board__col-score" />
          <col className="roster-board__col-players" />
        </colgroup>
        <RosterRankingsHead />
        <tbody>
          {rankings.map((r) => (
            <RosterRankRow key={r.teamId} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RosterRankingsHead() {
  return (
    <thead>
      <tr>
        <th>Rank</th>
        <th>Team</th>
        <th className="right">Roster score</th>
        <th className="right">Players</th>
      </tr>
    </thead>
  );
}

function RosterRankRow({ r }: { r: RosterRanking }) {
  return (
    <tr>
      <td>
        <span
          className={`rank-num ${r.rank <= 3 ? 'rank-num--top' : 'rank-num--rest'}`}
        >
          {r.rank}
        </span>
      </td>
      <td>
        <TeamCell r={r} />
      </td>
      <td className="right">
        <span className="score-big">
          {r.score === undefined ? '—' : r.score.toFixed(1)}
        </span>
      </td>
      <td className="right">
        <span className="mono tnum">{r.players}</span>
      </td>
    </tr>
  );
}

/** Team badge and name, linking through to that team's own roster page. */
function TeamCell({ r }: { r: RosterRanking }) {
  return (
    <div className="team-row">
      <div
        className="team-row__bar"
        style={{ background: teamColor(r.teamId), width: 5 }}
      />
      <TeamLogo teamId={r.teamId} size={30} ring={false} />
      <Link className="team-row__link" to={`/roster/${r.teamId}`}>
        <div className="team-row__id">{r.teamId}</div>
        <div className="team-row__name">{r.teamName}</div>
      </Link>
    </div>
  );
}
