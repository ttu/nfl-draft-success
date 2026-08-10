import { describe, it, expect } from 'vitest';
import {
  activeCareerSeasons,
  getCareerShapeHighlights,
  MIN_BLOOM_SEASONS,
  MIN_IRON_MAN_STREAK,
  MIN_SNAKEBIT_GAMES,
} from './careerShapeHighlights';
import { makePick, makeSeason, makeTeam } from '../test/factories';
import type { DraftClass, DraftPick } from '../types';

const teams = [makeTeam({ id: 'A' })];

/** One draft class of 2021 picks. */
function classOf(...picks: DraftPick[]): DraftClass[] {
  return [{ year: 2021, picks }];
}

describe('getCareerShapeHighlights', () => {
  it('returns four empty lists for no draft classes', () => {
    const h = getCareerShapeHighlights([], teams);
    expect(h.dayOneStarters).toEqual([]);
    expect(h.lateBloomers).toEqual([]);
    expect(h.ironMen).toEqual([]);
    expect(h.snakebit).toEqual([]);
  });
});

describe('day-one starters', () => {
  it('ranks by rookie-year snap share', () => {
    const heavy = makePick({
      overallPick: 40,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.9 })],
    });
    const light = makePick({
      overallPick: 41,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.4 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(light, heavy),
      teams,
    );

    expect(dayOneStarters.map((r) => r.pick.overallPick)).toEqual([40, 41]);
    expect(dayOneStarters[0].headline).toBe('90%');
  });

  it('breaks a tie toward the later pick', () => {
    const early = makePick({
      overallPick: 5,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.8 })],
    });
    const late = makePick({
      overallPick: 200,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.8 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(early, late),
      teams,
    );

    expect(dayOneStarters[0].pick.overallPick).toBe(200);
  });

  it('skips a pick who did not play his rookie season', () => {
    const redshirt = makePick({
      overallPick: 60,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2022, snapShare: 0.95 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(redshirt),
      teams,
    );

    expect(dayOneStarters).toEqual([]);
  });
});

describe('late bloomers', () => {
  /** Four seasons, share given per year starting at the draft year. */
  function career(overallPick: number, shares: number[]): DraftPick {
    return makePick({
      overallPick,
      teamId: 'A',
      draftYear: 2021,
      seasons: shares.map((snapShare, i) =>
        makeSeason({ year: 2021 + i, snapShare }),
      ),
    });
  }

  it('ranks by the rise from rookie year to peak', () => {
    const big = career(10, [0.1, 0.3, 0.9, 0.9]);
    const small = career(11, [0.5, 0.6, 0.7, 0.7]);

    const { lateBloomers } = getCareerShapeHighlights(
      classOf(small, big),
      teams,
    );

    expect(lateBloomers.map((r) => r.pick.overallPick)).toEqual([10, 11]);
    expect(lateBloomers[0].headline).toBe('+80');
    expect(lateBloomers[0].detail).toBe('2 yrs full-time · 10% → 90%');
  });

  it('requires MIN_BLOOM_SEASONS played seasons', () => {
    const short = career(12, [0.1, 0.9]);

    const { lateBloomers } = getCareerShapeHighlights(classOf(short), teams);

    expect(short.seasons.length).toBeLessThan(MIN_BLOOM_SEASONS);
    expect(lateBloomers).toEqual([]);
  });

  it('treats a snapless rookie year as a real 0% baseline', () => {
    const sat = makePick({
      overallPick: 13,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 0, snapShare: 0 }),
        makeSeason({ year: 2022, snapShare: 0.5 }),
        makeSeason({ year: 2023, snapShare: 0.95 }),
        makeSeason({ year: 2024, snapShare: 0.95 }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(classOf(sat), teams);

    expect(lateBloomers[0].headline).toBe('+95');
  });

  it('skips a pick with no rookie season to rise from', () => {
    const noBaseline = makePick({
      overallPick: 14,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2022, snapShare: 0.2 }),
        makeSeason({ year: 2023, snapShare: 0.6 }),
        makeSeason({ year: 2024, snapShare: 0.95 }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(
      classOf(noBaseline),
      teams,
    );

    expect(lateBloomers).toEqual([]);
  });

  it('skips a career that never rose', () => {
    const flat = career(15, [0.9, 0.8, 0.7]);

    const { lateBloomers } = getCareerShapeHighlights(classOf(flat), teams);

    expect(lateBloomers).toEqual([]);
  });
});

describe('iron men', () => {
  function fullSeason(year: number, overrides = {}) {
    return makeSeason({ year, gamesPlayed: 17, snapShare: 0.9, ...overrides });
  }

  it('ranks by the longest run of full contributing seasons', () => {
    const durable = makePick({
      overallPick: 20,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023, 2024].map((y) => fullSeason(y)),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(durable), teams);

    expect(ironMen[0].value).toBe(4);
    expect(ironMen[0].headline).toBe('4');
    expect(ironMen[0].detail).toBe("full seasons · '21–'24");
  });

  it('requires MIN_IRON_MAN_STREAK seasons', () => {
    const brief = makePick({
      overallPick: 21,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022].map((y) => fullSeason(y)),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(brief), teams);

    expect(MIN_IRON_MAN_STREAK).toBe(3);
    expect(ironMen).toEqual([]);
  });

  it('does not count a full-time special-teamer as an iron man', () => {
    const gunner = makePick({
      overallPick: 22,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023].map((y) =>
        fullSeason(y, { snapShare: 0.12 }),
      ),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(gunner), teams);

    expect(ironMen).toEqual([]);
  });

  it('breaks the streak on a season-ending injury', () => {
    const hurt = makePick({
      overallPick: 23,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        fullSeason(2021),
        fullSeason(2022),
        makeSeason({
          year: 2023,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.9,
          seasonEndingAbsenceGames: 9,
        }),
        fullSeason(2024),
      ],
    });

    const { ironMen } = getCareerShapeHighlights(classOf(hurt), teams);

    expect(ironMen).toEqual([]);
  });

  it('breaks the streak across a gap year', () => {
    const gap = makePick({
      overallPick: 24,
      teamId: 'A',
      draftYear: 2021,
      seasons: [fullSeason(2021), fullSeason(2022), fullSeason(2024)],
    });

    const { ironMen } = getCareerShapeHighlights(classOf(gap), teams);

    expect(ironMen).toEqual([]);
  });

  it('is not broken by a rested finale', () => {
    // draftClass.ts subtracts the rest game before app code sees the season, so
    // a 16-of-16 season is what a rested 17-game year looks like here.
    const rested = makePick({
      overallPick: 25,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023].map((y) =>
        makeSeason({ year: y, gamesPlayed: 16, teamGames: 16, snapShare: 0.9 }),
      ),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(rested), teams);

    expect(ironMen[0].value).toBe(3);
  });
});

describe('snakebit', () => {
  it('ranks by games missed among full-time players', () => {
    const hurt = makePick({
      overallPick: 30,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.9,
          injuryReportWeeks: 5,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 6,
          teamGames: 17,
          snapShare: 0.9,
          seasonEndingAbsenceGames: 11,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(hurt), teams);

    expect(snakebit[0].value).toBe(20);
    expect(snakebit[0].headline).toBe('20');
    expect(snakebit[0].detail).toBe('90% when active');
  });

  it('counts a season lost mid-career without letting it sink the share mean', () => {
    // The missed year sits between two played ones. A trailing empty season
    // would mean he left the league, not that he was hurt — see
    // `activeCareerSeasons`.
    const lostYear = makePick({
      overallPick: 31,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 0,
          teamGames: 17,
          snapShare: 0,
          seasonEndingAbsenceGames: 17,
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(lostYear), teams);

    expect(snakebit[0].value).toBe(17);
    expect(snakebit[0].detail).toBe('90% when active');
  });

  it('skips a part-time player who missed games', () => {
    const rotational = makePick({
      overallPick: 32,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.3,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.3,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(rotational), teams);

    expect(snakebit).toEqual([]);
  });

  it('requires MIN_SNAKEBIT_GAMES of career evidence', () => {
    const brief = makePick({
      overallPick: 33,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 2,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 3,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(brief), teams);

    expect(MIN_SNAKEBIT_GAMES).toBe(8);
    expect(snakebit).toEqual([]);
  });

  it('skips a player who never missed a game', () => {
    const durable = makePick({
      overallPick: 34,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022].map((year) =>
        makeSeason({ year, gamesPlayed: 17, teamGames: 17, snapShare: 0.9 }),
      ),
    });

    const { snakebit } = getCareerShapeHighlights(classOf(durable), teams);

    expect(snakebit).toEqual([]);
  });
});

describe('activeCareerSeasons', () => {
  /**
   * The shape that broke these lists in production: a real rookie year, then a
   * row for every remaining season in the window because the player was out of
   * the league. The pipeline emits those rows regardless of whether he was on
   * any roster, so a season row is not evidence of a career.
   */
  function washedOut(): DraftPick {
    return makePick({
      overallPick: 237,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 10,
          teamGames: 17,
          snapShare: 0.95,
        }),
        ...[2022, 2023, 2024, 2025].map((year) =>
          makeSeason({
            year,
            gamesPlayed: 0,
            teamGames: 17,
            snapShare: 0,
            retained: false,
          }),
        ),
      ],
    });
  }

  it('stops at the last season the player actually played', () => {
    expect(activeCareerSeasons(washedOut()).map((s) => s.year)).toEqual([2021]);
  });

  it('keeps a season lost mid-career, which is the whole point', () => {
    const hurtThenBack = makePick({
      overallPick: 238,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({ year: 2022, gamesPlayed: 0, teamGames: 17, snapShare: 0 }),
        makeSeason({
          year: 2023,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    expect(activeCareerSeasons(hurtThenBack).map((s) => s.year)).toEqual([
      2021, 2022, 2023,
    ]);
  });

  it('does not count years out of the league as games missed', () => {
    const { snakebit } = getCareerShapeHighlights(classOf(washedOut()), teams);

    // 7 missed in his one real season, not 7 + four empty years (75).
    expect(snakebit.map((r) => r.value)).not.toContain(75);
  });
});

describe('late bloomer tie-breaks', () => {
  /** Rookie year with no snaps, then `peaks` seasons at full usage. */
  function bloomer(overallPick: number, peaks: number): DraftPick {
    return makePick({
      overallPick,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 0, teamGames: 17, snapShare: 0 }),
        makeSeason({
          year: 2022,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.5,
        }),
        ...Array.from({ length: peaks }, (_, i) =>
          makeSeason({
            year: 2023 + i,
            gamesPlayed: 17,
            teamGames: 17,
            snapShare: 1,
          }),
        ),
      ],
    });
  }

  it('puts the player who sustained the peak above the one-year wonder', () => {
    const sustained = bloomer(60, 4);
    const flash = bloomer(61, 2);

    const { lateBloomers } = getCareerShapeHighlights(
      classOf(flash, sustained),
      teams,
    );

    expect(lateBloomers[0].value).toBe(lateBloomers[1].value);
    expect(lateBloomers[0].pick.overallPick).toBe(60);
  });
});

describe('snakebit counts injury, not benching', () => {
  it('ignores games missed with no sign of injury', () => {
    const benched = makePick({
      overallPick: 70,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        // Lost the job. Absent, but nothing says hurt.
        makeSeason({
          year: 2022,
          gamesPlayed: 2,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(benched), teams);

    expect(snakebit).toEqual([]);
  });

  it('counts games missed in a season spent on the injury report', () => {
    const hurt = makePick({
      overallPick: 71,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 2,
          teamGames: 17,
          snapShare: 0.9,
          injuryReportWeeks: 6,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(hurt), teams);

    expect(snakebit[0].value).toBe(15);
  });
});

describe('late bloomers must stay bloomed', () => {
  /**
   * Darrick Forrest's shape: 2% as a rookie, one real starting season, a
   * five-game run at 99%, then back to 10% and out. He rose. He did not become
   * a starter.
   */
  it('skips a career that spiked and fell back', () => {
    const spike = makePick({
      overallPick: 163,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.05,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.82,
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 5,
          teamGames: 17,
          snapShare: 0.99,
        }),
        makeSeason({
          year: 2024,
          gamesPlayed: 12,
          teamGames: 17,
          snapShare: 0.1,
        }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(classOf(spike), teams);

    expect(lateBloomers).toEqual([]);
  });

  it('does not let a part-season cameo set the peak', () => {
    // Two real full-time seasons at 70%, plus four games at 99%. The peak is
    // the job he held, so the rise reads to 70% and not to 99%.
    const cameo = makePick({
      overallPick: 164,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.1,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.7,
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.7,
        }),
        makeSeason({
          year: 2024,
          gamesPlayed: 4,
          teamGames: 17,
          snapShare: 0.99,
        }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(classOf(cameo), teams);

    expect(lateBloomers[0].detail).toBe('2 yrs full-time · 10% → 70%');
  });
});

describe('day-one starters must keep the job', () => {
  /** Jonathan Mingo's shape: 90% as a rookie, 42% the year after. */
  it('skips a rookie starter who lost the job in year two', () => {
    const lostIt = makePick({
      overallPick: 39,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.42,
        }),
      ],
    });

    const { dayOneStarters } = getCareerShapeHighlights(classOf(lostIt), teams);

    expect(dayOneStarters).toEqual([]);
  });

  it('keeps a rookie who has not played a second season yet', () => {
    const unproven = makePick({
      overallPick: 40,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(unproven),
      teams,
    );

    expect(dayOneStarters).toHaveLength(1);
  });

  it('does not punish a decline years after the job was held', () => {
    const declinedLate = makePick({
      overallPick: 41,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2024,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.2,
        }),
      ],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(declinedLate),
      teams,
    );

    expect(dayOneStarters).toHaveLength(1);
  });
});
