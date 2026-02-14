import type { DraftPick, Role } from '../types';
import { getPlayerRole } from '../lib/getPlayerRole';
import { TEAM_COLORS, getTeamLogoUrl } from '../data/teamColors';

function formatRole(role: Role): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export interface PlayerWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

export interface PlayerListProps {
  picks: PlayerWithDraftYear[];
  teamId: string;
  draftingTeamOnly?: boolean;
}

export function PlayerList({
  picks,
  teamId,
  draftingTeamOnly = false,
}: PlayerListProps) {
  const accentColor = TEAM_COLORS[teamId] ?? '#4a5568';
  const logoUrl = getTeamLogoUrl(teamId);

  return (
    <ul role="list" aria-label="Draft picks" className="player-cards">
      {picks.map(({ pick, draftYear }) => {
        const role = getPlayerRole(pick, { draftingTeamOnly });
        const isCore =
          role === 'core_starter' || role === 'starter_when_healthy';
        return (
          <li key={`${pick.playerId}-${draftYear}`} className="player-card">
            <div className="player-card__draft">
              {draftYear} RD {pick.round}
            </div>
            <div
              className="player-card__accent"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            >
              <img
                src={logoUrl}
                alt=""
                className="player-card__logo"
                loading="lazy"
              />
            </div>
            <div className="player-card__avatar" aria-hidden>
              {pick.headshotUrl ? (
                <img
                  src={pick.headshotUrl}
                  alt=""
                  className="player-card__headshot"
                  loading="lazy"
                />
              ) : (
                getInitials(pick.playerName)
              )}
            </div>
            <div className="player-card__info">
              <span className="player-card__name">{pick.playerName}</span>
              <span className="player-card__meta">
                {pick.position} · Pick {pick.overallPick}
              </span>
            </div>
            <div className="player-card__badge" title={formatRole(role)}>
              {isCore ? (
                <span className="player-card__check" aria-label="Core player">
                  ✓
                </span>
              ) : (
                <span
                  className="player-card__role"
                  data-testid="role-badge"
                  data-role={role}
                >
                  {formatRole(role)}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
