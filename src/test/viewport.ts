/**
 * jsdom ships no `window.matchMedia`, so anything that branches on the mobile
 * breakpoint would throw in tests. This installs a minimal width-backed
 * implementation and lets a test choose the viewport width.
 *
 * Only `(max-width: Npx)` and `(min-width: Npx)` are understood — the only
 * forms the app asks about. Anything else throws rather than quietly answering
 * `false`, which would make a broken query look like a passing test.
 */

export const DESKTOP_WIDTH = 1280;
export const MOBILE_WIDTH = 390;

let currentWidth = DESKTOP_WIDTH;
const listeners = new Set<() => void>();

/**
 * Sets the viewport width every `matchMedia` query is evaluated against and
 * notifies live listeners. Call it *before* rendering where possible; changing
 * it after a render updates React state and must be wrapped in `act`.
 */
export function setViewportWidth(width: number): void {
  currentWidth = width;
  for (const notify of [...listeners]) notify();
}

function evaluate(query: string): boolean {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (max) return currentWidth <= Number(max[1]);
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (min) return currentWidth >= Number(min[1]);
  throw new Error(`Unsupported media query in tests: ${query}`);
}

export function installMatchMedia(): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      media: query,
      get matches() {
        return evaluate(query);
      },
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      // Deprecated API, still called by some libraries.
      addListener: (listener: () => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
