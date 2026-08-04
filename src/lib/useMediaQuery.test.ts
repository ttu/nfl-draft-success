import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useMediaQuery';
import {
  DESKTOP_WIDTH,
  MOBILE_WIDTH,
  setViewportWidth,
} from '../test/viewport';

describe('useIsMobile', () => {
  it('reports the current viewport on the first render', () => {
    setViewportWidth(MOBILE_WIDTH);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);

    setViewportWidth(DESKTOP_WIDTH);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('re-renders when the viewport crosses the breakpoint', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => setViewportWidth(MOBILE_WIDTH));
    expect(result.current).toBe(true);

    act(() => setViewportWidth(DESKTOP_WIDTH));
    expect(result.current).toBe(false);
  });
});
