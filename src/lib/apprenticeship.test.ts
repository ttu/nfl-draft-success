import { describe, it, expect } from 'vitest';
import type { DraftPick, Season } from '../types';
import {
  makeDepthSeason,
  makeNonContributorSeason,
  makePick,
  makeSeason,
} from '../test/factories';
import { apprenticeSeasonCount, firstScoredYear } from './apprenticeship';

/** A quarterback drafted in 2020, so fixtures read like Jordan Love's career. */
const qb = (seasons: Season[], overrides: Partial<DraftPick> = {}): DraftPick =>
  makePick({ position: 'QB', draftYear: 2020, seasons, ...overrides });

/** Bench year: retained, barely on the field — `depth` or `non_contributor`. */
const bench = (year: number, overrides: Partial<Season> = {}): Season =>
  makeNonContributorSeason({ year, ...overrides });

/** The job won: a full starter season for the drafting team. */
const starting = (year: number, overrides: Partial<Season> = {}): Season =>
  makeSeason({ year, ...overrides });

describe('apprenticeSeasonCount', () => {
  it('counts the bench years of a quarterback who then won the job', () => {
    // The Jordan Love shape: three years behind a veteran, then QB1.
    const love = qb([
      bench(2020),
      bench(2021),
      bench(2022),
      starting(2023),
      starting(2024),
    ]);
    expect(apprenticeSeasonCount(love)).toBe(3);
  });

  it('counts a single bench year', () => {
    expect(apprenticeSeasonCount(qb([bench(2020), starting(2021)]))).toBe(1);
  });

  it('forgives nothing for a quarterback who never won the job', () => {
    // The Kyle Trask shape. His first three seasons are indistinguishable from
    // Love's; only what came after separates them, which is the whole rule.
    const trask = qb([bench(2020), bench(2021), bench(2022), bench(2023)]);
    expect(apprenticeSeasonCount(trask)).toBe(0);
  });

  it('accepts a starter-when-healthy season as winning the job', () => {
    // Won the job, then got hurt: still the payoff the bench years bought.
    const hurt = qb([
      bench(2020),
      starting(2021, { gamesPlayed: 6 }),
      starting(2022, { gamesPlayed: 5 }),
    ]);
    expect(apprenticeSeasonCount(hurt)).toBe(1);
  });

  it('leaves every other position alone', () => {
    // Run position-agnostic this rule fires on 115 picks across 2018–2025,
    // erasing quiet rookie years for ordinary starters. Only quarterback has
    // the one-man-plays constraint that makes sitting a development path.
    const tackle = qb([bench(2020), bench(2021), starting(2022)], {
      position: 'OT',
    });
    expect(apprenticeSeasonCount(tackle)).toBe(0);
  });

  it('ignores a benching that comes after the player has held the job', () => {
    // A starter benched for playing badly and restored the year after must
    // keep his punishment years — forgiveness is for the apprenticeship only.
    const demoted = qb([
      starting(2020),
      bench(2021),
      bench(2022),
      starting(2023),
    ]);
    expect(apprenticeSeasonCount(demoted)).toBe(0);
  });

  it('stops the run at a season spent on another roster', () => {
    // Sitting on somebody else's bench was not this team's apprenticeship.
    const traded = qb([
      bench(2020),
      bench(2021, { retained: false }),
      starting(2022),
    ]);
    expect(apprenticeSeasonCount(traded)).toBe(1);
  });

  it('stops the run at a missing year', () => {
    // Out of the league in 2021, back in 2022: the run is not unbroken, so
    // only the seasons up to the gap can be an apprenticeship.
    const gapped = qb([bench(2020), bench(2022), starting(2023)]);
    expect(apprenticeSeasonCount(gapped)).toBe(1);
  });

  it('forgives nothing when the job was won for another team', () => {
    // The Malik Willis case. The drafting team traded him and took the loss;
    // another club collecting on the investment does not undo that.
    const movedOn = qb([
      bench(2020),
      bench(2021),
      starting(2022, { retained: false }),
    ]);
    expect(apprenticeSeasonCount(movedOn)).toBe(0);
  });

  it('forgives nothing when every season was a bench season', () => {
    // Nothing to divide by afterwards, and nothing that says the wait paid.
    expect(apprenticeSeasonCount(qb([bench(2020), bench(2021)]))).toBe(0);
  });

  it('does not treat a rotation season as sitting', () => {
    // The Jalen Hurts shape: real rookie snaps behind the incumbent. The mean
    // already absorbs these, so the rule must leave him untouched.
    const rotational = qb([
      makeSeason({ year: 2020, gamesPlayed: 15, snapShare: 0.45 }),
      starting(2021),
    ]);
    expect(apprenticeSeasonCount(rotational)).toBe(0);
  });

  it('counts a depth season as sitting, not just a blank one', () => {
    // 18% of snaps is a quarterback being auditioned in garbage time, not one
    // sharing the job.
    expect(
      apprenticeSeasonCount(
        qb([makeDepthSeason({ year: 2020 }), starting(2021)]),
      ),
    ).toBe(1);
  });

  it('ignores an upcoming-season row', () => {
    // A row with no football played says where he stands, not what he did.
    const upcoming = makeSeason({
      year: 2021,
      gamesPlayed: 0,
      teamGames: 0,
      snapShare: 0,
    });
    expect(apprenticeSeasonCount(qb([bench(2020), upcoming]))).toBe(0);
  });

  it('is zero for a pick with no seasons at all', () => {
    expect(apprenticeSeasonCount(qb([]))).toBe(0);
  });
});

describe('firstScoredYear', () => {
  it('is the draft year when there was no apprenticeship', () => {
    const pick = qb([starting(2020), starting(2021)]);
    expect(firstScoredYear(pick)).toBe(2020);
  });

  it('skips past the bench years of a vindicated quarterback', () => {
    const love = qb([bench(2020), bench(2021), bench(2022), starting(2023)]);
    expect(firstScoredYear(love)).toBe(2023);
  });
});
