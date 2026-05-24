import { describe, it, expect } from 'vitest';
import type { DraftPick, Season } from '../types';
import {
  getLatestSeason,
  isDeparted,
  getCurrentTeam,
  getSeasonTeamAbbreviation,
  isFreeAgentSeason,
  getTeamJourney,
  getJourneyAfterDraft,
  collapseTrailingFaRun,
} from './playerJourney';

function season(year: number, opts: Partial<Season> = {}): Season {
  return {
    year,
    gamesPlayed: 16,
    teamGames: 17,
    snapShare: 0.7,
    retained: true,
    ...opts,
  };
}

function pick(
  seasons: Season[],
  overrides: Partial<DraftPick> = {},
): DraftPick {
  return {
    playerId: 'p1',
    playerName: 'Test Player',
    position: 'WR',
    round: 1,
    overallPick: 1,
    teamId: 'KC',
    seasons,
    ...overrides,
  };
}

describe('getLatestSeason', () => {
  it('returns the season with the highest year', () => {
    const p = pick([season(2020), season(2023), season(2021)]);
    expect(getLatestSeason(p)?.year).toBe(2023);
  });

  it('returns undefined when there are no seasons', () => {
    expect(getLatestSeason(pick([]))).toBeUndefined();
  });
});

describe('isDeparted / getCurrentTeam', () => {
  it('is departed when latest season has retained=false', () => {
    const p = pick([
      season(2022),
      season(2023, { retained: false, currentTeam: 'NYJ' }),
    ]);
    expect(isDeparted(p)).toBe(true);
    expect(getCurrentTeam(p)).toBe('NYJ');
  });

  it('is not departed when latest season has retained=true', () => {
    const p = pick([season(2023)]);
    expect(isDeparted(p)).toBe(false);
    expect(getCurrentTeam(p)).toBeUndefined();
  });
});

describe('getSeasonTeamAbbreviation / isFreeAgentSeason', () => {
  it('returns drafting team for retained seasons', () => {
    const p = pick([season(2023)]);
    expect(getSeasonTeamAbbreviation(p.seasons[0], p)).toBe('KC');
    expect(isFreeAgentSeason(p.seasons[0], p)).toBe(false);
  });

  it('returns currentTeam for non-retained seasons', () => {
    const p = pick([season(2023, { retained: false, currentTeam: 'BUF' })]);
    expect(getSeasonTeamAbbreviation(p.seasons[0], p)).toBe('BUF');
    expect(isFreeAgentSeason(p.seasons[0], p)).toBe(false);
  });

  it('returns "FA" for non-retained seasons without a currentTeam', () => {
    const p = pick([season(2023, { retained: false })]);
    expect(getSeasonTeamAbbreviation(p.seasons[0], p)).toBe('FA');
    expect(isFreeAgentSeason(p.seasons[0], p)).toBe(true);
  });
});

describe('getTeamJourney', () => {
  it('returns empty for no seasons', () => {
    expect(getTeamJourney(pick([]))).toEqual([]);
  });

  it('groups consecutive same-team seasons into stints', () => {
    const p = pick([
      season(2020),
      season(2021),
      season(2022, { retained: false, currentTeam: 'NYJ' }),
      season(2023, { retained: false, currentTeam: 'NYJ' }),
    ]);
    const j = getTeamJourney(p);
    expect(j.map((s) => s.team)).toEqual(['KC', 'NYJ']);
  });

  it('uses the best role across each stint', () => {
    const p = pick([
      season(2020, { snapShare: 0.05, gamesPlayed: 1, teamGames: 17 }), // non_contributor
      season(2021, { snapShare: 0.8, gamesPlayed: 16, teamGames: 17 }), // core_starter
    ]);
    expect(getTeamJourney(p)[0].role).toBe('core_starter');
  });
});

describe('getJourneyAfterDraft', () => {
  it('returns [] for empty seasons', () => {
    expect(getJourneyAfterDraft(pick([]))).toEqual([]);
  });

  it('returns the tail beyond the drafting-team stint', () => {
    const p = pick([
      season(2022),
      season(2023, { retained: false, currentTeam: 'NYJ' }),
    ]);
    expect(getJourneyAfterDraft(p).map((s) => s.team)).toEqual(['NYJ']);
  });

  it('returns a placeholder FA stint if the player has only been on the drafting team', () => {
    const p = pick([season(2022), season(2023)]);
    expect(getJourneyAfterDraft(p)).toEqual([
      { team: 'FA', role: 'non_contributor' },
    ]);
  });
});

describe('collapseTrailingFaRun', () => {
  const fa = (s: string) => s === 'FA';
  it('returns input unchanged when length < 2', () => {
    expect(collapseTrailingFaRun([], fa)).toEqual([]);
    expect(collapseTrailingFaRun(['FA'], fa)).toEqual(['FA']);
  });
  it('keeps a single trailing FA item as-is', () => {
    expect(collapseTrailingFaRun(['KC', 'FA'], fa)).toEqual(['KC', 'FA']);
  });
  it('collapses 2+ trailing FA items to one', () => {
    expect(collapseTrailingFaRun(['KC', 'FA', 'FA', 'FA'], fa)).toEqual([
      'KC',
      'FA',
    ]);
  });
  it('does not collapse FA items that are not at the end', () => {
    expect(collapseTrailingFaRun(['FA', 'KC'], fa)).toEqual(['FA', 'KC']);
  });
});
