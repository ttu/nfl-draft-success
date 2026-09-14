import { describe, it, expect } from 'vitest';
import { getPlayerDraftScore, getPlayerRole } from './getPlayerRole';
import { scoredSeasonCount } from './rookieWindow';
import { makeSeason } from '../test/factories';
import type { FreeAgent } from '../types';

function makeFreeAgent(overrides: Partial<FreeAgent> = {}): FreeAgent {
  return {
    playerId: 'fa-1',
    playerName: 'Undrafted Guy',
    position: 'ZZ',
    teamId: 'BUF',
    draftYear: 2019,
    seasons: [],
    ...overrides,
  };
}

describe('scoring a free agent', () => {
  it('divides by the three-year window, not four', () => {
    // Three core-starter seasons on a three-year window is a full score;
    // the same three on a late pick's four-year window would lose a quarter.
    const fa = makeFreeAgent({
      seasons: [
        makeSeason({ year: 2019 }),
        makeSeason({ year: 2020 }),
        makeSeason({ year: 2021 }),
      ],
    });
    expect(scoredSeasonCount(fa, 3)).toBe(3);
    expect(getPlayerDraftScore(fa)).toBeGreaterThan(90);
  });

  it('charges a departed free agent the rest of his window', () => {
    const fa = makeFreeAgent({
      seasons: [makeSeason({ year: 2019, retained: false })],
    });
    expect(scoredSeasonCount(fa, 1)).toBe(3);
  });

  it('classifies a role the same way it does for a pick', () => {
    const fa = makeFreeAgent({
      seasons: [
        makeSeason({ year: 2019 }),
        makeSeason({ year: 2020 }),
        makeSeason({ year: 2021 }),
      ],
    });
    expect(getPlayerRole(fa)).toBe('core_starter');
  });
});
