import { describe, it, expect } from 'vitest';
import type { Season } from '../types';
import {
  isReconstructibleSeason,
  trimReconstructibleSeasons,
  hydrateReconstructibleSeasons,
  hydrateAcquisitionSeasons,
  type TeamGamesBySeason,
} from './trailingSeasons';

/** A year the player was out of the league: the shape this module elides. */
function gone(year: number, teamGames: number): Season {
  return {
    year,
    gamesPlayed: 0,
    teamGames,
    snapShare: 0,
    cumulativeSnapShare: 0,
    retained: false,
  };
}

function played(year: number, over: Partial<Season> = {}): Season {
  return {
    year,
    gamesPlayed: 12,
    teamGames: 16,
    snapShare: 0.5,
    cumulativeSnapShare: 0.4,
    retained: true,
    ...over,
  };
}

const teamGames: TeamGamesBySeason = {
  2016: { max: 19, byTeam: { CLE: 16, BAL: 17 } },
  2017: { max: 19, byTeam: { CLE: 16, BAL: 17 } },
  2018: { max: 19, byTeam: { CLE: 16 } },
};

describe('isReconstructibleSeason', () => {
  it('accepts an out-of-league year', () => {
    expect(isReconstructibleSeason(gone(2018, 16))).toBe(true);
  });

  it('accepts one written without the optional cumulativeSnapShare', () => {
    const sparse = gone(2018, 16);
    delete sparse.cumulativeSnapShare;
    expect(isReconstructibleSeason(sparse)).toBe(true);
  });

  it('rejects a season the player was rostered for', () => {
    // Ray Agnew 2015: on Cleveland all year, never took a snap. A real
    // retention, and the only thing distinguishing it is `retained`.
    expect(isReconstructibleSeason(gone(2015, 16))).toBe(true);
    expect(isReconstructibleSeason({ ...gone(2015, 16), retained: true })).toBe(
      false,
    );
  });

  it('rejects a season spent on injured reserve', () => {
    // Alex Lewis 2021: zero games, but a real NFL season, and `reserveWeeks`
    // is information no lookup can put back.
    expect(
      isReconstructibleSeason({ ...gone(2021, 17), reserveWeeks: 17 }),
    ).toBe(false);
  });

  it('rejects a season carrying any other signal', () => {
    for (const extra of [
      { currentTeam: 'NYJ' },
      { injuryReportWeeks: 3 },
      { excusedGames: 2 },
      { seasonEndingAbsenceGames: 4 },
      { loadDenominator: 900 },
    ]) {
      expect(isReconstructibleSeason({ ...gone(2018, 16), ...extra })).toBe(
        false,
      );
    }
  });

  it('rejects an unplayed offseason row', () => {
    // teamGames 0 marks a season that has not happened — it carries where the
    // player stands, not how he did. See src/lib/seasonPlayed.ts.
    expect(isReconstructibleSeason(gone(2026, 0))).toBe(false);
  });

  it('rejects a season with snaps or games', () => {
    expect(isReconstructibleSeason({ ...gone(2018, 16), gamesPlayed: 1 })).toBe(
      false,
    );
    expect(
      isReconstructibleSeason({ ...gone(2018, 16), snapShare: 0.01 }),
    ).toBe(false);
    expect(
      isReconstructibleSeason({ ...gone(2018, 16), cumulativeSnapShare: 0.01 }),
    ).toBe(false);
  });
});

describe('trimReconstructibleSeasons', () => {
  it('drops the out-of-league suffix', () => {
    const seasons = [played(2014), gone(2015, 16), gone(2016, 16)];
    expect(trimReconstructibleSeasons(seasons)).toEqual([played(2014)]);
  });

  it('keeps out-of-league years that are followed by football', () => {
    // A comeback: 2016 has to survive, because hydration only ever refills a
    // suffix and would otherwise leave a hole in the career.
    const seasons = [played(2014), gone(2015, 16), played(2016)];
    expect(trimReconstructibleSeasons(seasons)).toEqual(seasons);
  });

  it('keeps a trailing offseason row and trims the run before it', () => {
    const offseason = gone(2026, 0);
    const seasons = [played(2014), gone(2015, 16), gone(2016, 16), offseason];
    expect(trimReconstructibleSeasons(seasons)).toEqual([
      played(2014),
      offseason,
    ]);
  });

  it('trims a career that was never played to nothing', () => {
    expect(
      trimReconstructibleSeasons([gone(2015, 16), gone(2016, 16)]),
    ).toEqual([]);
  });

  it('leaves a fully played career alone', () => {
    const seasons = [played(2014), played(2015)];
    expect(trimReconstructibleSeasons(seasons)).toEqual(seasons);
  });

  it('does not mutate its input', () => {
    const seasons = [played(2014), gone(2015, 16)];
    const before = structuredClone(seasons);
    trimReconstructibleSeasons(seasons);
    expect(seasons).toEqual(before);
  });
});

describe('hydrateReconstructibleSeasons', () => {
  const opts = { teamId: 'CLE', fromSeason: 2014, throughSeason: 2018 };

  it('refills the suffix through the newest played season', () => {
    expect(
      hydrateReconstructibleSeasons([played(2016)], { ...opts, teamGames }),
    ).toEqual([played(2016), gone(2017, 16), gone(2018, 16)]);
  });

  it('round-trips a trimmed career back to what was stored', () => {
    const seasons = [played(2016), gone(2017, 16), gone(2018, 16)];
    expect(
      hydrateReconstructibleSeasons(trimReconstructibleSeasons(seasons), {
        ...opts,
        teamGames,
      }),
    ).toEqual(seasons);
  });

  it('round-trips a career that was never played, from fromSeason', () => {
    const seasons = [gone(2016, 16), gone(2017, 16), gone(2018, 16)];
    expect(
      hydrateReconstructibleSeasons(trimReconstructibleSeasons(seasons), {
        ...opts,
        fromSeason: 2016,
        teamGames,
      }),
    ).toEqual(seasons);
  });

  it('refills before a trailing offseason row, not after it', () => {
    const offseason = gone(2026, 0);
    expect(
      hydrateReconstructibleSeasons([played(2016), offseason], {
        ...opts,
        teamGames,
      }),
    ).toEqual([played(2016), gone(2017, 16), gone(2018, 16), offseason]);
  });

  it("uses the franchise's own game count, not the league's", () => {
    // BAL played 17 games in 2017, CLE 16. The refilled row is displayed
    // ("0 of 17 games" in ScoreBreakdown), so it has to be the right one.
    const [row] = hydrateReconstructibleSeasons([], {
      teamId: 'BAL',
      fromSeason: 2017,
      throughSeason: 2017,
      teamGames,
    });
    expect(row.teamGames).toBe(17);
  });

  it('falls back to the season league maximum for an unknown franchise', () => {
    // Mirrors resolveTeamGamesDenominator's last resort in update-data.ts.
    const [row] = hydrateReconstructibleSeasons([], {
      teamId: 'BAL',
      fromSeason: 2018,
      throughSeason: 2018,
      teamGames,
    });
    expect(row.teamGames).toBe(19);
  });

  it('adds nothing when the career already reaches the newest season', () => {
    const seasons = [played(2018)];
    expect(
      hydrateReconstructibleSeasons(seasons, { ...opts, teamGames }),
    ).toEqual(seasons);
  });

  it('adds nothing for a season it has no game count for', () => {
    // Refusing to invent a denominator beats fabricating one: a missing season
    // means the lookup is stale, and a silently wrong teamGames would show up
    // as a wrong availability share rather than as a failure.
    expect(
      hydrateReconstructibleSeasons([played(2016)], {
        ...opts,
        throughSeason: 2019,
        teamGames,
      }),
    ).toEqual([played(2016), gone(2017, 16), gone(2018, 16)]);
  });

  it('does not mutate its input', () => {
    const seasons = [played(2016)];
    const before = structuredClone(seasons);
    hydrateReconstructibleSeasons(seasons, { ...opts, teamGames });
    expect(seasons).toEqual(before);
  });
});

describe('hydrateAcquisitionSeasons', () => {
  it('leaves a class alone when it states no horizon', () => {
    // A hand-built fixture, or a file from a deploy predating the trim. Filling
    // to LATEST_SEASON instead would silently extend every short career.
    const seasons = [played(2016)];
    expect(hydrateAcquisitionSeasons(seasons, 'CLE', 2016, undefined)).toEqual(
      seasons,
    );
  });

  it('refills up to the horizon the class states', () => {
    const refilled = hydrateAcquisitionSeasons(
      [played(2016)],
      'CLE',
      2016,
      2018,
    );
    expect(refilled.map((s) => s.year)).toEqual([2016, 2017, 2018]);
    expect(refilled.slice(1).every(isReconstructibleSeason)).toBe(true);
  });
});
