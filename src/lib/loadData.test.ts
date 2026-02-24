import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadData, loadDefaultRankings } from './loadData';

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

describe('loadDefaultRankings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches and returns default rankings data', async () => {
    const mockRankings = {
      from: 2021,
      to: 2025,
      rankings: [
        {
          teamId: 'DET',
          teamName: 'Detroit Lions',
          score: 2.0,
          rank: 1,
          totalPicks: 40,
          coreStarterRate: 0.3,
          retentionRate: 0.6,
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockRankings),
    } as Response);

    const result = await loadDefaultRankings();
    expect(result).toEqual(mockRankings);
    expect(result.rankings).toHaveLength(1);
    expect(result.rankings[0].teamId).toBe('DET');
  });

  it('throws on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadDefaultRankings()).rejects.toThrow(
      'Failed to load default rankings: 404',
    );
  });
});
