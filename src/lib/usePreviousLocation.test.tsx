import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { usePreviousLocation } from './usePreviousLocation';

/** Renders the tracked previous entry, plus controls to navigate around. */
function Probe() {
  const previous = usePreviousLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="previous">{previous ?? 'none'}</output>
      <button type="button" onClick={() => navigate('/player/abc?ref=%2FBUF')}>
        push player
      </button>
      <button
        type="button"
        onClick={() =>
          navigate('/player/abc?ref=%2FBUF&from=2021', { replace: true })
        }
      >
        normalize query
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </>
  );
}

function renderProbe() {
  render(
    <MemoryRouter initialEntries={['/BUF?from=2021&to=2025']}>
      <Probe />
    </MemoryRouter>,
  );
}

const previous = () => screen.getByTestId('previous').textContent;

describe('usePreviousLocation', () => {
  it('has no previous entry on the first location of a session', () => {
    renderProbe();
    expect(previous()).toBe('none');
  });

  it('reports the entry a push came from', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'push player' }));
    expect(previous()).toBe('/BUF?from=2021&to=2025');
  });

  it('keeps the pushed-from entry across a replace', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'push player' }));
    // The app rewrites its own query params in place; that must not be mistaken
    // for a step in the journey.
    fireEvent.click(screen.getByRole('button', { name: 'normalize query' }));

    expect(previous()).toBe('/BUF?from=2021&to=2025');
  });

  it('forgets the previous entry after back or forward', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'push player' }));
    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    // What precedes the restored entry is unknowable, so claim nothing.
    expect(previous()).toBe('none');
  });
});
