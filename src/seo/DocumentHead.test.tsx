import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { DocumentHead } from './DocumentHead';

function canonical(): string | null {
  return (
    document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href') ?? null
  );
}

function renderAt(path: string, playerName?: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<DocumentHead playerName={playerName} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DocumentHead', () => {
  it('titles a team route after the team', () => {
    renderAt('/TB');
    expect(document.title).toBe(
      'Tampa Bay Buccaneers Draft Results | NFL Draft Success',
    );
    expect(canonical()).toBe('https://www.nfldraftsuccess.com/TB');
  });

  it('drops the year-range query from the canonical URL', () => {
    renderAt('/DET?from=2021&to=2025');
    expect(canonical()).toBe('https://www.nfldraftsuccess.com/DET');
  });

  it('follows a client-side navigation', () => {
    render(
      <MemoryRouter initialEntries={['/TB']}>
        <DocumentHead />
        <Link to="/year/2025">2025</Link>
      </MemoryRouter>,
    );
    expect(document.title).toBe(
      'Tampa Bay Buccaneers Draft Results | NFL Draft Success',
    );

    fireEvent.click(screen.getByRole('link', { name: '2025' }));

    expect(document.title).toBe(
      '2025 NFL Draft Class Results | NFL Draft Success',
    );
    expect(canonical()).toBe('https://www.nfldraftsuccess.com/year/2025');
  });

  it('retitles a player route once the player name arrives', () => {
    renderAt('/player/00-0036212');
    expect(document.title).toBe('Player Draft Profile | NFL Draft Success');
    renderAt('/player/00-0036212', 'Tristan Wirfs');
    expect(document.title).toBe(
      'Tristan Wirfs Draft Profile | NFL Draft Success',
    );
  });
});
