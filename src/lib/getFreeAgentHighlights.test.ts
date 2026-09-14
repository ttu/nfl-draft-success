import { describe, it, expect } from 'vitest';
import { getFreeAgentHighlights } from './getFreeAgentHighlights';
import { HIGHLIGHT_LIST_MAX } from './getLeagueHighlights';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeFreeAgent, makeSeason, makeTeam } from '../test/factories';
import type { FreeAgent, FreeAgentClass } from '../types';

const TEAMS = [makeTeam({ id: 'BUF' }), makeTeam({ id: 'KC' })];

/** A free agent who debuted in `year` and played it at `snapShare`. */
const fa = (
  playerId: string,
  year: number,
  snapShare: number,
  teamId = 'BUF',
): FreeAgent =>
  makeFreeAgent({
    playerId,
    playerName: playerId,
    teamId,
    seasons: [makeSeason({ year, snapShare })],
  });

const classOf = (year: number, ...members: FreeAgent[]): FreeAgentClass =>
  stampFreeAgentYear({ year, freeAgents: members });

describe('getFreeAgentHighlights', () => {
  it('ranks the best undrafted players by score, best first', () => {
    const result = getFreeAgentHighlights(
      [
        classOf(
          2021,
          fa('Quiet', 2021, 0.05),
          fa('Starter', 2021, 0.95),
          fa('Rotational', 2021, 0.45),
        ),
      ],
      TEAMS,
    );

    expect(result.bestUndrafted.map((h) => h.player.playerName)).toEqual([
      'Starter',
      'Rotational',
      'Quiet',
    ]);
    expect(result.bestUndrafted[0].score).toBeGreaterThan(
      result.bestUndrafted[1].score,
    );
  });

  it('carries the debut year and the team that played him', () => {
    const result = getFreeAgentHighlights(
      [classOf(2022, fa('Chief', 2022, 0.9, 'KC'))],
      TEAMS,
    );

    const [top] = result.bestUndrafted;
    expect(top.draftYear).toBe(2022);
    expect(top.team?.id).toBe('KC');
  });

  it('reports over slot for context, without letting it change the order', () => {
    // A free agent's over slot is his score minus one constant, so ranking by
    // it would be the same order wearing a different claim. The value is
    // carried for display only.
    const result = getFreeAgentHighlights(
      [classOf(2021, fa('High', 2021, 0.9), fa('Low', 2021, 0.1))],
      TEAMS,
    );

    const [high, low] = result.bestUndrafted;
    expect(high.score - high.overSlot).toBeCloseTo(low.score - low.overSlot, 5);
    expect(high.overSlot).toBeGreaterThan(low.overSlot);
  });

  it('survives a player whose team is not in the list', () => {
    const result = getFreeAgentHighlights(
      [classOf(2021, fa('Orphan', 2021, 0.8, 'ZZZ'))],
      TEAMS,
    );

    expect(result.bestUndrafted).toHaveLength(1);
    expect(result.bestUndrafted[0].team).toBeUndefined();
  });

  it('caps the list at the shared highlight maximum', () => {
    const many = Array.from({ length: HIGHLIGHT_LIST_MAX + 5 }, (_, i) =>
      fa(`P${i}`, 2021, 0.9 - i * 0.01),
    );

    const result = getFreeAgentHighlights([classOf(2021, ...many)], TEAMS);

    expect(result.bestUndrafted).toHaveLength(HIGHLIGHT_LIST_MAX);
  });

  it('returns an empty list for a window with no free agents', () => {
    expect(getFreeAgentHighlights([], TEAMS).bestUndrafted).toEqual([]);
  });

  it('skips a member with no played season', () => {
    const result = getFreeAgentHighlights(
      [
        classOf(
          2021,
          fa('Played', 2021, 0.5),
          makeFreeAgent({
            playerId: 'Never',
            playerName: 'Never',
            teamId: 'BUF',
            seasons: [],
          }),
        ),
      ],
      TEAMS,
    );

    expect(result.bestUndrafted.map((h) => h.player.playerName)).toEqual([
      'Played',
    ]);
  });
});
