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
