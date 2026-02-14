import type { DraftClass } from '../types';

/**
 * Load draft data for a given year from public/data/draft-{year}.json
 */
export async function loadData(year: string): Promise<DraftClass> {
  const res = await fetch(`/data/draft-${year}.json`);
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
