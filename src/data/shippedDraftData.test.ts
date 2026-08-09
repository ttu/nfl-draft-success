import { describe, it, expect } from 'vitest';
import { TEAMS } from './teams';
import type { DraftClass } from '../types';

/**
 * Guards the shipped draft JSON against franchise codes nothing can render.
 *
 * `normalizeNflverseTeam` maps each feed's spelling onto a canonical id, but a
 * code it has never seen passes straight through and lands in the data as a
 * team with no colour, no logo and no page — the way `SDG` did when the
 * 2013–2016 classes were added. A per-code unit test only catches the spellings
 * someone already thought of; this catches whatever the feed actually shipped.
 */
describe('shipped draft data', () => {
  const classes = Object.entries(
    import.meta.glob<DraftClass>('../../public/data/draft-*.json', {
      eager: true,
      import: 'default',
    }),
  );
  const knownTeamIds = new Set(TEAMS.map((t) => t.id));

  it('covers every draft class with a file', () => {
    expect(classes.length).toBeGreaterThan(0);
  });

  it.each(classes)('%s names only known franchises', (_file, draftClass) => {
    const unknown = new Set<string>();
    for (const pick of draftClass.picks) {
      if (!knownTeamIds.has(pick.teamId)) unknown.add(pick.teamId);
      for (const season of pick.seasons ?? []) {
        // Only set when the player left; this is where a departure lands, so an
        // unmapped code here sends him to a franchise that does not exist.
        if (season.currentTeam && !knownTeamIds.has(season.currentTeam)) {
          unknown.add(season.currentTeam);
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });
});
