import type {
  DataMeta,
  DraftClass,
  DefaultRankingsData,
  LaggedDraftRankingsData,
} from '../types';
import type { TeamSuccessData } from './teamSuccess';

/**
 * Completed and in-flight loads, keyed by data file.
 *
 * Every file under `public/data/` is a build-time static artifact, so a load
 * never needs repeating within a session. Without this, changing the year range
 * refetched *and* re-parsed each draft class (~2.8 MB across the full window),
 * and returning to a range already visited paid the whole cost again.
 */
const cache = new Map<string, Promise<unknown>>();

/**
 * Serves `key` from cache, otherwise runs `load` and caches the promise —
 * caching the promise rather than the value means concurrent callers share one
 * request instead of racing duplicates.
 *
 * A rejected load is evicted, so a failure (offline, transient 5xx) does not
 * pin itself in the cache and doom every later attempt to replay it.
 */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;

  const pending = load().catch((err: unknown) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, pending);
  return pending;
}

/**
 * Clears the load cache. Test-only: each case stubs `fetch` afresh, and a cache
 * surviving between them would serve the previous case's stub.
 */
export function resetDataCache(): void {
  cache.clear();
}

/**
 * Fetch a JSON file from `public/data/`. Uses `import.meta.env.BASE_URL` for
 * GitHub Pages subpath deployment.
 */
async function fetchData(file: string): Promise<Response> {
  const base = import.meta.env.BASE_URL;
  return fetch(`${base}data/${file}`);
}

/** Fetch a data file as JSON, throwing `Failed to load {label}: {status}`. */
async function fetchJson<T>(file: string, label: string): Promise<T> {
  const res = await fetchData(file);
  if (!res.ok) {
    throw new Error(`Failed to load ${label}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Load draft data for a given year from public/data/draft-{year}.json.
 */
export async function loadData(year: string): Promise<DraftClass> {
  return cached(`draft-${year}`, () =>
    fetchJson<DraftClass>(`draft-${year}.json`, `draft data for ${year}`),
  );
}

/**
 * Load draft data for multiple years in parallel. Years already loaded resolve
 * from cache, so widening a range only pays for the years it adds.
 */
export async function loadDataForYears(years: number[]): Promise<DraftClass[]> {
  const results = await Promise.all(years.map((y) => loadData(String(y))));
  return [...results].sort((a, b) => a.year - b.year);
}

/**
 * Load pre-computed default rankings (generated at build time).
 */
export async function loadDefaultRankings(): Promise<DefaultRankingsData> {
  return cached('default-rankings', () =>
    fetchJson<DefaultRankingsData>('default-rankings.json', 'default rankings'),
  );
}

/**
 * Load pre-computed draft scores for the fixed lagged draft window (2018–2021),
 * joined at runtime to the later win rate for the correlation view.
 */
export async function loadLaggedRankings(): Promise<LaggedDraftRankingsData> {
  return cached('lagged-draft-rankings', () =>
    fetchJson<LaggedDraftRankingsData>(
      'lagged-draft-rankings.json',
      'lagged draft rankings',
    ),
  );
}

/**
 * Load pre-computed team-success outcomes (real win rate, playoff and Super
 * Bowl results per team) generated at data-update time.
 */
export async function loadTeamSuccess(): Promise<TeamSuccessData> {
  return cached('team-success', () =>
    fetchJson<TeamSuccessData>('team-success.json', 'team success data'),
  );
}

/**
 * When draft data was last regenerated (nflverse pull). Optional for older deploys.
 */
export async function loadDataMeta(): Promise<DataMeta | null> {
  return cached('data-meta', async () => {
    const res = await fetchData('data-meta.json');
    if (!res.ok) {
      return null;
    }
    return res.json() as Promise<DataMeta>;
  });
}
