import type {
  DataMeta,
  DraftClass,
  DefaultRankingsData,
  LaggedDraftRankingsData,
} from '../types';
import type { TeamSuccessData } from './teamSuccess';

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

/**
 * Load pre-computed draft scores for the fixed lagged draft window (2018–2021),
 * joined at runtime to the later win rate for the correlation view.
 */
export async function loadLaggedRankings(): Promise<LaggedDraftRankingsData> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/lagged-draft-rankings.json`);
  if (!res.ok) {
    throw new Error(`Failed to load lagged draft rankings: ${res.status}`);
  }
  return res.json();
}

/**
 * Load pre-computed team-success outcomes (real win rate, playoff and Super
 * Bowl results per team) generated at data-update time.
 */
export async function loadTeamSuccess(): Promise<TeamSuccessData> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/team-success.json`);
  if (!res.ok) {
    throw new Error(`Failed to load team success data: ${res.status}`);
  }
  return res.json();
}

/**
 * When draft data was last regenerated (nflverse pull). Optional for older deploys.
 */
export async function loadDataMeta(): Promise<DataMeta | null> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/data-meta.json`);
  if (!res.ok) {
    return null;
  }
  return res.json();
}
