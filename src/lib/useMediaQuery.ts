import { useCallback, useSyncExternalStore } from 'react';

/**
 * The app's mobile breakpoint. Kept in step with the `max-width: 900px` block
 * in App.css — components that branch on layout must agree with the stylesheet
 * about where "mobile" starts.
 */
export const MOBILE_QUERY = '(max-width: 900px)';

/** True while the viewport matches `query`. Re-renders when that flips. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  // Read straight from matchMedia rather than caching in state: the value is
  // available synchronously on the very first render, so the mobile hero paints
  // in the first pass instead of flashing the desktop one and swapping.
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True on phone-width viewports. Used where mobile needs different *content*
 * rather than different styling — a shorter hero, a ranked list that starts
 * below the podium — which CSS alone cannot express without shipping both.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
