import { describe, it, expect } from 'vitest';
import {
  buildSeasonRecords,
  teamSuccessForWindow,
  type GamesCsvRow,
} from './teamSuccess';

/** Minimal games.csv row; only the fields the aggregation reads. */
function game(
  season: number,
  gameType: string,
  away: string,
  home: string,
  result: number | '',
): GamesCsvRow {
  return {
    season: String(season),
    game_type: gameType,
    away_team: away,
    home_team: home,
    result: result === '' ? '' : String(result),
  };
}

function seasonOf(
  records: ReturnType<typeof buildSeasonRecords>,
  teamId: string,
  year: number,
) {
  return records
    .find((t) => t.teamId === teamId)
    ?.seasons.find((s) => s.year === year);
}

describe('buildSeasonRecords', () => {
  it('records a regular-season win/loss/tie ledger per season', () => {
    const rows: GamesCsvRow[] = [
      game(2021, 'REG', 'MIA', 'BUF', 7), // BUF home, wins
      game(2021, 'REG', 'BUF', 'NE', -3), // BUF away, wins (home margin negative)
      game(2021, 'REG', 'KC', 'BUF', -10), // BUF home, loses
      game(2022, 'REG', 'NYG', 'BUF', 0), // BUF home, ties
    ];
    const records = buildSeasonRecords(rows, 2021, 2025);
    expect(seasonOf(records, 'BUF', 2021)).toMatchObject({
      wins: 2,
      losses: 1,
      ties: 0,
    });
    expect(seasonOf(records, 'BUF', 2022)).toMatchObject({
      wins: 0,
      losses: 0,
      ties: 1,
    });
  });

  it('ignores seasons outside the window and unplayed games', () => {
    const rows: GamesCsvRow[] = [
      game(2020, 'REG', 'MIA', 'BUF', 7), // before window
      game(2026, 'REG', 'MIA', 'BUF', 7), // after window
      game(2021, 'REG', 'MIA', 'BUF', ''), // unplayed
      game(2021, 'REG', 'NE', 'BUF', 3), // BUF home win — only counted game
    ];
    const records = buildSeasonRecords(rows, 2021, 2025);
    expect(seasonOf(records, 'BUF', 2020)).toBeUndefined();
    expect(seasonOf(records, 'BUF', 2026)).toBeUndefined();
    expect(seasonOf(records, 'BUF', 2021)).toMatchObject({
      wins: 1,
      losses: 0,
    });
  });

  it('flags a postseason appearance for both teams', () => {
    const rows: GamesCsvRow[] = [game(2021, 'WC', 'NE', 'BUF', 30)];
    const records = buildSeasonRecords(rows, 2021, 2025);
    expect(seasonOf(records, 'BUF', 2021)?.madePlayoffs).toBe(true);
    expect(seasonOf(records, 'NE', 2021)?.madePlayoffs).toBe(true);
  });

  it('records Super Bowl appearance and win for the right team', () => {
    // 2024 SB: KC @ PHI, result 18 → home (PHI) won by 18.
    const records = buildSeasonRecords(
      [game(2024, 'SB', 'KC', 'PHI', 18)],
      2024,
      2024,
    );
    expect(seasonOf(records, 'PHI', 2024)).toMatchObject({
      reachedSB: true,
      wonSB: true,
      madePlayoffs: true,
    });
    expect(seasonOf(records, 'KC', 2024)).toMatchObject({
      reachedSB: true,
      wonSB: false,
    });
  });

  it('normalizes nflverse franchise codes to canonical team ids', () => {
    const records = buildSeasonRecords(
      [game(2021, 'REG', 'SF', 'LA', 3)],
      2021,
      2021,
    ); // LA → LAR
    const ids = records.map((t) => t.teamId);
    expect(ids).toContain('LAR');
    expect(ids).not.toContain('LA');
  });
});

describe('teamSuccessForWindow', () => {
  const rows: GamesCsvRow[] = [
    game(2021, 'REG', 'MIA', 'BUF', 7), // 2021: 1-0
    game(2022, 'REG', 'MIA', 'BUF', 7), // 2022: win
    game(2022, 'REG', 'KC', 'BUF', -10), // 2022: loss → 2022 1-1
    game(2022, 'WC', 'NE', 'BUF', 3), // 2022 playoffs
    game(2023, 'REG', 'NYG', 'BUF', 0), // 2023: tie
  ];
  const records = buildSeasonRecords(rows, 2021, 2025);

  it('combines the regular-season record across the window', () => {
    // 2021–2023: 2 wins, 1 loss, 1 tie over 4 games → (2 + 0.5) / 4.
    const buf = teamSuccessForWindow(records, 2021, 2023).find(
      (t) => t.teamId === 'BUF',
    );
    expect(buf).toMatchObject({ wins: 2, losses: 1, ties: 1 });
    expect(buf?.winPct).toBeCloseTo(2.5 / 4, 5);
  });

  it('counts playoff appearances as seasons within the selected window', () => {
    expect(
      teamSuccessForWindow(records, 2021, 2023).find((t) => t.teamId === 'BUF')
        ?.playoffApps,
    ).toBe(1);
  });

  it('narrows the aggregate when the window excludes seasons', () => {
    // Only 2021 in range: a single win, no playoff appearance.
    const buf = teamSuccessForWindow(records, 2021, 2021).find(
      (t) => t.teamId === 'BUF',
    );
    expect(buf).toMatchObject({ wins: 1, losses: 0, playoffApps: 0 });
    expect(buf?.winPct).toBe(1);
  });

  it('omits teams with no played seasons in the window', () => {
    expect(teamSuccessForWindow(records, 2025, 2025)).toEqual([]);
  });
});
