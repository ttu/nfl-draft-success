import { describe, it, expect } from 'vitest';
import type { Acquisition } from '../types';
import { stampDraftYear, type RawDraftClass } from '../lib/draftClass';
import {
  stampFreeAgentYear,
  type RawFreeAgentClass,
} from '../lib/freeAgentClass';
import { isPlayedSeason } from '../lib/seasonPlayed';

/**
 * Guards the rows the shipped JSON deliberately leaves out.
 *
 * `update-data.ts` stops writing a season row once a player is out of the
 * league, and `src/lib/trailingSeasons.ts` rebuilds them at parse time from
 * `src/data/team-games.json` — about a quarter of the payload. Those rows are
 * not decoration: career-mode scoring divides across every season since a
 * player entered the league, so a row that fails to come back silently raises
 * his score.
 *
 * That failure is invisible from inside the scoring function, and the obvious
 * way to cause it is a stale game-count table — a franchise or a season the
 * refresh added and this file does not cover. So the assertion is made against
 * the real shipped data rather than a fixture: every acquisition's played
 * seasons must run unbroken from his class year to the season the file says it
 * was written out to.
 */
function assertRunsToHorizon(
  who: string,
  player: Acquisition,
  seasonsThrough: number,
) {
  const years = player.seasons.filter(isPlayedSeason).map((s) => s.year);
  expect(
    { who, years },
    `${who}: expected played seasons ${player.draftYear}–${seasonsThrough}`,
  ).toEqual({
    who,
    years: Array.from(
      { length: seasonsThrough - player.draftYear + 1 },
      (_, i) => player.draftYear + i,
    ),
  });
}

describe('shipped season rows', () => {
  const draftFiles = Object.entries(
    import.meta.glob<RawDraftClass>('../../public/data/draft-*.json', {
      eager: true,
      import: 'default',
    }),
  );
  const faFiles = Object.entries(
    import.meta.glob<RawFreeAgentClass>('../../public/data/fa-*.json', {
      eager: true,
      import: 'default',
    }),
  );

  it('ships both populations', () => {
    expect(draftFiles.length).toBeGreaterThan(0);
    expect(faFiles.length).toBeGreaterThan(0);
  });

  it.each(draftFiles)('%s rebuilds every pick to its horizon', (file, raw) => {
    // The incoming class has no played season yet and states no horizon.
    if (raw.seasonsThrough == null) return;
    const cls = stampDraftYear(structuredClone(raw));
    for (const pick of cls.picks) {
      assertRunsToHorizon(
        `${file} ${pick.playerName}`,
        pick,
        cls.seasonsThrough!,
      );
    }
  });

  it.each(faFiles)(
    '%s rebuilds every free agent to its horizon',
    (file, raw) => {
      if (raw.seasonsThrough == null) return;
      const cls = stampFreeAgentYear(structuredClone(raw));
      for (const fa of cls.freeAgents) {
        assertRunsToHorizon(
          `${file} ${fa.playerName}`,
          fa,
          cls.seasonsThrough!,
        );
      }
    },
  );
});
