import { describe, it, expect } from 'vitest';
import {
  buildPlayerHref,
  resolvePlayerBackTarget,
  resolvePlayerOriginTab,
} from './playerBackTarget';

const teams = [
  { id: 'TB', name: 'Tampa Bay Buccaneers' },
  { id: 'KC', name: 'Kansas City Chiefs' },
];
const fallback = { from: 2021, to: 2026 };

describe('buildPlayerHref', () => {
  it('builds a bare player href when no origin is given', () => {
    expect(buildPlayerHref('p1')).toBe('/player/p1');
  });

  it('encodes the player id', () => {
    expect(buildPlayerHref('a b')).toBe('/player/a%20b');
  });

  it('appends the origin as an encoded ref param', () => {
    expect(buildPlayerHref('p1', '/TB?from=2021&to=2026')).toBe(
      '/player/p1?ref=%2FTB%3Ffrom%3D2021%26to%3D2026',
    );
  });

  it('omits the ref param for an empty origin', () => {
    expect(buildPlayerHref('p1', '')).toBe('/player/p1');
  });
});

describe('resolvePlayerBackTarget', () => {
  it('falls back to rankings when there is no origin', () => {
    expect(resolvePlayerBackTarget(null, teams, fallback)).toEqual({
      label: 'Rankings',
      to: '/?from=2021&to=2026',
    });
  });

  it('returns the team name and team path when the origin is a team page', () => {
    expect(
      resolvePlayerBackTarget('/TB?from=2021&to=2026', teams, fallback),
    ).toEqual({
      label: 'Tampa Bay Buccaneers',
      to: '/TB?from=2021&to=2026',
    });
  });

  it('returns Draft Year for a year origin', () => {
    expect(resolvePlayerBackTarget('/year/2022', teams, fallback)).toEqual({
      label: 'Draft Year',
      to: '/year/2022',
    });
  });

  it('returns Position for a position origin', () => {
    expect(
      resolvePlayerBackTarget(
        '/position/QB?from=2021&to=2026',
        teams,
        fallback,
      ),
    ).toEqual({
      label: 'Position',
      to: '/position/QB?from=2021&to=2026',
    });
  });

  it('returns Rankings pointing at the origin for the rankings landing', () => {
    expect(
      resolvePlayerBackTarget('/?from=2021&to=2026', teams, fallback),
    ).toEqual({
      label: 'Rankings',
      to: '/?from=2021&to=2026',
    });
  });

  it('falls back to rankings for an unknown team id', () => {
    expect(resolvePlayerBackTarget('/ZZZ', teams, fallback)).toEqual({
      label: 'Rankings',
      to: '/?from=2021&to=2026',
    });
  });
});

describe('resolvePlayerOriginTab', () => {
  it('defaults to rankings when there is no origin', () => {
    expect(resolvePlayerOriginTab(null, teams)).toBe('rankings');
  });

  it('returns the team tab for a team origin', () => {
    expect(resolvePlayerOriginTab('/TB?from=2021&to=2026', teams)).toBe('team');
  });

  it('returns the year tab for a year origin', () => {
    expect(resolvePlayerOriginTab('/year/2022', teams)).toBe('year');
  });

  it('returns the position tab for a position origin', () => {
    expect(
      resolvePlayerOriginTab('/position/QB?from=2021&to=2026', teams),
    ).toBe('pos');
  });

  it('returns the rankings tab for the rankings landing origin', () => {
    expect(resolvePlayerOriginTab('/?from=2021&to=2026', teams)).toBe(
      'rankings',
    );
  });

  it('falls back to rankings for an unknown team id', () => {
    expect(resolvePlayerOriginTab('/ZZZ', teams)).toBe('rankings');
  });
});
