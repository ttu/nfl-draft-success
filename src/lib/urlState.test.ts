import { describe, it, expect, vi } from 'vitest';
import { getUrlState, updateUrl, getShareableUrl } from './urlState';

const validTeamIds = new Set(['SEA', 'KC', 'BUF']);
const yearBounds = { min: 2018, max: 2025 };

function loc(pathname: string, search: string) {
  return { pathname, search };
}

describe('getUrlState', () => {
  it('returns null when no query params', () => {
    expect(getUrlState(validTeamIds, yearBounds, loc('/', ''))).toBeNull();
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/', '?foo=bar')),
    ).toBeNull();
  });

  it('returns state with team null for root path (rankings URL)', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/', '?from=2021&to=2025')),
    ).toEqual({ team: null, from: 2021, to: 2025 });
  });

  it('returns state with team null when path is invalid team', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/XXX', '?from=2021&to=2025')),
    ).toEqual({ team: null, from: 2021, to: 2025 });
  });

  it('returns null for out-of-range years', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/SEA', '?from=2010&to=2030')),
    ).toBeNull();
  });

  it('returns null when from > to', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/SEA', '?from=2025&to=2021')),
    ).toBeNull();
  });

  it('returns state for valid team path and params', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, loc('/SEA', '?from=2021&to=2025')),
    ).toEqual({
      team: 'SEA',
      from: 2021,
      to: 2025,
    });
  });
});

describe('getShareableUrl', () => {
  it('returns url with team in path when team provided (no double slash)', () => {
    const url = getShareableUrl('KC', 2020, 2024);
    expect(url).toContain('/KC');
    expect(url).not.toContain('//KC');
    expect(url).toContain('from=2020');
    expect(url).toContain('to=2024');
  });

  it('returns url without team path when team is null (rankings)', () => {
    const url = getShareableUrl(null, 2020, 2024);
    expect(url).toMatch(/\/\?/);
    expect(url).toContain('from=2020');
    expect(url).toContain('to=2024');
  });
});

describe('updateUrl', () => {
  it('updates history with team in path when team provided', () => {
    const replaceState = vi.fn();
    const original = window.history.replaceState;
    window.history.replaceState = replaceState;
    try {
      updateUrl('SEA', 2021, 2024);
      const url = replaceState.mock.calls[0][2];
      expect(url).toContain('/SEA');
      expect(url).toContain('from=2021');
      expect(url).toContain('to=2024');
    } finally {
      window.history.replaceState = original;
    }
  });

  it('updates history without team path when team is null', () => {
    const replaceState = vi.fn();
    const original = window.history.replaceState;
    window.history.replaceState = replaceState;
    try {
      updateUrl(null, 2021, 2024);
      const url = replaceState.mock.calls[0][2];
      expect(url).toContain('from=2021');
      expect(url).toContain('to=2024');
      expect(url).not.toContain('/SEA');
    } finally {
      window.history.replaceState = original;
    }
  });
});
