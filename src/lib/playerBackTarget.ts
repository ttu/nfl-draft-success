import type { Team } from '../types';

/** Breadcrumb back destination for the player detail view. */
export interface PlayerBackTarget {
  /** Human-readable label shown in the crumb, e.g. a team name or "Rankings". */
  label: string;
  /** Path to navigate to when the crumb is activated. */
  to: string;
}

/**
 * Builds the player detail href, recording where the user came from in a `ref`
 * query param so the detail view's back crumb can return there. Pass the
 * origin as `pathname + search` (e.g. `/TB?from=2021&to=2026`).
 */
export function buildPlayerHref(playerId: string, ref?: string | null): string {
  const base = `/player/${encodeURIComponent(playerId)}`;
  if (!ref) return base;
  return `${base}?ref=${encodeURIComponent(ref)}`;
}

/** Primary-nav tab that owns the player detail view, based on its origin. */
export type PlayerOriginTab = 'rankings' | 'team' | 'year' | 'pos';

/** Classified origin of a player detail `ref`, before team-id validation. */
type RefOrigin =
  | { kind: 'landing' }
  | { kind: 'year' }
  | { kind: 'position' }
  | { kind: 'team'; teamId: string }
  | { kind: 'unknown' };

/**
 * Parses a player detail `ref` (a `pathname + search` origin) into a coarse
 * origin category. Team ids are returned verbatim, not validated here — callers
 * check membership against their team list so this stays list-agnostic.
 */
function classifyRefOrigin(ref: string): RefOrigin {
  const [pathname] = ref.split('?');
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return { kind: 'landing' };
  if (segments[0] === 'year') return { kind: 'year' };
  if (segments[0] === 'position') return { kind: 'position' };
  if (segments.length === 1) return { kind: 'team', teamId: segments[0] };
  return { kind: 'unknown' };
}

/**
 * Maps the player detail's `ref` origin to the primary-nav tab that should stay
 * highlighted while the player is open, so the masthead reflects where the user
 * came from (Position, Draft Year, a team page, or the rankings landing) rather
 * than always defaulting to Team.
 */
export function resolvePlayerOriginTab(
  ref: string | null | undefined,
  teams: Pick<Team, 'id'>[],
): PlayerOriginTab {
  if (!ref) return 'rankings';

  const origin = classifyRefOrigin(ref);
  switch (origin.kind) {
    case 'year':
      return 'year';
    case 'position':
      return 'pos';
    case 'team':
      return teams.some((t) => t.id === origin.teamId) ? 'team' : 'rankings';
    default:
      return 'rankings';
  }
}

/**
 * Resolves the player detail back crumb from the `ref` origin param. When the
 * origin is a team page the crumb points back to that team (labelled with its
 * name); year and position origins keep their view label. Anything missing or
 * unrecognized falls back to the rankings landing view.
 */
export function resolvePlayerBackTarget(
  ref: string | null | undefined,
  teams: Pick<Team, 'id' | 'name'>[],
  fallback: { from: number; to: number },
): PlayerBackTarget {
  const rankings: PlayerBackTarget = {
    label: 'Rankings',
    to: `/?from=${fallback.from}&to=${fallback.to}`,
  };
  if (!ref) return rankings;

  const origin = classifyRefOrigin(ref);
  switch (origin.kind) {
    case 'landing':
      return { label: 'Rankings', to: ref };
    case 'year':
      return { label: 'Draft Year', to: ref };
    case 'position':
      return { label: 'Position', to: ref };
    case 'team': {
      const team = teams.find((t) => t.id === origin.teamId);
      if (team) return { label: team.name, to: ref };
      return rankings;
    }
    default:
      return rankings;
  }
}
