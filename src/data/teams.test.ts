import { describe, it, expect } from 'vitest';
import { TEAMS } from './teams';

describe('TEAMS', () => {
  it('has 32 teams', () => {
    expect(TEAMS).toHaveLength(32);
  });

  it('includes KC with correct data', () => {
    const kc = TEAMS.find((t) => t.id === 'KC');
    expect(kc).toBeDefined();
    expect(kc?.name).toBe('Kansas City Chiefs');
    expect(kc?.abbreviation).toBe('KC');
  });

  it('each team has id, name, abbreviation', () => {
    for (const team of TEAMS) {
      expect(typeof team.id).toBe('string');
      expect(team.id.length).toBeGreaterThan(0);
      expect(typeof team.name).toBe('string');
      expect(typeof team.abbreviation).toBe('string');
    }
  });
});
