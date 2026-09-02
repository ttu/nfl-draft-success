import { normalizeDraftPosition } from './normalizeDraftPosition';

/**
 * Depth-chart-sized position groups for the current-roster view.
 *
 * Coarser than a raw position code and finer than `./positionUnit`'s three
 * sides of the ball: a roster reads as quarterbacks, then backs, then
 * receivers, and a page grouped by side of the ball would put a punter beside
 * a nose tackle.
 */
export type PositionGroupId =
  'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST' | 'OTHER';

/** Display order: offense, defense, special teams, then anything unrecognised. */
export const POSITION_GROUP_ORDER: PositionGroupId[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'DL',
  'LB',
  'DB',
  'ST',
  'OTHER',
];

export const POSITION_GROUP_LABELS: Record<PositionGroupId, string> = {
  QB: 'Quarterbacks',
  RB: 'Running backs',
  WR: 'Wide receivers',
  TE: 'Tight ends',
  OL: 'Offensive line',
  DL: 'Defensive line',
  LB: 'Linebackers',
  DB: 'Defensive backs',
  ST: 'Special teams',
  OTHER: 'Other',
};

const GROUP_BY_CODE: Record<string, PositionGroupId> = {
  QB: 'QB',
  RB: 'RB',
  FB: 'RB',
  WR: 'WR',
  TE: 'TE',
  OT: 'OL',
  G: 'OL',
  C: 'OL',
  OL: 'OL',
  IOL: 'OL',
  DE: 'DL',
  DT: 'DL',
  NT: 'DL',
  DL: 'DL',
  LB: 'LB',
  ILB: 'LB',
  MLB: 'LB',
  OLB: 'LB',
  EDGE: 'LB',
  CB: 'DB',
  S: 'DB',
  SS: 'DB',
  DB: 'DB',
  NB: 'DB',
  K: 'ST',
  P: 'ST',
  LS: 'ST',
};

/**
 * Group for a draft `position` code, aliases resolved first (`T` → `OT`,
 * `OG` → `G`, `FS` → `S`).
 *
 * An unrecognised code lands in `OTHER` rather than a side-of-ball catch-all:
 * `OL` and `DL` are codes the feed genuinely uses, so folding an unknown into
 * one of them would report a player as a lineman he may not be.
 */
export function getPositionGroup(position: string): PositionGroupId {
  const code = normalizeDraftPosition(position);
  return GROUP_BY_CODE[code] ?? 'OTHER';
}
