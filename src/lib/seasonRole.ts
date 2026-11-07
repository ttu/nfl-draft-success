import type { Role, Season } from '../types';
import { classifyRole } from './classifyRole';
import { snapShareForRoleTier } from './snapShareForTier';

/** The role a single season classifies as, on its own. */
export function seasonRole(season: Season, position?: string): Role {
  return classifyRole(
    snapShareForRoleTier(season, position),
    season.teamGames > 0 ? season.gamesPlayed / season.teamGames : 0,
    position,
  );
}
