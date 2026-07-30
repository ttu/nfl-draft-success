import { describe, it, expect, vi } from 'vitest';
import { resolveLatestPlayedSeason } from './latestPlayedSeason';

/** A probe that reports data for every season up to and including `newest`. */
const dataThrough = (newest: number) => (season: number) =>
  Promise.resolve(season <= newest);

describe('resolveLatestPlayedSeason', () => {
  it('picks the newest season that has data', async () => {
    const latest = await resolveLatestPlayedSeason({
      floor: 2012,
      ceiling: 2026,
      hasPlayedData: dataThrough(2025),
    });
    expect(latest).toBe(2025);
  });

  it('picks the ceiling when its season is already under way', async () => {
    const latest = await resolveLatestPlayedSeason({
      floor: 2012,
      ceiling: 2026,
      hasPlayedData: dataThrough(2026),
    });
    expect(latest).toBe(2026);
  });

  it('searches downward, so a live season costs one probe', async () => {
    // The common case all season long. Walking up from the floor would spend a
    // request per year since 2012 on every run.
    const probe = vi.fn(dataThrough(2026));
    await resolveLatestPlayedSeason({
      floor: 2012,
      ceiling: 2026,
      hasPlayedData: probe,
    });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(probe).toHaveBeenCalledWith(2026);
  });

  it('stops at the first season with data rather than probing on', async () => {
    const probe = vi.fn(dataThrough(2025));
    await resolveLatestPlayedSeason({
      floor: 2012,
      ceiling: 2026,
      hasPlayedData: probe,
    });
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('falls back to the floor when nothing has data', async () => {
    const latest = await resolveLatestPlayedSeason({
      floor: 2012,
      ceiling: 2015,
      hasPlayedData: () => Promise.resolve(false),
    });
    expect(latest).toBe(2012);
  });

  it('never probes past the ceiling', async () => {
    const probe = vi.fn((_season: number) => Promise.resolve(false));
    await resolveLatestPlayedSeason({
      floor: 2024,
      ceiling: 2026,
      hasPlayedData: probe,
    });
    const probed = probe.mock.calls.map((c) => c[0]);
    expect(Math.max(...probed)).toBe(2026);
  });

  it('returns the floor without probing when the ceiling is below it', async () => {
    const probe = vi.fn(() => Promise.resolve(true));
    const latest = await resolveLatestPlayedSeason({
      floor: 2025,
      ceiling: 2024,
      hasPlayedData: probe,
    });
    expect(latest).toBe(2025);
    expect(probe).not.toHaveBeenCalled();
  });

  it('treats a probe failure as no data, so an outage cannot invent a season', async () => {
    // A season silently promoted on a network blip would resize every pick's
    // rookie window against games nobody has played.
    const latest = await resolveLatestPlayedSeason({
      floor: 2024,
      ceiling: 2026,
      hasPlayedData: (season) =>
        season === 2026
          ? Promise.reject(new Error('network'))
          : Promise.resolve(season <= 2025),
    });
    expect(latest).toBe(2025);
  });
});
