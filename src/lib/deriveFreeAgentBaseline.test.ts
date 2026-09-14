import { describe, it, expect } from 'vitest';
import { deriveFreeAgentBaseline } from './deriveFreeAgentBaseline';
import { deriveDraftSlotCurve } from './deriveDraftSlotBaseline';
import { stampFreeAgentYear } from './freeAgentClass';
import { stampDraftYear } from './draftClass';
import { makeSeason } from '../test/factories';

function classOf(year: number, shares: number[]) {
  return stampFreeAgentYear({
    year,
    freeAgents: shares.map((snapShare, i) => ({
      playerId: `fa-${year}-${i}`,
      playerName: `FA ${i}`,
      position: 'ZZ',
      teamId: 'BUF',
      seasons: [
        makeSeason({ year, snapShare }),
        makeSeason({ year: year + 1, snapShare }),
        makeSeason({ year: year + 2, snapShare }),
      ],
    })),
  });
}

function draftClassOf(year: number, played = true) {
  return stampDraftYear({
    year,
    picks: [
      {
        playerId: `pick-${year}`,
        playerName: `Pick ${year}`,
        position: 'ZZ',
        round: 1,
        overallPick: 1,
        teamId: 'BUF',
        seasons: played ? [makeSeason({ year, snapShare: 0.9 })] : [],
      },
    ],
  });
}

describe('deriveFreeAgentBaseline', () => {
  it('averages the scores of members with season data', () => {
    const result = deriveFreeAgentBaseline(
      [classOf(2014, [0.9, 0.1]), classOf(2017, [])],
      2017,
    );
    expect(result.playerCount).toBe(2);
    expect(result.expected).toBeGreaterThan(0);
    expect(result.expected).toBeLessThan(100);
  });

  it('ignores classes too young to have played out their window', () => {
    // With a 2020 reference the cutoff is 2017, so the 2019 class is excluded.
    const result = deriveFreeAgentBaseline(
      [classOf(2014, [0.9]), classOf(2019, [0.1]), classOf(2020, [0.1])],
      2020,
    );
    expect(result.playerCount).toBe(1);
    expect(result.matureFrom).toBe(2014);
    expect(result.matureTo).toBe(2014);
  });

  it('matures against the reference year, not the newest class present', () => {
    // The regression this pins. Free-agent classes stop at the newest *played*
    // season while the pick curve's reference runs a year further (the class
    // drafted for the upcoming season). Deriving the cutoff from the classes
    // themselves therefore excluded a debut class that has, in fact, played
    // out all three of its seasons.
    const classes = [classOf(2019, [0.9]), classOf(2020, [0.1])];

    const fromClasses = deriveFreeAgentBaseline(classes, 2020);
    const fromReference = deriveFreeAgentBaseline(classes, 2023);

    expect(fromClasses.matureTo).toBeNull();
    expect(fromReference.matureTo).toBe(2020);
    expect(fromReference.playerCount).toBe(2);
  });

  it('matures the same classes the pick curve does for that reference', () => {
    const years = [2022, 2023, 2024];
    // 2026 is drafted but unplayed — the year the free-agent files cannot see,
    // and the one whose absence used to skew the free-agent cutoff.
    const draftClasses = [
      ...years.map((y) => draftClassOf(y)),
      draftClassOf(2026, false),
    ];

    const fa = deriveFreeAgentBaseline(
      years.map((y) => classOf(y, [0.9])),
      2026,
    );
    const picks = deriveDraftSlotCurve(draftClasses);

    expect(fa.matureTo).toBe(picks.matureTo);
    expect(fa.matureTo).toBe(2023);
  });

  it('reports no baseline when nothing is mature enough to fit', () => {
    const result = deriveFreeAgentBaseline(
      [classOf(2019, [0.9]), classOf(2020, [0.9])],
      2021,
    );
    expect(result.playerCount).toBe(0);
    expect(result.matureFrom).toBeNull();
  });
});
