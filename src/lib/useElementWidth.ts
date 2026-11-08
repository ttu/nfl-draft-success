import { useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's rendered content width. Null until first measured, and
 * stays null where ResizeObserver is unavailable (jsdom), so callers fall back
 * to their design size.
 */
export function useElementWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
