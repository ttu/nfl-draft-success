import { describe, it, expect } from 'vitest';
import {
  parsePositionParam,
  determineActiveView,
  isRouteYearValid,
} from './viewRouter';
import { ActiveView } from '../types';

describe('parsePositionParam', () => {
  it('returns isPositionView=false when no match', () => {
    expect(parsePositionParam(null)).toEqual({
      isPositionView: false,
      positionParam: undefined,
    });
  });
  it('returns decoded position param', () => {
    expect(parsePositionParam({ params: { position: 'WR' } })).toEqual({
      isPositionView: true,
      positionParam: 'WR',
    });
  });
  it('decodes URL-encoded values', () => {
    expect(
      parsePositionParam({ params: { position: 'OL%20WR' } }).positionParam,
    ).toBe('OL WR');
  });
  it('handles undefined position segment', () => {
    expect(parsePositionParam({ params: {} })).toEqual({
      isPositionView: true,
      positionParam: undefined,
    });
  });
});

describe('determineActiveView', () => {
  it('prefers DraftYears over everything', () => {
    expect(
      determineActiveView({
        isYearView: true,
        isPositionView: true,
        hasSelectedTeam: true,
      }),
    ).toBe(ActiveView.DraftYears);
  });
  it('prefers Position over TeamDetail/Rankings', () => {
    expect(
      determineActiveView({
        isYearView: false,
        isPositionView: true,
        hasSelectedTeam: true,
      }),
    ).toBe(ActiveView.Position);
  });
  it('prefers Highlights over TeamDetail/Rankings', () => {
    expect(
      determineActiveView({
        isYearView: false,
        isPositionView: false,
        isHighlightsView: true,
        hasSelectedTeam: false,
      }),
    ).toBe(ActiveView.Highlights);
  });
  it('prefers Position and DraftYears over Highlights', () => {
    expect(
      determineActiveView({
        isYearView: true,
        isPositionView: false,
        isHighlightsView: true,
        hasSelectedTeam: false,
      }),
    ).toBe(ActiveView.DraftYears);
    expect(
      determineActiveView({
        isYearView: false,
        isPositionView: true,
        isHighlightsView: true,
        hasSelectedTeam: false,
      }),
    ).toBe(ActiveView.Position);
  });
  it('returns TeamDetail when only team is selected', () => {
    expect(
      determineActiveView({
        isYearView: false,
        isPositionView: false,
        hasSelectedTeam: true,
      }),
    ).toBe(ActiveView.TeamDetail);
  });
  it('falls back to TeamRankings', () => {
    expect(
      determineActiveView({
        isYearView: false,
        isPositionView: false,
        hasSelectedTeam: false,
      }),
    ).toBe(ActiveView.TeamRankings);
  });
});

describe('isRouteYearValid', () => {
  const bounds = { min: 2018, max: 2026 };
  it('rejects undefined param', () => {
    expect(isRouteYearValid(undefined, bounds)).toBe(false);
  });
  it('accepts in-bounds integers', () => {
    expect(isRouteYearValid('2020', bounds)).toBe(true);
    expect(isRouteYearValid('2018', bounds)).toBe(true);
    expect(isRouteYearValid('2026', bounds)).toBe(true);
  });
  it('rejects out-of-bounds', () => {
    expect(isRouteYearValid('2017', bounds)).toBe(false);
    expect(isRouteYearValid('2027', bounds)).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(isRouteYearValid('foo', bounds)).toBe(false);
  });
});
