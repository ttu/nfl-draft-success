import { describe, it, expect } from 'vitest';
import {
  getPfrUrl,
  getPlayerDisplayAccent,
  getPlayerDisplayLogo,
} from './playerDisplay';
import { TEAM_COLORS, getTeamLogoUrl } from '../data/teamColors';

describe('getPfrUrl', () => {
  it('returns null when playerId is empty', () => {
    expect(getPfrUrl('', 'Patrick Mahomes')).toBeNull();
  });
  it('returns null for unknown- placeholders', () => {
    expect(getPfrUrl('unknown-123', 'Patrick Mahomes')).toBeNull();
  });
  it('uses uppercase first letter of last name', () => {
    expect(getPfrUrl('MahoPa00', 'Patrick Mahomes')).toBe(
      'https://www.pro-football-reference.com/players/M/MahoPa00.htm',
    );
  });
  it('falls back to X when name is empty', () => {
    expect(getPfrUrl('abcXX00', '')).toBe(
      'https://www.pro-football-reference.com/players/X/abcXX00.htm',
    );
  });
});

describe('getPlayerDisplayAccent', () => {
  const base = {
    accentColor: '#aabbcc',
    logoUrl: 'logo.png',
    yearDraftBoard: false,
  };
  it('always returns drafting accent in yearDraftBoard mode', () => {
    expect(
      getPlayerDisplayAccent({
        ...base,
        yearDraftBoard: true,
        departed: true,
        currentTeam: 'NYJ',
      }),
    ).toBe('#aabbcc');
  });
  it('returns the drafting accent when not departed', () => {
    expect(
      getPlayerDisplayAccent({
        ...base,
        departed: false,
        currentTeam: undefined,
      }),
    ).toBe('#aabbcc');
  });
  it('returns FA grey when departed without a current team', () => {
    expect(
      getPlayerDisplayAccent({
        ...base,
        departed: true,
        currentTeam: undefined,
      }),
    ).toBe('#6b7280');
  });
  it('returns the current team accent when departed with a known team', () => {
    expect(
      getPlayerDisplayAccent({ ...base, departed: true, currentTeam: 'KC' }),
    ).toBe(TEAM_COLORS['KC']);
  });
  it('falls back to drafting accent for unknown current team', () => {
    expect(
      getPlayerDisplayAccent({ ...base, departed: true, currentTeam: 'ZZZ' }),
    ).toBe('#aabbcc');
  });
});

describe('getPlayerDisplayLogo', () => {
  const base = {
    accentColor: '#aabbcc',
    logoUrl: 'logo.png',
    yearDraftBoard: false,
  };
  it('keeps the drafting logo in yearDraftBoard mode', () => {
    expect(
      getPlayerDisplayLogo({
        ...base,
        yearDraftBoard: true,
        departed: true,
        currentTeam: 'NYJ',
      }),
    ).toBe('logo.png');
  });
  it('returns the drafting logo when not departed', () => {
    expect(
      getPlayerDisplayLogo({
        ...base,
        departed: false,
        currentTeam: undefined,
      }),
    ).toBe('logo.png');
  });
  it('returns empty string for free-agent departed', () => {
    expect(
      getPlayerDisplayLogo({ ...base, departed: true, currentTeam: undefined }),
    ).toBe('');
  });
  it('returns current team logo when departed to a known team', () => {
    expect(
      getPlayerDisplayLogo({ ...base, departed: true, currentTeam: 'KC' }),
    ).toBe(getTeamLogoUrl('KC'));
  });
});
