import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadData } from './loadData';

describe('loadData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns DraftClass with picks for year 2023', async () => {
    const mockDraft = {
      year: 2023,
      picks: [
        {
          playerId: 'p1',
          playerName: 'Test Player',
          position: 'WR',
          round: 1,
          overallPick: 5,
          teamId: 'KC',
          seasons: [
            {
              year: 2023,
              gamesPlayed: 15,
              teamGames: 17,
              snapShare: 0.72,
              retained: true,
            },
          ],
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDraft),
    } as Response);

    const result = await loadData('2023');

    expect(result).toEqual(mockDraft);
    expect(result.year).toBe(2023);
    expect(result.picks).toHaveLength(1);
    expect(result.picks[0].playerName).toBe('Test Player');
  });
});
