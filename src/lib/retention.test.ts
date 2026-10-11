import { describe, expect, it } from 'vitest';
import { resolveRetained } from './retention';

const base = {
  primaryTeam: '',
  injuryTeam: '',
  reserveTeam: '',
  teamId: 'NO',
  season: 2026,
};

describe('resolveRetained', () => {
  it('believes the snap feed over everything else', () => {
    expect(resolveRetained({ ...base, primaryTeam: 'NO' })).toBe(true);
    expect(
      resolveRetained({ ...base, primaryTeam: 'ARI', reserveTeam: 'NO' }),
    ).toBe(false);
  });

  it('falls back to the injury report when he took no snaps', () => {
    expect(resolveRetained({ ...base, injuryTeam: 'NO' })).toBe(true);
    expect(
      resolveRetained({ ...base, injuryTeam: 'ARI', reserveTeam: 'NO' }),
    ).toBe(false);
  });

  it('keeps a season lost to injured reserve with the team that carried him', () => {
    // Jordyn Tyson's rookie year: no snaps, and placing him on reserve took
    // him off the injury report, so the roster feed is the only witness left.
    expect(resolveRetained({ ...base, reserveTeam: 'NO' })).toBe(true);
  });

  it('reads a reserve stint elsewhere as the departure it is', () => {
    expect(resolveRetained({ ...base, reserveTeam: 'ARI' })).toBe(false);
  });

  it('prefers the reserve team to a guess from the adjacent seasons', () => {
    const playerSnaps = new Map([[2025, { primaryTeam: 'NO' }]]);

    expect(resolveRetained({ ...base, reserveTeam: 'ARI', playerSnaps })).toBe(
      false,
    );
  });

  it('infers retention from the seasons on either side when nothing names a team', () => {
    expect(
      resolveRetained({
        ...base,
        playerSnaps: new Map([[2025, { primaryTeam: 'NO' }]]),
      }),
    ).toBe(true);
    expect(
      resolveRetained({
        ...base,
        playerInjuries: new Map([[2027, { primaryTeam: 'NO' }]]),
      }),
    ).toBe(true);
    expect(
      resolveRetained({
        ...base,
        playerSnaps: new Map([[2025, { primaryTeam: 'ARI' }]]),
      }),
    ).toBe(false);
  });

  it('reads an unknown season as a departure, having nothing to go on', () => {
    expect(resolveRetained(base)).toBe(false);
  });

  it('takes absence from a roster feed that spoke as the departure it is', () => {
    // Anthony Barr's 2024: no snaps, no injury rows, no reserve weeks, and no
    // weekly-roster row anywhere in the league — he was out of football. The
    // guess below would copy 2023 and keep him a Viking for a year he never
    // played, charging the pick for it.
    expect(
      resolveRetained({
        ...base,
        rosteredThisSeason: false,
        playerSnaps: new Map([[2025, { primaryTeam: 'NO' }]]),
      }),
    ).toBe(false);
  });

  it('still infers when the roster feed never spoke for that season', () => {
    // Before 2016 there is no weekly-roster coverage to be absent from, so
    // silence there is not evidence and the inference stands.
    expect(
      resolveRetained({
        ...base,
        rosteredThisSeason: undefined,
        playerSnaps: new Map([[2025, { primaryTeam: 'NO' }]]),
      }),
    ).toBe(true);
  });

  it('infers as before for a player who is on a roster it cannot name', () => {
    expect(
      resolveRetained({
        ...base,
        rosteredThisSeason: true,
        playerSnaps: new Map([[2025, { primaryTeam: 'NO' }]]),
      }),
    ).toBe(true);
  });

  it('compares teams by their normalized name', () => {
    expect(
      resolveRetained({ ...base, teamId: 'LAR', reserveTeam: 'STL' }),
    ).toBe(true);
  });
});
