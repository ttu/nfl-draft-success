import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DRAFT_YEAR_BOUNDS } from '../../lib/draftYearBounds';
import { loadDataForYears, loadFreeAgentsForYears } from '../../lib/loadData';
import { buildPlayerHref } from '../../lib/playerBackTarget';
import { generateYearArray } from '../../lib/yearRange';
import type { Acquisition } from '../../types';

const MAX_RESULTS = 8;

/**
 * Masthead name search across every draft class. Classes load on first focus
 * (cached by `loadData`), so the box costs nothing until someone uses it.
 * Undrafted free agents are included; their file failing to load costs only
 * them, not the drafted results.
 *
 * Keyboard: an ARIA combobox. Up/Down move a highlight through the results,
 * Enter opens the highlighted one (or the first when none is), Escape clears.
 */
export function PlayerSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [picks, setPicks] = useState<Acquisition[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Highlighted result index; -1 means none, so Enter falls back to the first. */
  const [active, setActive] = useState(-1);
  const listId = useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

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
    setActive(-1);
    // The current page is the origin, so the player page gets a back crumb
    // and keeps the reader's year range.
    navigate(buildPlayerHref(p.playerId, location.pathname + location.search));
  };

  const expanded = needle !== '';
  const highlighted = active >= 0 && active < results.length ? active : -1;

  return (
    <div className="mast__search">
      <input
        type="search"
        role="combobox"
        className="mast__search-input"
        placeholder="Search players…"
        aria-label="Search players"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          highlighted >= 0 ? optionId(highlighted) : undefined
        }
        value={query}
        onFocus={load}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          load();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && results.length > 0) {
            e.preventDefault();
            setActive(Math.min(highlighted + 1, results.length - 1));
          } else if (e.key === 'ArrowUp' && results.length > 0) {
            e.preventDefault();
            setActive(Math.max(highlighted - 1, 0));
          } else if (e.key === 'Enter') {
            const target = results[highlighted >= 0 ? highlighted : 0];
            if (target) open(target);
          } else if (e.key === 'Escape') {
            setQuery('');
            setActive(-1);
          }
        }}
      />
      {expanded && (
        <ul
          id={listId}
          className="mast__search-results"
          role="listbox"
          aria-label="Matching players"
        >
          {failed && (
            <li className="mast__search-empty">Search failed to load.</li>
          )}
          {!failed && !picks && (
            <li className="mast__search-empty">Loading…</li>
          )}
          {picks && results.length === 0 && (
            <li className="mast__search-empty">No players found.</li>
          )}
          {results.map((p, i) => (
            <li
              key={p.playerId}
              id={optionId(i)}
              role="option"
              aria-selected={i === highlighted}
              className={i === highlighted ? 'is-active' : undefined}
            >
              <button
                type="button"
                onClick={() => open(p)}
                onMouseEnter={() => setActive(i)}
              >
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
