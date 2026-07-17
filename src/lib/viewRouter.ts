import { ActiveView } from '../types';

/** Decoded `/position/:position` route param, or `undefined` when not on that route. */
export function parsePositionParam(
  match: { params: { position?: string } } | null,
): { isPositionView: boolean; positionParam: string | undefined } {
  if (match == null) {
    return { isPositionView: false, positionParam: undefined };
  }
  const raw = match.params.position;
  return {
    isPositionView: true,
    positionParam: raw != null ? decodeURIComponent(raw) : undefined,
  };
}

/**
 * Selects the active high-level view from route/state signals. Routes are
 * mutually exclusive, and order matters: a `/year/:y` route wins over a
 * `/position/:p` route, which wins over a `/highlights` route, which wins over
 * a `/:teamId` route, which falls back to the team-rankings landing view.
 */
export function determineActiveView({
  isYearView,
  isPositionView,
  isHighlightsView = false,
  hasSelectedTeam,
}: {
  isYearView: boolean;
  isPositionView: boolean;
  isHighlightsView?: boolean;
  hasSelectedTeam: boolean;
}): ActiveView {
  if (isYearView) return ActiveView.DraftYears;
  if (isPositionView) return ActiveView.Position;
  if (isHighlightsView) return ActiveView.Highlights;
  if (hasSelectedTeam) return ActiveView.TeamDetail;
  return ActiveView.TeamRankings;
}

/** True when the route year param is a valid integer within bounds. */
export function isRouteYearValid(
  draftYearParam: string | undefined,
  bounds: { min: number; max: number },
): boolean {
  if (draftYearParam == null) return false;
  const parsed = parseInt(draftYearParam, 10);
  return (
    Number.isInteger(parsed) && parsed >= bounds.min && parsed <= bounds.max
  );
}
