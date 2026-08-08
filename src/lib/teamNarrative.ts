import type { YearScore } from './getScoreByYear';

/**
 * The signals behind a team's Summary-card read. Counts rather than rates,
 * because the copy cites them ("17 of 63"); `getRollingDraftScore` already
 * tallies both, so the definition of a core starter stays in one place.
 */
export interface TeamNarrativeInput {
  coreStarterCount: number;
  retainedCount: number;
  /** Picks with at least one season row — the denominator for both counts. */
  scoredPickCount: number;
  /** Mean pick score above draft-slot expectation. */
  overSlot: number;
  /** Per-class scores, ascending; classes awaiting data are skipped. */
  scoreByYear: YearScore[];
}

/**
 * Band thresholds, cut from the league's real distribution over the loaded
 * span rather than from an imagined 0–1 scale. The core-starter rate tops out
 * at 0.35 league-wide and retention at 0.48, so a threshold above those is
 * unreachable — the defect this module replaces had its top band at 0.40 and
 * never once fired. `teamNarrative.test.ts` guards every threshold against the
 * measured range; recalibrate both together.
 */
export const CORE_BANDS = { high: 0.27, mid: 0.2 } as const;
export const RETENTION_BANDS = { high: 0.42, mid: 0.33 } as const;

/**
 * Over slot is positive for all but a handful of teams (league p25 is +0.93),
 * so "beat their slot" carries no information on its own. Only the tails are
 * worth a sentence; between them the beat stays silent.
 */
export const CAPITAL_BANDS = { high: 5.5, low: 0.9 } as const;

/** Points of class-score swing worth calling a direction. */
export const TRAJECTORY_BANDS = { rising: 5, falling: -5 } as const;

type Band = 'high' | 'mid' | 'low';

function bandFor(
  value: number,
  thresholds: { high: number; mid: number },
): Band {
  if (value >= thresholds.high) return 'high';
  if (value >= thresholds.mid) return 'mid';
  return 'low';
}

/**
 * How a team's hit rate and its hold rate read together. Rows are the core
 * band, columns the retention band; the pairing is what makes two teams with
 * the same hit rate read differently.
 */
const PRODUCTION_CLAUSES: Record<Band, Record<Band, string>> = {
  high: {
    high: 'this team both hits and holds',
    mid: 'this team produces starters at an above-average clip',
    low: 'this team finds starters and then lets them go',
  },
  mid: {
    high: 'a modest hit rate, but it keeps who it finds',
    mid: 'a steady, unspectacular run',
    low: 'middling returns and heavy turnover',
  },
  low: {
    high: 'the picks stay, without many of them earning big roles',
    mid: 'a lean stretch — few picks settle into starter snaps',
    low: 'little has stuck, on the field or on the roster',
  },
};

/** What the team's picks produced, and how much of it is still around. */
function productionBeat(input: TeamNarrativeInput): string | null {
  const { coreStarterCount, retainedCount, scoredPickCount } = input;
  if (scoredPickCount === 0) return null;

  const core = bandFor(coreStarterCount / scoredPickCount, CORE_BANDS);
  const retention = bandFor(retainedCount / scoredPickCount, RETENTION_BANDS);

  return (
    `${coreStarterCount} of ${scoredPickCount} scored picks have reached ` +
    `core-starter snaps and ${retainedCount} are still on the roster — ` +
    `${PRODUCTION_CLAUSES[core][retention]}.`
  );
}

/** Signed over-slot value with a true minus sign, matching `formatOverSlot`. */
function formatSigned(value: number): string {
  const rounded = value.toFixed(1);
  return value < 0 ? `−${Math.abs(value).toFixed(1)}` : `+${rounded}`;
}

/** Whether draft position explains the production, or the picks beat it. */
function capitalBeat({
  overSlot,
  scoredPickCount,
}: TeamNarrativeInput): string | null {
  // Over slot is a mean across scored picks; with none, its zero is an absence
  // of evidence rather than a shortfall, and must not be banded as one.
  if (scoredPickCount === 0) return null;
  if (overSlot >= CAPITAL_BANDS.high) {
    return (
      `Those returns were earned rather than bought: at ${formatSigned(overSlot)} ` +
      'over slot, the picks outplayed the draft positions they came from.'
    );
  }
  if (overSlot < CAPITAL_BANDS.low) {
    return (
      `At ${formatSigned(overSlot)} over slot, the picks have returned less ` +
      'than their draft positions predicted.'
    );
  }
  return null;
}

/** Where the classes are heading: recent two against everything before them. */
function trajectoryBeat({ scoreByYear }: TeamNarrativeInput): string | null {
  const scored = scoreByYear.filter((y) => y.hasData);
  if (scored.length < 3) return null;

  const recent = scored.slice(-2);
  const earlier = scored.slice(0, -2);
  const mean = (years: YearScore[]) =>
    years.reduce((sum, y) => sum + y.score, 0) / years.length;
  const delta = mean(recent) - mean(earlier);

  if (delta >= TRAJECTORY_BANDS.rising) {
    return 'The two most recent classes score better than what came before them — the trend is rising.';
  }
  if (delta <= TRAJECTORY_BANDS.falling) {
    return 'The two most recent classes score below what came before them — the trend is falling.';
  }
  return null;
}

/**
 * A team's Summary-card read, as one sentence per beat: what the picks
 * produced, whether draft capital explains it, and where the classes are
 * heading. Beats that have nothing to say return nothing rather than filler,
 * so a thin-data team gets a shorter read instead of a padded one.
 */
export function buildTeamNarrative(input: TeamNarrativeInput): string[] {
  return [
    productionBeat(input),
    capitalBeat(input),
    trajectoryBeat(input),
  ].filter((beat): beat is string => beat !== null);
}
