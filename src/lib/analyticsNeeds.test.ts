import { describe, it, expect } from 'vitest';
import { ActiveView } from '../types';
import { getAnalyticsNeeds } from './analyticsNeeds';

const needsFor = (activeView: ActiveView, isPlayerView = false) =>
  getAnalyticsNeeds({ activeView, isPlayerView });

describe('getAnalyticsNeeds', () => {
  it('asks for the rankings table and its league context on the landing view', () => {
    expect(needsFor(ActiveView.TeamRankings)).toEqual({
      rollingDraftScore: false,
      teamRank: true,
      leagueContext: true,
      leagueHighlights: false,
      rosterByDraftYear: false,
    });
  });

  it('asks for the team aggregates on the team detail view', () => {
    expect(needsFor(ActiveView.TeamDetail)).toEqual({
      rollingDraftScore: true,
      // The detail view shows the team's league rank alongside its score.
      teamRank: true,
      leagueContext: false,
      leagueHighlights: false,
      rosterByDraftYear: true,
    });
  });

  it('asks only for highlights on the highlights view', () => {
    expect(needsFor(ActiveView.Highlights)).toEqual({
      rollingDraftScore: false,
      teamRank: false,
      leagueContext: false,
      leagueHighlights: true,
      rosterByDraftYear: false,
    });
  });

  it.each([ActiveView.DraftYears, ActiveView.Position])(
    'asks for nothing on the %s view, which renders from the draft classes directly',
    (activeView) => {
      expect(needsFor(activeView)).toEqual({
        rollingDraftScore: false,
        teamRank: false,
        leagueContext: false,
        leagueHighlights: false,
        rosterByDraftYear: false,
      });
    },
  );

  it('asks for nothing on a player view, which takes precedence over activeView', () => {
    // `/player/:id` resolves to the TeamRankings activeView, but the player
    // view is rendered instead and uses none of the league aggregates.
    expect(needsFor(ActiveView.TeamRankings, true)).toEqual({
      rollingDraftScore: false,
      teamRank: false,
      leagueContext: false,
      leagueHighlights: false,
      rosterByDraftYear: false,
    });
  });
});
