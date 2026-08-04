import { describe, it, expect } from 'vitest';
import { teamNickname } from './teamNickname';
import { TEAMS } from '../data/teams';

describe('teamNickname', () => {
  it('drops the city from a full team name', () => {
    expect(teamNickname('Detroit Lions')).toBe('Lions');
    expect(teamNickname('Tampa Bay Buccaneers')).toBe('Buccaneers');
    expect(teamNickname('New York Giants')).toBe('Giants');
  });

  it('leaves a bare nickname alone', () => {
    expect(teamNickname('Lions')).toBe('Lions');
  });

  it('yields a single word for every franchise', () => {
    for (const team of TEAMS) {
      expect(teamNickname(team.name)).not.toMatch(/\s/);
    }
  });
});
