import { describe, expect, it } from 'vitest';
import { accumulateReserveTeams, accumulateReserveWeeks } from './reserveWeeks';

const row = (o: Partial<Record<string, string>>) => ({
  gsis_id: '00-0034790',
  status: 'RES',
  status_description_abbr: 'R01',
  game_type: 'REG',
  week: '1',
  team: 'ARI',
  ...o,
});

describe('accumulateReserveWeeks', () => {
  it('collects distinct weeks per player', () => {
    const got = accumulateReserveWeeks([
      row({ week: '1' }),
      row({ week: '2' }),
      row({ week: '2' }), // duplicate week must not appear twice
    ]);
    expect(got.get('00-0034790')).toEqual(new Set([1, 2]));
  });

  it('counts RES, RSR, PUP and NON as reserve', () => {
    // RSR matters: Tyler Eifert 2014 and Alec Ogletree 2015 carry it, not RES.
    for (const status of ['RES', 'RSR', 'PUP', 'NON']) {
      const got = accumulateReserveWeeks([row({ status })]);
      expect(got.get('00-0034790'), status).toEqual(new Set([1]));
    }
  });

  it('ignores active and practice-squad rows', () => {
    for (const status of ['ACT', 'INA', 'DEV', 'CUT']) {
      const got = accumulateReserveWeeks([row({ status })]);
      expect(got.get('00-0034790'), status).toBeUndefined();
    }
  });

  it.each(['R62', 'R59'])(
    'excludes %s, which is COVID-19 reserve rather than injury',
    (code) => {
      const got = accumulateReserveWeeks([
        row({ week: '1', status_description_abbr: code }),
        row({ week: '2', status_description_abbr: 'R01' }),
      ]);
      // Week 1 is the excluded COVID row; only week 2 survives.
      expect(got.get('00-0034790')).toEqual(new Set([2]));
    },
  );

  it('ignores preseason rows', () => {
    const got = accumulateReserveWeeks([row({ game_type: 'PRE' })]);
    expect(got.get('00-0034790')).toBeUndefined();
  });

  it('counts postseason weeks', () => {
    const got = accumulateReserveWeeks([
      row({ week: '19', game_type: 'POST' }),
    ]);
    expect(got.get('00-0034790')).toEqual(new Set([19]));
  });

  it('skips rows with no gsis_id or an unusable week', () => {
    const got = accumulateReserveWeeks([
      row({ gsis_id: '' }),
      row({ gsis_id: '00-0000001', week: '' }),
      row({ gsis_id: '00-0000002', week: '0' }),
    ]);
    expect(got.size).toBe(0);
  });
});

describe('accumulateReserveTeams', () => {
  it('names the team a player sat out for', () => {
    const got = accumulateReserveTeams([
      row({ week: '1' }),
      row({ week: '2' }),
    ]);
    expect(got.get('00-0034790')).toBe('ARI');
  });

  it('picks the team he spent the most reserve weeks with', () => {
    // Waived off IR and claimed, which happens: the season belongs to
    // whichever roster carried him longest, the same rule snaps use.
    const got = accumulateReserveTeams([
      row({ week: '1', team: 'ARI' }),
      row({ week: '2', team: 'NO' }),
      row({ week: '3', team: 'NO' }),
    ]);
    expect(got.get('00-0034790')).toBe('NO');
  });

  it('reads the same rows as the week count, and no others', () => {
    const got = accumulateReserveTeams([
      row({ status: 'ACT' }),
      row({ status_description_abbr: 'R62' }),
      row({ game_type: 'PRE' }),
      row({ gsis_id: '' }),
      row({ week: '0' }),
    ]);
    expect(got.size).toBe(0);
  });

  it('skips rows with no team', () => {
    const got = accumulateReserveTeams([row({ team: '' })]);
    expect(got.size).toBe(0);
  });
});
