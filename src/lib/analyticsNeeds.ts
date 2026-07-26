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
}

const NONE: AnalyticsNeeds = {
  rollingDraftScore: false,
  teamRank: false,
  leagueContext: false,
  leagueHighlights: false,
  rosterByDraftYear: false,
};

/**
 * Mirrors what `renderMainContent` reads for each view. Keep the two in step:
 * an aggregate marked `false` here is `null`/`undefined` at render time, and a
 * view that reads it anyway silently loses content.
 */
export function getAnalyticsNeeds({
  activeView,
  isPlayerView,
}: {
  activeView: ActiveView;
  isPlayerView: boolean;
}): AnalyticsNeeds {
  // The player view is rendered ahead of `activeView` and reads none of these.
  if (isPlayerView) return NONE;

  switch (activeView) {
    case ActiveView.TeamRankings:
      return { ...NONE, teamRank: true, leagueContext: true };
    case ActiveView.TeamDetail:
      return {
        ...NONE,
        rollingDraftScore: true,
        teamRank: true,
        rosterByDraftYear: true,
      };
    case ActiveView.Highlights:
      return { ...NONE, leagueHighlights: true };
    // Draft-year and position views render straight from the draft classes.
    case ActiveView.DraftYears:
    case ActiveView.Position:
      return NONE;
  }
}
