import { describe, it, expect } from 'vitest';
import { buildSiteRoutes } from './siteRoutes';
import { TEAMS } from '../data/teams';
import { DRAFT_YEAR_BOUNDS } from '../lib/draftYearBounds';
import { resolveRouteMeta, DEFAULT_ROUTE_META } from './routeMeta';

const positions = ['QB', 'RB', 'WR'];

describe('buildSiteRoutes', () => {
  it('leads with the landing route at top priority', () => {
    expect(buildSiteRoutes(positions)[0]).toEqual({
      path: '/',
      priority: '1.0',
    });
  });

  it('covers every team, every published draft year, and every position', () => {
    const paths = buildSiteRoutes(positions).map((r) => r.path);
    const { min, max } = DRAFT_YEAR_BOUNDS;

    expect(paths).toContain('/highlights');
    for (const team of TEAMS) {
      expect(paths).toContain(`/${team.id}`);
      expect(paths).toContain(`/roster/${team.id}`);
    }
    for (let y = min; y <= max; y++) expect(paths).toContain(`/year/${y}`);
    for (const p of positions) expect(paths).toContain(`/position/${p}`);
    expect(paths).toHaveLength(3 + TEAMS.length * 2 + (max - min + 1) + 3);
  });

  it('emits no duplicate paths', () => {
    const paths = buildSiteRoutes(positions).map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('percent-encodes positions that need it', () => {
    const paths = buildSiteRoutes(['DB/S']).map((r) => r.path);
    expect(paths).toContain('/position/DB%2FS');
  });

  it('publishes a roster route for every team', () => {
    const paths = buildSiteRoutes(['QB']).map((r) => r.path);
    for (const team of TEAMS) {
      expect(paths).toContain(`/roster/${team.id}`);
    }
  });

  it('only advertises routes that resolve to their own metadata', () => {
    for (const route of buildSiteRoutes(positions)) {
      const meta = resolveRouteMeta(route.path);
      expect(meta.canonicalPath, `${route.path} must be canonical`).toBe(
        route.path,
      );
      if (route.path !== '/') {
        expect(meta, `${route.path} must have its own title`).not.toEqual(
          DEFAULT_ROUTE_META,
        );
      }
    }
  });
});

describe('the league-wide rosters board', () => {
  it('is published as its own indexable route', () => {
    const paths = buildSiteRoutes(['QB']).map((r) => r.path);
    expect(paths).toContain('/rosters');
  });
});
