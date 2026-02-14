import type { Team } from '../types';
import { TEAMS } from '../data/teams';

export interface TeamSelectorProps {
  value: string;
  onChange: (teamId: string) => void;
}

export function TeamSelector({ value, onChange }: TeamSelectorProps) {
  return (
    <select
      role="combobox"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Select team"
    >
      {TEAMS.map((team: Team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
