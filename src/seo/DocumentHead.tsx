import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveRouteMeta } from './routeMeta';
import { applyRouteMetaToDocument } from './documentMeta';

/**
 * Keeps `<title>`, the canonical link and the share-card tags on the route.
 *
 * The pre-rendered document is already correct for the URL the browser loaded;
 * this covers everything after it. Every route renders the same `AppContent`,
 * so nothing remounts on navigation and the head would otherwise keep the
 * first page's metadata for the rest of the visit.
 */
export function DocumentHead({ playerName }: { playerName?: string }) {
  const { pathname } = useLocation();

  useEffect(() => {
    applyRouteMetaToDocument(resolveRouteMeta(pathname, { playerName }));
  }, [pathname, playerName]);

  return null;
}
