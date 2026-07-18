import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { activateOnKey } from './activateOnKey';

function keyEvent(key: string): KeyboardEvent<HTMLElement> {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

describe('activateOnKey', () => {
  it('fires the handler on Enter', () => {
    const onActivate = vi.fn();
    activateOnKey(onActivate)(keyEvent('Enter'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('fires the handler on Space', () => {
    const onActivate = vi.fn();
    activateOnKey(onActivate)(keyEvent(' '));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('prevents default so Space does not scroll the page', () => {
    const event = keyEvent(' ');
    activateOnKey(vi.fn())(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys and leaves their default behaviour intact', () => {
    const onActivate = vi.fn();
    const event = keyEvent('Tab');
    activateOnKey(onActivate)(event);
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
