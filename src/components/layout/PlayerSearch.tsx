import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DRAFT_YEAR_BOUNDS } from '../../lib/draftYearBounds';
import { loadDataForYears, loadFreeAgentsForYears } from '../../lib/loadData';
import { generateYearArray } from '../../lib/yearRange';
import type { Acquisition } from '../../types';

const MAX_RESULTS = 8;

/**
 * Masthead name search across every draft class. Classes load on first focus
 * (cached by `loadData`), so the box costs nothing until someone uses it.
 * Undrafted free agents are included; their file failing to load costs only
 * them, not the drafted results.
 */
export function PlayerSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Acquisition[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    if (picks) return;
    const years = generateYearArray(
      DRAFT_YEAR_BOUNDS.min,
      DRAFT_YEAR_BOUNDS.max,
    );
    Promise.all([
      loadDataForYears(years),
      loadFreeAgentsForYears(years).catch(() => []),
    ])
      .then(([drafted, undrafted]) => {
        setFailed(false);
        setPicks([
          ...drafted.flatMap((c) => c.picks),
          ...undrafted.flatMap((c) => c.freeAgents),
        ]);
      })
      .catch(() => setFailed(true));
  };

  const needle = query.trim().toLowerCase();
  const results =
    picks && needle
      ? picks
          .filter((p) => p.playerName.toLowerCase().includes(needle))
          .slice(0, MAX_RESULTS)
      : [];

  const open = (p: Acquisition) => {
    setQuery('');
    navigate(`/player/${p.playerId}`);
  };

  return (
    <div className="mast__search">
      <input
        type="search"
        className="mast__search-input"
        placeholder="Search players…"
        aria-label="Search players"
        value={query}
        onFocus={load}
        onChange={(e) => {
          setQuery(e.target.value);
          load();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) open(results[0]);
          if (e.key === 'Escape') setQuery('');
        }}
      />
      {needle && (
        <ul className="mast__search-results" role="listbox">
          {failed && (
            <li className="mast__search-empty">Search failed to load.</li>
          )}
          {!failed && !picks && (
            <li className="mast__search-empty">Loading…</li>
          )}
          {picks && results.length === 0 && (
            <li className="mast__search-empty">No players found.</li>
          )}
          {results.map((p) => (
            <li key={p.playerId} role="option" aria-selected={false}>
              <button type="button" onClick={() => open(p)}>
                <span>{p.playerName}</span>
                <span className="mast__search-meta">
                  {p.position} · {p.teamId} · {p.draftYear}{' '}
                  {'round' in p ? `R${p.round}` : 'undrafted'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
