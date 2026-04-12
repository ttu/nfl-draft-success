import { useId, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { DraftPick, Role, Season } from '../types';
import { getPlayerRole } from '../lib/getPlayerRole';
import { classifyRole } from '../lib/classifyRole';
import { snapShareForRoleTier } from '../lib/snapShareForTier';
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

interface TeamStint {
  team: string;
  role: Role;
}

function getTeamJourney(pick: DraftPick): TeamStint[] {
  const sortedSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);
  const stints: { team: string; seasons: Season[] }[] = [];
  for (const season of sortedSeasons) {
    const team = season.retained ? pick.teamId : (season.currentTeam ?? 'FA');
    const last = stints[stints.length - 1];
    if (last && last.team === team) {
      last.seasons.push(season);
    } else {
      stints.push({ team, seasons: [season] });
    }
  }
  return stints.map(({ team, seasons }) => {
    let bestRole: Role = 'non_contributor';
    for (const s of seasons) {
      const gps = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
      const role = classifyRole(snapShareForRoleTier(s), gps, s.gamesPlayed);
      if (ROLE_ORDER.indexOf(role) > ROLE_ORDER.indexOf(bestRole))
        bestRole = role;
    }
    return { team, role: bestRole };
  });
}

const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

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

const ROLE_ABBREV: Record<Role, string> = {
  core_starter: 'CS',
  starter_when_healthy: 'SH',
  significant_contributor: 'SC',
  depth: 'D',
  non_contributor: 'NC',
};

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

function seasonTeamAbbrev(season: Season, pick: DraftPick): string {
  if (season.retained) return pick.teamId;
  return season.currentTeam ?? 'FA';
}

function formatSnapPct(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
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

interface PlayerCardProps {
  pick: DraftPick;
  draftYear: number;
  accentColor: string;
  logoUrl: string;
  draftingTeamOnly: boolean;
}

function PlayerCard({
  pick,
  draftYear,
  accentColor,
  logoUrl,
  draftingTeamOnly,
}: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const reactId = useId();
  const panelId = `${reactId}-career-panel`;
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

  const sortedSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);

  const toggleId = `${panelId}-toggle`;
  const careerLegendId = `${reactId}-career-legend`;
  const toggleLabel = `${pick.playerName}, ${expanded ? 'collapse' : 'expand'} career breakdown`;

  function handleMainKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    }
  }

  return (
    <li
      className={`player-card${departed ? ' player-card--departed' : ''}`}
      style={{ '--card-accent': displayAccent } as CSSProperties}
    >
      <div
        className="player-card__main"
        id={toggleId}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={toggleLabel}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={handleMainKeyDown}
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
          <span className="player-card__name">{pick.playerName}</span>
          <span className="player-card__meta">
            {pick.position} · Pick {pick.overallPick}
            {departed && (
              <span className="player-card__departed-team">
                {(getTeamJourney(pick).slice(1).length > 0
                  ? getTeamJourney(pick).slice(1)
                  : [{ team: 'FA', role: 'non_contributor' as Role }]
                ).map((stint, i) => (
                  <span key={i}>
                    {' → '}
                    {stint.team}
                    {stint.team !== 'FA' && (
                      <span
                        className="player-card__stint-role"
                        title={formatRole(stint.role)}
                        style={{
                          backgroundColor: ROLE_COLORS[stint.role].bg,
                          color: ROLE_COLORS[stint.role].text,
                        }}
                      >
                        {ROLE_ABBREV[stint.role]}
                      </span>
                    )}
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
            } as CSSProperties
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
      </div>
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={toggleId}
          className="player-card__career"
          data-testid="player-career-panel"
        >
          {pfrUrl && (
            <div className="player-card__career-actions">
              <a
                href={pfrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="player-card__stats-link"
                data-testid="player-stats-link"
              >
                Career stats on Pro Football Reference
              </a>
            </div>
          )}
          <div className="player-card__career-inner">
            <p className="player-card__career-legend" id={careerLegendId}>
              <strong>Avg snap</strong>: typical role share in games you played
              (weekly max of off/def snap %, averaged). <strong>Load</strong>:
              your season snaps vs your primary team&apos;s full-season snap
              capacity; injury-report weeks can soften the penalty for games
              missed. Role badges use this.
            </p>
            <table
              className="player-card__career-table"
              aria-describedby={careerLegendId}
            >
              <caption className="visually-hidden">
                Career breakdown for {pick.playerName}, drafted {draftYear}. Avg
                snap is average weekly role share when active; Load is season
                snap load vs full team season capacity for role classification.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Season</th>
                  <th scope="col">Team</th>
                  <th scope="col">GP</th>
                  <th
                    scope="col"
                    title="Average role share in games with at least one snap."
                  >
                    Avg snap
                  </th>
                  <th
                    scope="col"
                    title="Season load: your snaps vs your primary team’s full-season snap capacity (trades: games-played ratio). Used for role tiers."
                  >
                    Load
                  </th>
                  <th scope="col">Role</th>
                  <th scope="col">IR wks</th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasons.map((s) => {
                  const gps = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
                  const seasonRole = classifyRole(
                    snapShareForRoleTier(s),
                    gps,
                    s.gamesPlayed,
                  );
                  const rc = ROLE_COLORS[seasonRole];
                  return (
                    <tr key={s.year}>
                      <td>{s.year}</td>
                      <td>{seasonTeamAbbrev(s, pick)}</td>
                      <td>
                        {s.gamesPlayed}/{s.teamGames}
                      </td>
                      <td>{formatSnapPct(s.snapShare)}</td>
                      <td>{formatSnapPct(snapShareForRoleTier(s))}</td>
                      <td>
                        <span
                          className="player-card__career-role"
                          style={{
                            backgroundColor: rc.bg,
                            color: rc.text,
                          }}
                          title={formatRole(seasonRole)}
                        >
                          {ROLE_ABBREV[seasonRole]}
                        </span>
                      </td>
                      <td>
                        {s.injuryReportWeeks != null
                          ? s.injuryReportWeeks
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </li>
  );
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
      {picks.map(({ pick, draftYear }) => (
        <PlayerCard
          key={`${pick.playerId}-${draftYear}`}
          pick={pick}
          draftYear={draftYear}
          accentColor={accentColor}
          logoUrl={logoUrl}
          draftingTeamOnly={draftingTeamOnly}
        />
      ))}
    </ul>
  );
}
