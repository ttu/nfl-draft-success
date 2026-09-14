import { ActiveView } from '../types';

/**
 * Which of the derived draft aggregates a render actually consumes.
 *
 * Each aggregate is a whole-league pass over every loaded pick, so computing one
 * the current view never reads is pure waste — on the highlights view the team
 * rankings and league context together cost more than the highlights themselves.
 */
export interface AnalyticsNeeds {
  rollingDraftScore: boolean;
  teamRank: boolean;
  leagueContext: boolean;
  leagueHighlights: boolean;
  rosterByDraftYear: boolean;
  /**
   * Not an aggregate but a *fetch*: whether this render reads the undrafted
   * free-agent classes at all. On the default range they are ~926 KB against
   * 1.71 MB of draft data, and the landing page, rankings, highlights and
   * position views show no free agent, so paying for them there is pure waste.
   */
  freeAgentClasses: boolean;
}

const NONE: AnalyticsNeeds = {
  rollingDraftScore: false,
  teamRank: false,
  leagueContext: false,
  leagueHighlights: false,
  rosterByDraftYear: false,
  freeAgentClasses: false,
};

/**
 * Mirrors what `renderMainContent` reads for each view. Keep the two in step:
 * an aggregate marked `false` here is `null`/`undefined` at render time, and a
 * view that reads it anyway silently loses content.
 */
export function getAnalyticsNeeds({
  activeView,
  isPlayerView,
  showFreeAgents = false,
}: {
  activeView: ActiveView;
  isPlayerView: boolean;
  /**
   * The team roster's opt-in undrafted toggle. The team view is the one place
   * whose need for free-agent classes is conditional: with the toggle off it
   * renders none of them, so fetching a megabyte of class JSON for it would be
   * pure waste. The player view needs them regardless — a link to an undrafted
   * player must resolve whether or not a roster toggle happens to be on.
   */
  showFreeAgents?: boolean;
}): AnalyticsNeeds {
  // The player view is rendered ahead of `activeView` and reads none of the
  // aggregates — but its lookup resolves undrafted players too, so it does
  // need the free-agent classes.
  if (isPlayerView) return { ...NONE, freeAgentClasses: true };

  switch (activeView) {
    case ActiveView.TeamRankings:
      return { ...NONE, teamRank: true, leagueContext: true };
    case ActiveView.TeamDetail:
      return {
        ...NONE,
        rollingDraftScore: true,
        teamRank: true,
        rosterByDraftYear: true,
        freeAgentClasses: showFreeAgents,
      };
    // Highlights ranks the best undrafted players beside the draft lists.
    case ActiveView.Highlights:
      return { ...NONE, leagueHighlights: true, freeAgentClasses: true };
    // The draft-year view lists that year's undrafted class beside the picks.
    case ActiveView.DraftYears:
      return { ...NONE, freeAgentClasses: true };
    // Position and roster views render straight from the draft classes.
    case ActiveView.Position:
    case ActiveView.Roster:
    case ActiveView.RosterRankings:
      return NONE;
  }
}
