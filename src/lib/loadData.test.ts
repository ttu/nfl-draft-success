import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadData,
  loadDataForYears,
  loadDataMeta,
  loadDefaultRankings,
  resetDataCache,
} from './loadData';

beforeEach(() => {
  resetDataCache();
});

/** Minimal well-formed draft class for cache tests. */
const draftClass = (year: number) => ({ year, picks: [] });

const okResponse = (body: unknown) =>
  ({ ok: true, json: () => Promise.resolve(body) }) as Response;

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

  it('fetches a given year only once, serving repeat loads from cache', async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(draftClass(2023)));

    const first = await loadData('2023');
    const second = await loadData('2023');

    expect(fetch).toHaveBeenCalledTimes(1);
    // Same object, so downstream memo keys stay stable across reloads.
    expect(second).toBe(first);
  });

  it('issues one request when the same year is requested concurrently', async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(draftClass(2023)));

    const [a, b] = await Promise.all([loadData('2023'), loadData('2023')]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('caches each year separately', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okResponse(draftClass(2023)))
      .mockResolvedValueOnce(okResponse(draftClass(2024)));

    expect((await loadData('2023')).year).toBe(2023);
    expect((await loadData('2024')).year).toBe(2024);
    expect(await loadData('2023')).toEqual(draftClass(2023));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load, so a retry can still succeed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce(okResponse(draftClass(2023)));

    await expect(loadData('2023')).rejects.toThrow(
      'Failed to load draft data for 2023: 500',
    );
    await expect(loadData('2023')).resolves.toEqual(draftClass(2023));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('loadDataForYears', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('reuses cached years and fetches only the ones not seen yet', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const year = Number(String(input).match(/draft-(\d+)/)?.[1]);
      return Promise.resolve(okResponse(draftClass(year)));
    });

    await loadDataForYears([2023, 2024]);
    expect(fetch).toHaveBeenCalledTimes(2);

    // Widening the range must only pay for the newly added year.
    const widened = await loadDataForYears([2023, 2024, 2025]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(widened.map((d) => d.year)).toEqual([2023, 2024, 2025]);
  });

  it('returns classes in ascending year order regardless of input order', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const year = Number(String(input).match(/draft-(\d+)/)?.[1]);
      return Promise.resolve(okResponse(draftClass(year)));
    });

    const result = await loadDataForYears([2025, 2023, 2024]);
    expect(result.map((d) => d.year)).toEqual([2023, 2024, 2025]);
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

  it('fetches once even when called repeatedly', async () => {
    // StrictMode double-invokes the effect that loads this on mount.
    vi.mocked(fetch).mockResolvedValue(okResponse({ rankings: [] }));

    await loadDefaultRankings();
    await loadDefaultRankings();

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('loadDataMeta', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns null when data-meta.json is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadDataMeta()).resolves.toBeNull();
  });

  it('returns metadata when present', async () => {
    const meta = { lastUpdated: '2026-04-30' };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(meta),
    } as Response);

    await expect(loadDataMeta()).resolves.toEqual(meta);
  });
});
