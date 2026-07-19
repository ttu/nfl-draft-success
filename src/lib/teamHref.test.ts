import { describe, it, expect } from 'vitest';
import { buildTeamHref } from './teamHref';

describe('buildTeamHref', () => {
  it('builds a team path carrying the year window', () => {
    expect(buildTeamHref('SEA', { from: 2021, to: 2025 })).toBe(
      '/SEA?from=2021&to=2025',
    );
  });

  it('encodes the team id', () => {
    expect(buildTeamHref('a b', { from: 2021, to: 2025 })).toBe(
      '/a%20b?from=2021&to=2025',
    );
  });
});
