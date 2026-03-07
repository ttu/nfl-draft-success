import type { DraftPick, Role, Season } from '../types';
import { getPlayerRole } from '../lib/getPlayerRole';
import { TEAM_COLORS, getTeamLogoUrl } from '../data/teamColors';

function getLatestSeason(pick: DraftPick): Season | undefined {
  return [...pick.seasons].sort((a, b) => b.year - a.year)[0];
}

function isDeparted(pick: DraftPick): boolean {
  return getLatestSeason(pick)?.retained === false;
}

function getCurrentTeam(pick: DraftPick): string | undefined {
  return getLatestSeason(pick)?.currentTeam;
}

function getTeamJourney(pick: DraftPick): string[] {
  const journey: string[] = [];
  const sortedSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);
  for (const season of sortedSeasons) {
    const team = season.retained ? pick.teamId : (season.currentTeam ?? 'FA');
    if (journey[journey.length - 1] !== team) {
      journey.push(team);
    }
  }
  return journey;
}

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  core_starter: { bg: '#16a34a', text: '#fff' },
  starter_when_healthy: { bg: '#15803d', text: '#fff' },
  significant_contributor: { bg: '#0369a1', text: '#fff' },
  depth: { bg: '#a16207', text: '#fff' },
  non_contributor: { bg: '#6b7280', text: '#fff' },
};

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

function getPfrUrl(playerId: string, playerName: string): string | null {
  if (!playerId || playerId.startsWith('unknown-')) return null;
  const last = playerName.split(/\s+/).pop() || '';
  const letter = (last[0] || 'X').toUpperCase();
  return `https://www.pro-football-reference.com/players/${letter}/${playerId}.htm`;
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
        const colors = ROLE_COLORS[role];
        const pfrUrl = getPfrUrl(pick.playerId, pick.playerName);
        const departed = isDeparted(pick);
        const currentTeam = departed ? getCurrentTeam(pick) : undefined;
        const isFa = departed && !currentTeam;
        const displayAccent = isFa
          ? '#6b7280'
          : departed && currentTeam
            ? (TEAM_COLORS[currentTeam] ?? accentColor)
            : accentColor;
        const displayLogo = isFa
          ? ''
          : departed && currentTeam
            ? getTeamLogoUrl(currentTeam)
            : logoUrl;
        return (
          <li
            key={`${pick.playerId}-${draftYear}`}
            className={`player-card${departed ? ' player-card--departed' : ''}`}
            style={{ '--card-accent': displayAccent } as React.CSSProperties}
          >
            <div className="player-card__draft">RD {pick.round}</div>
            <div
              className="player-card__accent"
              style={{ backgroundColor: displayAccent }}
              aria-hidden
            >
              {displayLogo && (
                <img
                  src={displayLogo}
                  alt=""
                  className="player-card__logo"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              )}
            </div>
            <div className="player-card__avatar" aria-hidden>
              {pick.headshotUrl ? (
                <img
                  src={pick.headshotUrl.replace(
                    '/f_auto,q_auto/',
                    '/f_auto,q_auto,w_128,h_128,c_thumb,g_face/',
                  )}
                  alt=""
                  className="player-card__headshot"
                  loading="lazy"
                />
              ) : (
                getInitials(pick.playerName)
              )}
            </div>
            <div className="player-card__info">
              {pfrUrl ? (
                <a
                  href={pfrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="player-card__name player-card__name--link"
                  title="View on Pro-Football-Reference"
                >
                  {pick.playerName}
                </a>
              ) : (
                <span className="player-card__name">{pick.playerName}</span>
              )}
              <span className="player-card__meta">
                {pick.position} · Pick {pick.overallPick}
                {departed && (
                  <span className="player-card__departed-team">
                    {getTeamJourney(pick)
                      .slice(1)
                      .map((team, i) => (
                        <span key={i}>
                          {' → '}
                          {team}
                        </span>
                      ))}
                  </span>
                )}
              </span>
            </div>
            <div
              className="player-card__badge"
              title={formatRole(role)}
              style={
                {
                  '--role-bg': colors.bg,
                  '--role-text': colors.text,
                } as React.CSSProperties
              }
            >
              <span
                className="player-card__role-badge"
                data-testid="role-badge"
                data-role={role}
                aria-label={formatRole(role)}
              >
                <span className="player-card__role-badge-text">
                  {formatRole(role)}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
