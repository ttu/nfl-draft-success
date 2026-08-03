import { describe, it, expect } from 'vitest';
import type { DraftPick, Season } from '../types';
import { makePick, makeSeason } from '../test/factories';
import {
  getLatestSeason,
  isDeparted,
  getCurrentTeam,
  getCurrentTeamIndicator,
  getSeasonTeamAbbreviation,
  isFreeAgentSeason,
  getTeamJourney,
  getJourneyAfterDraft,
  splitTrailingFaRun,
} from './playerJourney';

const season = (year: number, opts: Partial<Season> = {}): Season =>
  makeSeason({ year, snapShare: 0.7, ...opts });

const pick = (
  seasons: Season[],
  overrides: Partial<DraftPick> = {},
): DraftPick =>
  makePick({
    playerName: 'Test Player',
    position: 'WR',
    seasons,
    ...overrides,
  });

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

  describe('with a row for a season not yet played', () => {
    /** Standing for an upcoming season: no games, so `teamGames` is 0. */
    const upcoming = (retained: boolean, currentTeam?: string): Season =>
      makeSeason({
        year: 2026,
        gamesPlayed: 0,
        teamGames: 0,
        snapShare: 0,
        retained,
        ...(currentTeam ? { currentTeam } : {}),
      });

    it('is departed to the new team before that season is played', () => {
      const p = pick([season(2025), upcoming(false, 'MIN')], {
        teamId: 'ARI',
      });
      expect(isDeparted(p)).toBe(true);
      expect(getCurrentTeam(p)).toBe('MIN');
      expect(getCurrentTeamIndicator(p)).toBe('MIN');
    });

    it('is not departed when the drafting team still rosters him', () => {
      const p = pick([season(2025), upcoming(true)], { teamId: 'KC' });
      expect(isDeparted(p)).toBe(false);
      expect(getCurrentTeam(p)).toBeUndefined();
    });

    it('reads as a free agent when no team rosters him', () => {
      const p = pick([season(2025), upcoming(false)], { teamId: 'KC' });
      expect(getCurrentTeamIndicator(p)).toBe('FA');
    });
  });
});

describe('getCurrentTeamIndicator', () => {
  it('returns null when the player is still with the drafting team', () => {
    expect(getCurrentTeamIndicator(pick([season(2023)]))).toBeNull();
  });

  it('returns the current team when departed to a new team', () => {
    const p = pick([
      season(2022),
      season(2023, { retained: false, currentTeam: 'ATL' }),
    ]);
    expect(getCurrentTeamIndicator(p)).toBe('ATL');
  });

  it('returns "FA" when departed without a current team', () => {
    const p = pick([season(2023, { retained: false })]);
    expect(getCurrentTeamIndicator(p)).toBe('FA');
  });

  it('returns null when there are no seasons', () => {
    expect(getCurrentTeamIndicator(pick([]))).toBeNull();
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

describe('splitTrailingFaRun', () => {
  const fa = (s: string) => s === 'FA';
  it('reports no run for an empty or single-item list', () => {
    expect(splitTrailingFaRun([], fa)).toEqual({ before: [], run: [] });
    expect(splitTrailingFaRun(['FA'], fa)).toEqual({
      before: ['FA'],
      run: [],
    });
  });
  it('leaves a lone trailing FA item in place', () => {
    expect(splitTrailingFaRun(['KC', 'FA'], fa)).toEqual({
      before: ['KC', 'FA'],
      run: [],
    });
  });
  it('splits off a trailing run of 2+ FA items', () => {
    expect(splitTrailingFaRun(['KC', 'FA', 'FA', 'FA'], fa)).toEqual({
      before: ['KC'],
      run: ['FA', 'FA', 'FA'],
    });
  });
  it('ignores FA items that are not at the end', () => {
    expect(splitTrailingFaRun(['FA', 'FA', 'KC'], fa)).toEqual({
      before: ['FA', 'FA', 'KC'],
      run: [],
    });
  });
  it('splits a list that is nothing but FA items', () => {
    expect(splitTrailingFaRun(['FA', 'FA'], fa)).toEqual({
      before: [],
      run: ['FA', 'FA'],
    });
  });
});
