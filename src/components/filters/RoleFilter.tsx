import type { Role } from '../../types';
import { ALL_ROLES } from '../../lib/roleFilter';
import { formatRoleLabel } from '../../lib/roleDisplay';

export interface RoleFilterProps {
  value: Set<Role>;
  onChange: (value: Set<Role>) => void;
}

export function RoleFilter({ value, onChange }: RoleFilterProps) {
  const handleToggle = (role: Role) => {
    const next = new Set(value);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    onChange(next);
  };

  return (
    <div
      className="roster-filter-pills"
      role="group"
      aria-label="Filter by role"
    >
      {ALL_ROLES.map((role) => {
        const on = value.has(role);
        return (
          <button
            key={role}
            type="button"
            className={`role-pill${on ? ' is-on' : ''}`}
            onClick={() => handleToggle(role)}
            aria-pressed={on}
          >
            {formatRoleLabel(role)}
          </button>
        );
      })}
    </div>
  );
}
