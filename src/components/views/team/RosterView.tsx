import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { DraftClass } from '../../../types';
import { TEAMS } from '../../../data/teams';
import { DRAFT_YEAR_BOUNDS } from '../../../lib/draftYearBounds';
import {
  getCurrentRoster,
  groupRosterByPosition,
  hasRosterSnapshot,
  rosterMeanScore,
  type RosterEntry,
} from '../../../lib/currentRoster';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import { cx } from '../../../lib/cx';
import {
  PlayerAvatar,
  RoleChip,
  TeamLogo,
  scoreTierClass,
  teamColor,
  teamFg,
} from '../../design/Primitives';

interface RosterViewProps {
  teamId: string;
  /** All shipped classes — the roster is not a year-range question. */
  draftClasses: DraftClass[];
}

/** Where the pick came from: draft year, round, and the team that drafted him. */
function originLabel(entry: RosterEntry): string {
  const base = `${entry.draftYear} · R${entry.pick.round}`;
  return entry.acquired ? `${base} · from ${entry.pick.teamId}` : base;
}

/** Role badge, or the awaiting-data note for a player yet to play. */
function RoleMarker({ entry }: { entry: RosterEntry }) {
  if (entry.role) return <RoleChip role={entry.role} />;
  return <span className="mono roster-table__awaiting">Awaiting data</span>;
}

/** Score cell text: a rounded score, or an em dash for a player yet to play. */
function scoreLabel(entry: RosterEntry): string {
  return entry.score === undefined ? '—' : String(Math.round(entry.score));
}

export function RosterView({ teamId, draftClasses }: RosterViewProps) {
  const location = useLocation();
  const origin = location.pathname + location.search;
  const team = TEAMS.find((t) => t.id === teamId);
  const color = teamColor(teamId);
  const entries = getCurrentRoster(draftClasses, teamId);
  const groups = groupRosterByPosition(entries);
  const mean = rosterMeanScore(entries);
  const snapshotPublished = hasRosterSnapshot(draftClasses);

  return (
    <section
      className="roster-view"
      style={
        {
          ['--team' as never]: color,
          ['--team-fg' as never]: teamFg(color),
        } as CSSProperties
      }
    >
      <header className="roster-view__head">
        <div className="roster-view__title-row">
          <TeamLogo teamId={teamId} size={36} ring={false} />
          <h2 className="roster-view__title">
            {team?.name ?? teamId} · Current roster
          </h2>
        </div>
        <div className="roster-view__stats">
          <span className="mono tnum">{entries.length} tracked players</span>
          <span className="mono tnum">
            Average score {mean === undefined ? '—' : Math.round(mean)}
          </span>
        </div>
        <p className="roster-view__caveat">
          Players drafted {DRAFT_YEAR_BOUNDS.min}–{DRAFT_YEAR_BOUNDS.max} who
          are on the roster now, wherever they were drafted. Undrafted players
          and older veterans are not tracked, so this is not the full 53.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="roster-view__empty mono">
          {snapshotPublished
            ? 'No tracked draftees on this roster.'
            : "This season's roster snapshot has not been published yet."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="roster-group">
            <h3 className="roster-group__title">{group.label}</h3>
            <div className="roster-group__meta mono tnum">
              {group.entries.length}{' '}
              {group.entries.length === 1 ? 'player' : 'players'} · avg{' '}
              {group.meanScore === undefined
                ? '—'
                : Math.round(group.meanScore)}
            </div>
            <table className="roster-table">
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.pick.playerId}>
                    <td style={{ width: 40 }}>
                      <PlayerAvatar
                        teamId={teamId}
                        name={entry.pick.playerName}
                        src={entry.pick.headshotUrl}
                        size={28}
                      />
                    </td>
                    <td style={{ width: 36 }}>
                      <span className="pos-chip">{entry.pick.position}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <Link
                        className="player-row__link"
                        to={buildPlayerHref(entry.pick.playerId, origin)}
                      >
                        {entry.pick.playerName}
                      </Link>
                      {/* The origin, seasons and role columns collapse on a
                          narrow screen, where seven columns leave the name a
                          sliver. These two lines carry their content instead,
                          so nothing a desktop row states goes missing on a
                          phone. */}
                      <span className="mono roster-row__meta">
                        {originLabel(entry)} · {entry.seasonsPlayed} yr
                      </span>
                      <span className="roster-row__role">
                        <RoleMarker entry={entry} />
                      </span>
                    </td>
                    <td className="mono roster-table__origin">
                      {originLabel(entry)}
                    </td>
                    <td className="mono tnum roster-table__seasons">
                      {entry.seasonsPlayed} yr
                    </td>
                    <td
                      className={cx(
                        'roster-table__score',
                        entry.score === undefined
                          ? undefined
                          : scoreTierClass(Math.round(entry.score), {
                              high: 'roster-table__score--top',
                              low: 'roster-table__score--low',
                            }),
                      )}
                    >
                      {scoreLabel(entry)}
                    </td>
                    <td className="roster-table__role">
                      <RoleMarker entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </section>
  );
}
