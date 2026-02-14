import type { DraftPick, Role } from '../types';
import { getPlayerRole } from '../lib/getPlayerRole';

function formatRole(role: Role): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface PlayerWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

export interface PlayerListProps {
  picks: PlayerWithDraftYear[];
}

export function PlayerList({ picks }: PlayerListProps) {
  return (
    <ul role="list" aria-label="Draft picks">
      {picks.map(({ pick, draftYear }) => {
        const role = getPlayerRole(pick);
        return (
          <li key={`${pick.playerId}-${draftYear}`}>
            <span>
              {pick.playerName} · {draftYear} · {pick.position}
            </span>
            <span data-testid="role-badge">{formatRole(role)}</span>
          </li>
        );
      })}
    </ul>
  );
}
