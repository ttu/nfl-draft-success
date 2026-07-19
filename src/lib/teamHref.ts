/**
 * Router-relative href for a team page, carrying the active year window so the
 * team view opens on the same range the user was looking at.
 */
export function buildTeamHref(
  teamId: string,
  window: { from: number; to: number },
): string {
  return `/${encodeURIComponent(teamId)}?from=${window.from}&to=${window.to}`;
}
