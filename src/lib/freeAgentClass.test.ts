import { describe, it, expect } from 'vitest';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeSeason } from '../test/factories';

describe('stampFreeAgentYear', () => {
  it('stamps the class year onto every free agent', () => {
    const stamped = stampFreeAgentYear({
      year: 2021,
      freeAgents: [
        {
          playerId: 'a',
          playerName: 'A',
          position: 'ZZ',
          teamId: 'BUF',
          seasons: [makeSeason({ year: 2021 })],
        },
      ],
    });
    expect(stamped.freeAgents[0].draftYear).toBe(2021);
  });

  it('subtracts a rested finale, exactly as the draft path does', () => {
    const stamped = stampFreeAgentYear({
      year: 2021,
      freeAgents: [
        {
          playerId: 'a',
          playerName: 'A',
          position: 'ZZ',
          teamId: 'BUF',
          seasons: [
            makeSeason({
              year: 2021,
              gamesPlayed: 17,
              teamGames: 18,
              restGame: {
                playerGames: 1,
                playerShareSum: 0.9,
                playerSnaps: 60,
                teamSnaps: 65,
              },
            }),
          ],
        },
      ],
    });
    // `withoutRestGame` shortens the schedule by the rested game and stores the
    // slice raw (see `Season.restGame`'s doc comment) rather than deleting it,
    // so the assertion here checks the subtraction, not removal of the field.
    const season = stamped.freeAgents[0].seasons[0];
    expect(season.teamGames).toBe(17);
    expect(season.gamesPlayed).toBe(16);
  });
});
