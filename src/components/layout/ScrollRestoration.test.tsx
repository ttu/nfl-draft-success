import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from 'react-router-dom';
import { ScrollRestoration } from './ScrollRestoration';

/**
 * jsdom implements neither window.scrollTo nor real layout, so the scroll
 * offset is faked: scrollTo records the target and updates window.scrollY the
 * way a browser would, and dispatching 'scroll' stands in for the user
 * scrolling the page.
 */
function scrollTestPage(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  fireEvent.scroll(window);
}

describe('ScrollRestoration', () => {
  const originalScrollTo = window.scrollTo;
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn((_x: number, y: number) => {
      Object.defineProperty(window, 'scrollY', {
        value: y,
        configurable: true,
      });
    });
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  function BackButton() {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    );
  }

  function renderApp() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollRestoration />
        <Routes>
          <Route path="/" element={<Link to="/player/abc">Open player</Link>} />
          <Route path="/player/:playerId" element={<BackButton />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('starts a pushed route at the top of the page', () => {
    renderApp();
    // The visitor has scrolled down a long ranked list before picking a player.
    scrollTestPage(1200);
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('link', { name: 'Open player' }));

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('restores the previous offset when navigating back', () => {
    renderApp();
    scrollTestPage(1200);
    fireEvent.click(screen.getByRole('link', { name: 'Open player' }));
    scrollTo.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    // Back lands where the list was left, not at the top of it.
    expect(scrollTo).toHaveBeenCalledWith(0, 1200);
  });
});
