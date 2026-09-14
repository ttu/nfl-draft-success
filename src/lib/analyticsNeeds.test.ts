import { describe, it, expect } from 'vitest';
import { ActiveView } from '../types';
import { getAnalyticsNeeds } from './analyticsNeeds';

const needsFor = (
  activeView: ActiveView,
  isPlayerView = false,
  showFreeAgents = false,
) => getAnalyticsNeeds({ activeView, isPlayerView, showFreeAgents });

describe('getAnalyticsNeeds', () => {
  it('asks for the rankings table and its league context on the landing view', () => {
    expect(needsFor(ActiveView.TeamRankings)).toEqual({
      rollingDraftScore: false,
      teamRank: true,
      leagueContext: true,
      leagueHighlights: false,
      rosterByDraftYear: false,
      freeAgentClasses: false,
    });
  });

  it('asks for the team aggregates on the team detail view', () => {
    expect(needsFor(ActiveView.TeamDetail)).toEqual({
      rollingDraftScore: true,
      teamRank: true,
      leagueContext: false,
      leagueHighlights: false,
      rosterByDraftYear: true,
      // Undrafted players are opt-in, so their classes are not fetched until
      // the roster toggle asks for them.
      freeAgentClasses: false,
    });
  });

  it('fetches the free-agent classes for the team view once the toggle is on', () => {
    expect(needsFor(ActiveView.TeamDetail, false, true).freeAgentClasses).toBe(
      true,
    );
  });

  it('fetches them for a player route whatever the roster toggle says', () => {
    // A link to an undrafted player has to resolve on its own terms.
    expect(needsFor(ActiveView.TeamRankings, true).freeAgentClasses).toBe(true);
  });

  it('asks for highlights and the undrafted classes it ranks', () => {
    expect(needsFor(ActiveView.Highlights)).toEqual({
      rollingDraftScore: false,
      teamRank: false,
      leagueContext: false,
      leagueHighlights: true,
      rosterByDraftYear: false,
      // Unlike the team roster's opt-in list, this band always renders, so the
      // classes are needed whatever the roster toggle says.
      freeAgentClasses: true,
    });
  });

  it('asks only for the free-agent classes on the draft-year view, which lists them', () => {
    expect(needsFor(ActiveView.DraftYears)).toEqual({
      rollingDraftScore: false,
      teamRank: false,
      leagueContext: false,
      leagueHighlights: false,
      rosterByDraftYear: false,
      freeAgentClasses: true,
    });
  });

  it.each([ActiveView.Position, ActiveView.Roster, ActiveView.RosterRankings])(
    'asks for nothing on the %s view, which renders from the draft classes directly',
    (activeView) => {
      expect(needsFor(activeView)).toEqual({
        rollingDraftScore: false,
        teamRank: false,
        leagueContext: false,
        leagueHighlights: false,
        rosterByDraftYear: false,
        freeAgentClasses: false,
      });
    },
  );

  it('asks only for the free-agent classes on a player view, whose lookup resolves them', () => {
    expect(needsFor(ActiveView.TeamRankings, true)).toEqual({
      rollingDraftScore: false,
      teamRank: false,
      leagueContext: false,
      leagueHighlights: false,
      rosterByDraftYear: false,
      freeAgentClasses: true,
    });
  });
});
