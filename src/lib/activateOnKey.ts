import type { KeyboardEvent } from 'react';

/**
 * Keyboard handler for elements made clickable via `role="button"`.
 *
 * Native buttons activate on Enter and Space; elements carrying only an
 * `onClick` do not, leaving keyboard users unable to reach them. Space is
 * prevented from its default page scroll when it activates.
 */
export function activateOnKey(onActivate: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivate();
  };
}
