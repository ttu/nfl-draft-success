import type { FreeAgent, FreeAgentClass, Team } from '../types';
import { getPlayerDraftScore, pickHasSeasonSnapData } from './getPlayerRole';
import type { GetPlayerRoleOptions } from './getPlayerRole';
import { expectedScoreForFreeAgent } from './overSlot';
import { HIGHLIGHT_LIST_MAX } from './getLeagueHighlights';

/** One undrafted player in a highlight list. */
export interface FreeAgentHighlight {
  player: FreeAgent;
  team: Team | undefined;
  /** The season he debuted, which is the class he belongs to. */
  draftYear: number;
  /** 0–100 score; this is what the list is ranked on. */
  score: number;
  /**
   * Score above what undrafted players average. Carried for display only —
   * see {@link getFreeAgentHighlights} for why it cannot drive the ranking.
   */
  overSlot: number;
}

export interface FreeAgentHighlights {
  /** The undrafted players who scored highest, best first. */
  bestUndrafted: FreeAgentHighlight[];
}

/**
 * The window's best undrafted players.
 *
 * Deliberately separate from {@link getLeagueHighlights}, which stays
 * picks-only: the two populations are scored against different expectations
 * and nothing here may reach the draft aggregates.
 *
 * **Ranked on raw score, not over slot** — the opposite of steals and busts.
 * A pick's over slot varies with where he was taken, so it reorders picks
 * meaningfully; a free agent's is his score minus one constant for everybody,
 * so ranking by it would produce the identical order while implying a
 * comparison the number does not make. The residual is carried on each row for
 * context and the UI labels it as measured against the undrafted cohort.
 */
export function getFreeAgentHighlights(
  freeAgentClasses: FreeAgentClass[],
  teams: readonly Team[],
  options?: GetPlayerRoleOptions,
): FreeAgentHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const expected = expectedScoreForFreeAgent();

  const candidates: FreeAgentHighlight[] = [];
  for (const cls of freeAgentClasses) {
    for (const player of cls.freeAgents) {
      if (!pickHasSeasonSnapData(player)) continue;
      const score = getPlayerDraftScore(player, options);
      candidates.push({
        player,
        team: teamById.get(player.teamId),
        draftYear: cls.year,
        score,
        overSlot: score - expected,
      });
    }
  }

  return {
    bestUndrafted: candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, HIGHLIGHT_LIST_MAX),
  };
}
