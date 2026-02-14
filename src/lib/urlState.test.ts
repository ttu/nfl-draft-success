import { describe, it, expect, vi } from 'vitest';
import { getUrlState, updateUrl, getShareableUrl } from './urlState';

const validTeamIds = new Set(['SEA', 'KC', 'BUF']);
const yearBounds = { min: 2018, max: 2025 };

describe('getUrlState', () => {
  it('returns null when no query params', () => {
    expect(getUrlState(validTeamIds, yearBounds, '')).toBeNull();
    expect(getUrlState(validTeamIds, yearBounds, '?foo=bar')).toBeNull();
  });

  it('returns null for invalid team', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, '?team=XXX&from=2021&to=2025'),
    ).toBeNull();
  });

  it('returns null for out-of-range years', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, '?team=SEA&from=2010&to=2030'),
    ).toBeNull();
  });

  it('returns null when from > to', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, '?team=SEA&from=2025&to=2021'),
    ).toBeNull();
  });

  it('returns state for valid params', () => {
    expect(
      getUrlState(validTeamIds, yearBounds, '?team=SEA&from=2021&to=2025'),
    ).toEqual({
      team: 'SEA',
      from: 2021,
      to: 2025,
    });
  });
});

describe('getShareableUrl', () => {
  it('returns url with query params', () => {
    const url = getShareableUrl('KC', 2020, 2024);
    expect(url).toContain('team=KC');
    expect(url).toContain('from=2020');
    expect(url).toContain('to=2024');
  });
});

describe('updateUrl', () => {
  it('updates history with replaceState', () => {
    const replaceState = vi.fn();
    const original = window.history.replaceState;
    window.history.replaceState = replaceState;
    try {
      updateUrl('SEA', 2021, 2024);
      expect(replaceState).toHaveBeenCalledWith(
        null,
        '',
        expect.stringContaining('team=SEA&from=2021&to=2024'),
      );
    } finally {
      window.history.replaceState = original;
    }
  });
});
