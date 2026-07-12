import type { CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { DraftPick } from '../../types';
import { getPlayerRole } from '../../lib/getPlayerRole';
import { buildPlayerHref } from '../../lib/playerBackTarget';
import {
  TeamLogo,
  PlayerAvatar,
  RoleChip,
  teamColor,
} from '../design/Primitives';
import { isDeparted, getCurrentTeam } from '../../lib/playerJourney';

export interface PlayerWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

export interface PlayerListProps {
  picks: PlayerWithDraftYear[];
  teamId: string;
  draftingTeamOnly?: boolean;
  brandByDraftingTeam?: boolean;
  yearDraftBoard?: boolean;
}

export function PlayerList({
  picks,
  teamId,
  draftingTeamOnly = false,
  brandByDraftingTeam = false,
}: PlayerListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const origin = location.pathname + location.search;
  if (picks.length === 0) {
    return (
      <p
        className="mono"
        style={{
          color: 'var(--ink-3)',
          fontSize: 12,
          padding: '10px 0',
        }}
      >
        No picks to show.
      </p>
    );
  }
  return (
    <table className="roster-table">
      <tbody>
        {picks.map(({ pick, draftYear }) => {
          const brandTeam = brandByDraftingTeam ? pick.teamId : teamId;
          const role = getPlayerRole(pick, { draftingTeamOnly });
          const departed = isDeparted(pick);
          // For departed players, surface the role they held for the drafting
          // team (retained seasons only) alongside the "Departed" marker.
          const draftingRole = getPlayerRole(pick, { draftingTeamOnly: true });
          const currentTeam = departed ? getCurrentTeam(pick) : undefined;
          const color = teamColor(brandTeam);

          return (
            <tr
              key={pick.playerId}
              style={
                {
                  ['--team' as never]: color,
                  opacity: departed ? 0.78 : 1,
                } as CSSProperties
              }
              onClick={() => navigate(buildPlayerHref(pick.playerId, origin))}
            >
              <td className="pick-tag" style={{ width: 64 }}>
                '{String(draftYear).slice(2)} R{pick.round}·{pick.overallPick}
              </td>
              <td style={{ width: 40 }}>
                <PlayerAvatar
                  teamId={brandTeam}
                  name={pick.playerName}
                  src={pick.headshotUrl}
                  size={28}
                />
              </td>
              <td style={{ width: 36 }}>
                <span className="pos-chip">{pick.position}</span>
              </td>
              <td style={{ fontWeight: 500 }}>
                {pick.playerName}
                {departed && currentTeam && (
                  <span
                    className="mono"
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      color: 'var(--ink-4)',
                    }}
                  >
                    → {currentTeam}
                  </span>
                )}
              </td>
              <td
                style={{
                  width: 36,
                  textAlign: 'right',
                  paddingRight: 6,
                }}
              >
                <TeamLogo teamId={brandTeam} size={20} ring={false} />
              </td>
              <td style={{ width: 170, textAlign: 'right' }}>
                {departed ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <RoleChip role={draftingRole} />
                    <RoleChip role="gone" />
                  </span>
                ) : (
                  <RoleChip role={role} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
