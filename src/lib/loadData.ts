import type { DraftClass, DefaultRankingsData } from '../types';

/**
 * Load draft data for a given year from public/data/draft-{year}.json
 * Uses import.meta.env.BASE_URL for GitHub Pages subpath deployment.
 */
export async function loadData(year: string): Promise<DraftClass> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/draft-${year}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load draft data for ${year}: ${res.status}`);
  }
  return res.json();
}

/**
 * Load draft data for multiple years in parallel.
 */
export async function loadDataForYears(years: number[]): Promise<DraftClass[]> {
  const results = await Promise.all(years.map((y) => loadData(String(y))));
  return results.sort((a, b) => a.year - b.year);
}

/**
 * Load pre-computed default rankings (generated at build time).
 */
export async function loadDefaultRankings(): Promise<DefaultRankingsData> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/default-rankings.json`);
  if (!res.ok) {
    throw new Error(`Failed to load default rankings: ${res.status}`);
  }
  return res.json();
}
