import { TEAM_COLORS, getTeamLogoUrl } from '../data/teamColors';

const DEPARTED_FA_ACCENT = '#6b7280';

/**
 * PFR career-page URL for a draft pick. Returns `null` for placeholder/unknown
 * IDs that nflverse has not matched yet.
 */
export function getPfrUrl(playerId: string, playerName: string): string | null {
  if (!playerId || playerId.startsWith('unknown-')) return null;
  const last = playerName.split(/\s+/).pop() || '';
  const letter = (last[0] || 'X').toUpperCase();
  return `https://www.pro-football-reference.com/players/${letter}/${playerId}.htm`;
}

interface DisplayContext {
  /** Accent of the (drafting/branding) team chosen by the parent list. */
  accentColor: string;
  /** Logo of the (drafting/branding) team chosen by the parent list. */
  logoUrl: string;
  /** True when the player has departed their drafting team. */
  departed: boolean;
  /** Current team abbreviation when departed; undefined when retained or FA. */
  currentTeam: string | undefined;
  /** Year-draft board mode: never swap to current-team branding. */
  yearDraftBoard: boolean;
}

/**
 * Accent stripe colour for a player card. In `yearDraftBoard` mode always uses
 * the drafting team's accent. For team views, departed players adopt their
 * current team's colour, or a neutral grey if they're a free agent.
 */
export function getPlayerDisplayAccent({
  accentColor,
  departed,
  currentTeam,
  yearDraftBoard,
}: DisplayContext): string {
  if (yearDraftBoard) return accentColor;
  const isFa = departed && !currentTeam;
  if (isFa) return DEPARTED_FA_ACCENT;
  if (departed && currentTeam) return TEAM_COLORS[currentTeam] ?? accentColor;
  return accentColor;
}

/**
 * Logo URL for a player card. In `yearDraftBoard` mode always uses the
 * drafting team's logo. For team views, departed players show their current
 * team's logo; free agents show no logo (empty string).
 */
export function getPlayerDisplayLogo({
  logoUrl,
  departed,
  currentTeam,
  yearDraftBoard,
}: DisplayContext): string {
  if (yearDraftBoard) return logoUrl;
  const isFa = departed && !currentTeam;
  if (isFa) return '';
  if (departed && currentTeam) return getTeamLogoUrl(currentTeam);
  return logoUrl;
}
