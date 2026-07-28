import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets the window scroll on navigation.
 *
 * Every route renders the same `AppContent`, so React Router never remounts a
 * page and the browser keeps whatever offset the previous view had — opening a
 * player from halfway down a ranked list dropped the visitor into the middle of
 * the player view. New destinations start at the top; back and forward return
 * to the offset that entry was left at, which is what makes returning to a long
 * list from a player usable.
 */
export function ScrollRestoration() {
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const offsets = useRef(new Map<string, number>());
  const activeKey = useRef(key);

  useEffect(() => {
    const remember = () =>
      offsets.current.set(activeKey.current, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, []);

  useLayoutEffect(() => {
    activeKey.current = key;
    const remembered = offsets.current.get(key);
    const isReturning = navigationType === 'POP' && remembered !== undefined;
    window.scrollTo(0, isReturning ? remembered : 0);
  }, [key, navigationType]);

  return null;
}
