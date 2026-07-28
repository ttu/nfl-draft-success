import { useState } from 'react';
import {
  useLocation,
  useNavigationType,
  type NavigationType,
} from 'react-router-dom';

/** The entry to remember as "where we came from" after a navigation. */
function resolvePrevious(
  navigationType: NavigationType,
  cameFrom: string,
  previous: string | null,
): string | null {
  // A replace rewrites the current entry in place (the app normalizes its own
  // query params that way), leaving the entry before it untouched.
  if (navigationType === 'REPLACE') return previous;
  if (navigationType === 'PUSH') return cameFrom;
  // After a back or forward, what precedes the restored entry is unknowable
  // from here, so claim nothing.
  return null;
}

/**
 * Tracks the history entry visited immediately before the current one, as
 * `pathname + search`, or null when there is nothing dependable to go back to.
 *
 * Lets a back affordance retrace a step for real — `navigate(-1)`, which
 * restores the scroll offset the entry was left at — instead of pushing a fresh
 * entry that lands at the top of the page.
 */
export function usePreviousLocation(): string | null {
  const location = useLocation();
  const navigationType = useNavigationType();
  const current = location.pathname + location.search;
  const [tracked, setTracked] = useState<{
    entry: string;
    previous: string | null;
  }>({ entry: current, previous: null });

  // Adjusted during render rather than in an effect: a crumb rendered on the
  // very first render after a push has to already know where back leads.
  if (tracked.entry !== current) {
    const previous = resolvePrevious(
      navigationType,
      tracked.entry,
      tracked.previous,
    );
    setTracked({ entry: current, previous });
    return previous;
  }

  return tracked.previous;
}
